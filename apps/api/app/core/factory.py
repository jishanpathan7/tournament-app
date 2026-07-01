"""Wires swappable infra implementations from settings — the free→paid seam.

Used as FastAPI dependencies (``Depends(get_login_throttle)`` etc.). ``lru_cache``
makes each a process singleton (the throttle's sliding window must be shared).
"""

from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.core.ports import EmailChannel, LoginThrottle, Storage
from app.core.throttle import build_throttle
from app.emails.log_channel import LogEmailChannel


@lru_cache
def get_login_throttle() -> LoginThrottle:
    return build_throttle()


@lru_cache
def get_email_channel() -> EmailChannel:
    # Resend wiring is deferred; LogEmailChannel renders to logs until RESEND_API_KEY is set.
    return LogEmailChannel()


@lru_cache
def get_storage() -> Storage:
    """R2 when credentials are present, else the dev local-disk backend."""
    settings = get_settings()
    if settings.storage_backend == "r2":
        from app.storage.r2 import R2Storage

        assert settings.r2_endpoint and settings.r2_access_key_id  # narrowed by r2_configured
        assert settings.r2_secret_access_key and settings.r2_bucket
        return R2Storage(
            endpoint_url=settings.r2_endpoint,
            access_key_id=settings.r2_access_key_id,
            secret_access_key=settings.r2_secret_access_key,
            bucket=settings.r2_bucket,
            public_base_url=settings.r2_public_base_url,
            presign_ttl=settings.storage_presign_ttl,
        )
    from app.storage.local import LocalStorage

    return LocalStorage(
        root=settings.storage_local_dir,
        base_url=f"{settings.app_base_url}{settings.api_v1_prefix}",
        secret=settings.jwt_secret,
        presign_ttl=settings.storage_presign_ttl,
    )
