"""Files module integration tests: presign → direct upload → complete → download →
delete, plus validation and auth. DB-backed (skips without a database)."""

from __future__ import annotations

import os
import secrets
import struct
import uuid
from urllib.parse import urlsplit

import pytest
from fastapi import FastAPI

from app.core.config import get_settings
from app.core.factory import get_storage
from app.storage.local import LocalStorage

DATABASE_URL = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")

# Generated per run with no string literal — nothing for secret scanners to flag.
PASSWORD = secrets.token_urlsafe(16)
AUTH = "/api/v1/auth"
ORGS = "/api/v1/orgs"
FILES = "/api/v1/files"


def _png(width: int, height: int) -> bytes:
    ihdr = struct.pack(">II", width, height) + b"\x08\x06\x00\x00\x00"
    return b"\x89PNG\r\n\x1a\n" + struct.pack(">I", 13) + b"IHDR" + ihdr + b"\x00" * 4


def _email() -> str:
    return f"u-{uuid.uuid4().hex[:12]}@example.com"


def _slug() -> str:
    return f"org-{uuid.uuid4().hex[:10]}"


def _csrf(client) -> dict[str, str]:
    return {"X-CSRF-Token": client.cookies.get("csrf_token") or ""}


@pytest.fixture
def local_storage(app: FastAPI, tmp_path):
    """Point the app's Storage at a temp dir (still the local backend)."""
    st = LocalStorage(
        root=str(tmp_path / "storage"),
        base_url="http://test/api/v1",
        secret=get_settings().jwt_secret,
        presign_ttl=900,
    )
    app.dependency_overrides[get_storage] = lambda: st
    return st


async def _auth_with_org(client) -> None:
    email = _email()
    await client.post(f"{AUTH}/register", json={"email": email, "name": "T", "password": PASSWORD})
    await client.post(f"{AUTH}/login", json={"email": email, "password": PASSWORD})
    resp = await client.post(ORGS, json={"name": "Acme", "slug": _slug()}, headers=_csrf(client))
    assert resp.status_code == 201, resp.text


def _path(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.path}?{parts.query}" if parts.query else parts.path


async def test_upload_lifecycle_with_image_metadata(app, client, local_storage):
    await _auth_with_org(client)
    png = _png(24, 36)

    presign = await client.post(
        FILES,
        json={"kind": "avatar", "filename": "me.png", "contentType": "image/png", "size": len(png)},
        headers=_csrf(client),
    )
    assert presign.status_code == 201, presign.text
    body = presign.json()
    file_id = body["fileId"]
    upload = body["upload"]

    # Direct upload to the (local) presigned URL — no session/CSRF, HMAC-signed.
    put = await client.put(_path(upload["url"]), content=png, headers=upload["headers"])
    assert put.status_code == 204, put.text

    completed = await client.post(f"{FILES}/{file_id}/complete", headers=_csrf(client))
    assert completed.status_code == 200, completed.text
    done = completed.json()
    assert done["status"] == "ready"
    assert done["visibility"] == "public"  # avatar is a public kind
    assert done["metadata"] == {"width": 24, "height": 36, "format": "png"}
    assert done["url"]

    fetched = await client.get(f"{FILES}/{file_id}")
    assert fetched.status_code == 200 and fetched.json()["url"]

    # The download URL actually serves the bytes back.
    dl = await client.get(_path(fetched.json()["url"]))
    assert dl.status_code == 200 and dl.content == png

    deleted = await client.delete(f"{FILES}/{file_id}", headers=_csrf(client))
    assert deleted.status_code == 204
    assert (await client.get(f"{FILES}/{file_id}")).status_code == 404


async def test_rejects_disallowed_mime_type(app, client, local_storage):
    await _auth_with_org(client)
    resp = await client.post(
        FILES,
        json={"kind": "avatar", "filename": "x.pdf", "contentType": "application/pdf", "size": 100},
        headers=_csrf(client),
    )
    assert resp.status_code == 422 and resp.json()["code"] == "content_type_not_allowed"


async def test_rejects_oversized_declared_size(app, client, local_storage):
    await _auth_with_org(client)
    resp = await client.post(
        FILES,
        json={
            "kind": "avatar",
            "filename": "big.png",
            "contentType": "image/png",
            "size": 999_999_999,
        },
        headers=_csrf(client),
    )
    assert resp.status_code == 422 and resp.json()["code"] == "file_too_large"


async def test_upload_requires_authentication(app, client, local_storage):
    resp = await client.post(
        FILES,
        json={"kind": "avatar", "filename": "x.png", "contentType": "image/png", "size": 10},
    )
    assert resp.status_code == 401


async def test_complete_missing_object_marks_incomplete(app, client, local_storage):
    await _auth_with_org(client)
    presign = await client.post(
        FILES,
        json={"kind": "avatar", "filename": "m.png", "contentType": "image/png", "size": 10},
        headers=_csrf(client),
    )
    file_id = presign.json()["fileId"]
    # Complete without ever uploading the bytes → 422 upload_incomplete.
    resp = await client.post(f"{FILES}/{file_id}/complete", headers=_csrf(client))
    assert resp.status_code == 422 and resp.json()["code"] == "upload_incomplete"
