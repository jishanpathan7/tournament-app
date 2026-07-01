"""Unit tests for the storage backends & helpers (no DB, no network)."""

from __future__ import annotations

import io
import secrets
import struct
import time

import pytest

import app.storage.r2 as r2_mod
from app.storage.images import probe_image
from app.storage.local import LocalStorage, sign_payload, verify_signature
from app.storage.r2 import R2Storage

# Test-only credentials, generated per run — never hardcode secret-looking literals.
SECRET = secrets.token_urlsafe(16)


def _png(width: int, height: int) -> bytes:
    ihdr = struct.pack(">II", width, height) + b"\x08\x06\x00\x00\x00"
    return b"\x89PNG\r\n\x1a\n" + struct.pack(">I", 13) + b"IHDR" + ihdr + b"\x00" * 4


def _gif(width: int, height: int) -> bytes:
    return b"GIF89a" + struct.pack("<HH", width, height) + b"\x00" * 16


def _jpeg(width: int, height: int) -> bytes:
    sof = b"\xff\xc0" + struct.pack(">H", 17) + b"\x08" + struct.pack(">HH", height, width)
    return b"\xff\xd8" + b"\xff\xe0\x00\x04ab" + sof + b"\x00" * 8


def test_probe_image_formats():
    assert probe_image(_png(12, 34)) == {"width": 12, "height": 34, "format": "png"}
    assert probe_image(_gif(20, 40)) == {"width": 20, "height": 40, "format": "gif"}
    assert probe_image(_jpeg(50, 60)) == {"width": 50, "height": 60, "format": "jpeg"}


def test_probe_image_rejects_non_image():
    assert probe_image(b"not an image at all, just text bytes here") is None
    assert probe_image(b"short") is None


def test_local_signature_roundtrip_and_tamper():
    sig = sign_payload(SECRET, "PUT", "org/kind/id/file.png", 9_999_999_999)
    assert verify_signature(SECRET, "PUT", "org/kind/id/file.png", 9_999_999_999, sig)
    # Wrong method, tampered sig, and expired all fail.
    assert not verify_signature(SECRET, "GET", "org/kind/id/file.png", 9_999_999_999, sig)
    assert not verify_signature(SECRET, "PUT", "org/kind/id/file.png", 9_999_999_999, "deadbeef")
    assert not verify_signature(SECRET, "PUT", "org/kind/id/file.png", int(time.time()) - 1, sig)


@pytest.mark.asyncio
async def test_local_storage_roundtrip(tmp_path):
    st = LocalStorage(
        root=str(tmp_path), base_url="http://test/api/v1", secret=SECRET, presign_ttl=900
    )
    key = "org/avatar/abc/pic.png"
    st.write(key, b"hello-bytes")
    assert (await st.read(key)) == b"hello-bytes"
    stat = await st.stat(key)
    assert stat is not None and stat.size == len(b"hello-bytes")
    put = await st.presign_put(key, "image/png", 1000)
    assert put["method"] == "PUT" and "/files/local/" in put["url"]
    await st.delete(key)
    assert (await st.read(key)) is None


@pytest.mark.asyncio
async def test_local_storage_rejects_path_traversal(tmp_path):
    st = LocalStorage(root=str(tmp_path), base_url="http://x/api/v1", secret=SECRET, presign_ttl=60)
    with pytest.raises(ValueError):
        await st.read("../../etc/passwd")


class _FakeS3:
    def generate_presigned_url(self, operation, Params, ExpiresIn):  # noqa: N803 (boto3 casing)
        return f"https://r2.example/{Params['Key']}?op={operation}&ttl={ExpiresIn}"

    def head_object(self, Bucket, Key):  # noqa: N803
        return {"ContentLength": 11, "ContentType": "image/png"}

    def get_object(self, Bucket, Key):  # noqa: N803
        return {"Body": io.BytesIO(b"hello-bytes")}

    def delete_object(self, Bucket, Key):  # noqa: N803
        return {}


@pytest.fixture
def r2(monkeypatch):
    monkeypatch.setattr(r2_mod.boto3, "client", lambda *a, **k: _FakeS3())
    return R2Storage(
        endpoint_url="https://acct.r2.cloudflarestorage.com",
        access_key_id=SECRET,
        secret_access_key=SECRET,
        bucket="bkt",
        public_base_url="https://cdn.example",
        presign_ttl=900,
    )


@pytest.mark.asyncio
async def test_r2_presign_and_public_url(r2):
    put = await r2.presign_put("k/1.png", "image/png", 1000)
    assert "op=put_object" in put["url"] and put["headers"]["Content-Type"] == "image/png"
    get = await r2.presign_get("k/1.png", 60)
    assert "op=get_object" in get
    assert r2.public_url("k/1.png") == "https://cdn.example/k/1.png"


@pytest.mark.asyncio
async def test_r2_stat_and_read(r2):
    stat = await r2.stat("k/1.png")
    assert stat is not None and stat.size == 11 and stat.content_type == "image/png"
    assert (await r2.read("k/1.png")) == b"hello-bytes"
