"""Cloudflare R2 ``Storage`` backend via the S3-compatible API (boto3).

Clients upload/download directly against R2 with presigned URLs, so file bytes
never transit the API in production. boto3 is synchronous, so each call is offloaded
to a worker thread to avoid blocking the event loop. R2 uses region ``auto``.
"""

from __future__ import annotations

import asyncio
from typing import Any

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.core.ports import StoredObject


class R2Storage:
    """R2/S3 Storage. Satisfies ``app.core.ports.Storage``."""

    def __init__(
        self,
        *,
        endpoint_url: str,
        access_key_id: str,
        secret_access_key: str,
        bucket: str,
        public_base_url: str | None,
        presign_ttl: int,
    ) -> None:
        self._bucket = bucket
        self._public_base_url = (public_base_url or "").rstrip("/")
        self._ttl = presign_ttl
        self._client: Any = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            region_name="auto",
            config=Config(signature_version="s3v4"),
        )

    async def presign_put(self, key: str, content_type: str, max_size: int) -> dict[str, Any]:
        url = await asyncio.to_thread(
            self._client.generate_presigned_url,
            "put_object",
            Params={"Bucket": self._bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=self._ttl,
        )
        # A plain presigned PUT can't enforce a size ceiling; the service verifies the
        # actual object size via stat() on complete and rejects/marks-failed if over.
        return {
            "url": url,
            "method": "PUT",
            "headers": {"Content-Type": content_type},
            "maxSize": max_size,
            "expiresIn": self._ttl,
        }

    async def presign_get(self, key: str, ttl: int) -> str:
        url: str = await asyncio.to_thread(
            self._client.generate_presigned_url,
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=ttl,
        )
        return url

    def public_url(self, key: str) -> str:
        return f"{self._public_base_url}/{key}"

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self._client.delete_object, Bucket=self._bucket, Key=key)

    async def stat(self, key: str) -> StoredObject | None:
        try:
            head = await asyncio.to_thread(self._client.head_object, Bucket=self._bucket, Key=key)
        except ClientError:
            return None
        return StoredObject(size=int(head["ContentLength"]), content_type=head.get("ContentType"))

    async def read(self, key: str) -> bytes | None:
        try:
            obj = await asyncio.to_thread(self._client.get_object, Bucket=self._bucket, Key=key)
        except ClientError:
            return None
        body: bytes = obj["Body"].read()
        return body
