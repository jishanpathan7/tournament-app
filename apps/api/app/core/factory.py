"""Wires swappable infra implementations from settings — the free→paid seam.

Used as FastAPI dependencies (``Depends(get_login_throttle)`` etc.). ``lru_cache``
makes each a process singleton (the throttle's sliding window must be shared).
"""

from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING

from app.core.config import get_settings
from app.core.ports import Cache, EmailChannel, JobQueue, Lock, LoginThrottle, PubSub, Storage
from app.core.throttle import build_throttle
from app.emails.log_channel import LogEmailChannel

if TYPE_CHECKING:
    from app.core.metrics import Metrics
    from app.core.tracing import Tracer
    from app.engine import (
        AdvancementEngine,
        FormatRegistry,
        SportRegistry,
        StandingsEngine,
        TeamFormationEngine,
    )
    from app.realtime.broadcaster import Broadcaster
    from app.realtime.connections import ConnectionManager
    from app.realtime.transport import RealtimeTransport


@lru_cache
def get_login_throttle() -> LoginThrottle:
    return build_throttle()


@lru_cache
def get_cache() -> Cache:
    """In-process TTL cache at MVP; RedisCache when REDIS_URL is set."""
    settings = get_settings()
    if settings.redis_url:
        from app.cache.redis_cache import RedisCache

        return RedisCache(settings.redis_url)
    from app.cache.memory import InMemoryCache

    return InMemoryCache()


@lru_cache
def get_lock() -> Lock:
    """No-op lock at MVP (single instance); RedisLock when REDIS_URL is set."""
    settings = get_settings()
    if settings.redis_url:
        from app.locks.redis_lock import RedisLock

        return RedisLock(settings.redis_url)
    from app.locks.noop_lock import NoopLock

    return NoopLock()


@lru_cache
def get_job_queue() -> JobQueue:
    """Outbox-backed queue at MVP (drained by the in-process poller); ARQ/Celery later."""
    from app.workers.queue import OutboxJobQueue

    return OutboxJobQueue()


@lru_cache
def get_pubsub() -> PubSub:
    """In-process asyncio broker at MVP (single instance); RedisPubSub when scaling out."""
    from app.realtime.pubsub import InProcessPubSub

    return InProcessPubSub(max_queue=get_settings().realtime_max_queue)


@lru_cache
def get_broadcaster() -> Broadcaster:
    from app.realtime.broadcaster import Broadcaster

    return Broadcaster(get_pubsub())


@lru_cache
def get_connection_manager() -> ConnectionManager:
    from app.realtime.connections import ConnectionManager

    return ConnectionManager()


@lru_cache
def get_transport() -> RealtimeTransport:
    """SSE transport at MVP; WebSocket/Ably/Pusher slot in behind the same protocol."""
    from app.realtime.transport import SSETransport

    return SSETransport()


@lru_cache
def get_metrics() -> Metrics:
    """No-op metrics at MVP; an OTel/StatsD/Prometheus exporter slots in here."""
    from app.core.metrics import NullMetrics

    return NullMetrics()


@lru_cache
def get_tracer() -> Tracer:
    """No-op tracer at MVP; an OpenTelemetry tracer slots in here when OTel is enabled."""
    from app.core.tracing import NullTracer

    return NullTracer()


@lru_cache
def get_sport_registry() -> SportRegistry:
    """The registered sport profiles. Adding a sport = one line here + one file in sports/."""
    from app.engine import SportRegistry
    from app.sports.badminton import BadmintonProfile

    registry = SportRegistry()
    registry.register(BadmintonProfile())
    return registry


@lru_cache
def get_format_registry() -> FormatRegistry:
    """The registered tournament formats. Adding a format = one line here + one engine file."""
    from app.engine import FormatRegistry, RoundRobinFormat, SingleEliminationFormat

    registry = FormatRegistry()
    registry.register(RoundRobinFormat())
    registry.register(SingleEliminationFormat())
    return registry


@lru_cache
def get_standings_engine() -> StandingsEngine:
    from app.engine import DefaultStandingsEngine

    return DefaultStandingsEngine()


@lru_cache
def get_advancement_engine() -> AdvancementEngine:
    from app.engine import DefaultAdvancementEngine

    return DefaultAdvancementEngine()


@lru_cache
def get_team_formation_engine() -> TeamFormationEngine:
    """The engine that combines solo entrants into balanced teams (the Smart Pairing
    Engine). One implementation serves every sport; the Sport Profile supplies the
    weights + policy."""
    from app.engine import FoldPairingEngine

    return FoldPairingEngine()


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
        secret=settings.effective_storage_signing_secret,
        presign_ttl=settings.storage_presign_ttl,
    )
