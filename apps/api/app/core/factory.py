"""Wires swappable infra implementations from settings — the free→paid seam.

Used as FastAPI dependencies (``Depends(get_login_throttle)`` etc.). ``lru_cache``
makes each a process singleton (the throttle's sliding window must be shared).
"""

from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.core.ports import Cache, EmailChannel, JobQueue, LoginThrottle, Storage
from app.core.throttle import build_throttle
from app.emails.log_channel import LogEmailChannel


@lru_cache
def get_login_throttle() -> LoginThrottle:
    return build_throttle()


@lru_cache
def get_cache() -> Cache:
    """In-process TTL cache at MVP; a RedisCache slots in here when REDIS_URL is set."""
    from app.cache.memory import InMemoryCache

    return InMemoryCache()


@lru_cache
def get_job_queue() -> JobQueue:
    """Outbox-backed queue at MVP (drained by the in-process poller); ARQ/Celery later."""
    from app.workers.queue import OutboxJobQueue

    return OutboxJobQueue()


@lru_cache
def get_email_channel() -> EmailChannel:
    """Resend when RESEND_API_KEY is set; otherwise the dev LogEmailChannel.
    Both render through app.emails.renderer — callers never build raw HTML."""
    settings = get_settings()
    if settings.resend_api_key:
        from app.emails.resend_channel import ResendEmailChannel

        return ResendEmailChannel(
            api_key=settings.resend_api_key, sender=settings.email_from, settings=settings
        )
    return LogEmailChannel(settings)


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
