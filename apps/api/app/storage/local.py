"""Local-disk ``Storage`` backend for development (no R2 credentials required).

Objects live under ``settings.storage_local_dir``. Since disk has no native
presigning, uploads/downloads are routed through signed local API endpoints
(``PUT/GET /files/local/{key}``): each presigned URL carries an ``expires`` epoch
and an HMAC ``sig`` that the endpoints verify with ``verify_signature`` before
touching disk. Dev-only — never selected when R2 is configured.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote

from app.core.ports import StoredObject

# public_url() needs a durable link; sign it far in the future (dev convenience).
_PUBLIC_URL_TTL = 10 * 365 * 24 * 3600


def sign_payload(secret: str, method: str, key: str, expires: int) -> str:
    msg = f"{method}\n{key}\n{expires}".encode()
    return hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()


def verify_signature(secret: str, method: str, key: str, expires: int, sig: str) -> bool:
    if expires < int(time.time()):
        return False
    return hmac.compare_digest(sign_payload(secret, method, key, expires), sig)


class LocalStorage:
    """Disk-backed Storage. Satisfies ``app.core.ports.Storage``."""

    def __init__(self, *, root: str, base_url: str, secret: str, presign_ttl: int) -> None:
        self._root = Path(root).resolve()
        self._base_url = base_url.rstrip("/")  # e.g. http://localhost:8000/api/v1
        self._secret = secret
        self._ttl = presign_ttl

    def _path(self, key: str) -> Path:
        """Resolve ``key`` under the storage root, rejecting path traversal."""
        target = (self._root / key).resolve()
        if target != self._root and self._root not in target.parents:
            raise ValueError("Illegal storage key (path traversal)")
        return target

    def _signed_url(self, method: str, key: str, ttl: int) -> str:
        expires = int(time.time()) + ttl
        sig = sign_payload(self._secret, method, key, expires)
        return f"{self._base_url}/files/local/{quote(key)}?expires={expires}&sig={sig}"

    async def presign_put(self, key: str, content_type: str, max_size: int) -> dict[str, Any]:
        return {
            "url": self._signed_url("PUT", key, self._ttl),
            "method": "PUT",
            "headers": {"Content-Type": content_type},
            "maxSize": max_size,
            "expiresIn": self._ttl,
        }

    async def presign_get(self, key: str, ttl: int) -> str:
        return self._signed_url("GET", key, ttl)

    def public_url(self, key: str) -> str:
        return self._signed_url("GET", key, _PUBLIC_URL_TTL)

    async def delete(self, key: str) -> None:
        path = self._path(key)
        if path.exists():
            path.unlink()

    async def stat(self, key: str) -> StoredObject | None:
        path = self._path(key)
        if not path.exists():
            return None
        return StoredObject(size=path.stat().st_size, content_type=None)

    async def read(self, key: str) -> bytes | None:
        path = self._path(key)
        return path.read_bytes() if path.exists() else None

    def write(self, key: str, data: bytes) -> None:
        """Persist bytes to disk (used by the dev upload endpoint, not the port)."""
        path = self._path(key)
        os.makedirs(path.parent, exist_ok=True)
        path.write_bytes(data)
