"""Swappable infrastructure interfaces — the free→paid seam (see docs/INTERFACES.md).

Application/domain code depends on these Protocols, never on a concrete backend.
A factory wires the implementation from settings. At MVP everything is in-process;
at scale these are backed by Redis/Upstash, Ably/Pusher, etc. — a config swap, not a
refactor. These are contracts only; no implementations live here.
"""

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any, Protocol, runtime_checkable


@dataclass(frozen=True)
class StoredObject:
    """Metadata about a stored object (result of a HEAD/stat)."""

    size: int
    content_type: str | None


@runtime_checkable
class PubSub(Protocol):
    """Realtime fan-out. MVP: in-process asyncio broker. Scale: Redis pub/sub."""

    async def publish(self, channel: str, event: dict[str, Any]) -> None: ...

    def subscribe(self, channel: str) -> AsyncIterator[dict[str, Any]]: ...


@runtime_checkable
class JobQueue(Protocol):
    """Background work. MVP: outbox-polling loop. Scale: ARQ on Redis."""

    async def enqueue(self, task: str, payload: dict[str, Any]) -> str: ...


@runtime_checkable
class Cache(Protocol):
    """MVP: in-memory TTL map. Scale: Redis."""

    async def get(self, key: str) -> bytes | None: ...

    async def set(self, key: str, value: bytes, *, ttl: int) -> None: ...

    async def delete(self, key: str) -> None: ...


@runtime_checkable
class Storage(Protocol):
    """Object storage (Cloudflare R2 in prod, local disk in dev).

    Clients upload/download directly via presigned URLs — bytes never transit the
    API in production. ``stat``/``read`` back server-side verification and image
    probing on upload-complete; ``delete`` removes objects. Same contract at scale.
    """

    async def presign_put(self, key: str, content_type: str, max_size: int) -> dict[str, Any]: ...

    async def presign_get(self, key: str, ttl: int) -> str: ...

    def public_url(self, key: str) -> str: ...

    async def delete(self, key: str) -> None: ...

    async def stat(self, key: str) -> StoredObject | None: ...

    async def read(self, key: str) -> bytes | None: ...


@runtime_checkable
class EmailChannel(Protocol):
    """Transactional email (Resend). One implementation of a broader NotificationChannel."""

    async def send(self, to: str, template: str, data: dict[str, Any]) -> str: ...


@runtime_checkable
class AuthService(Protocol):
    """Identity. MVP: first-party JWT (see app/modules/auth). This Protocol is the
    swap seam for managed auth (Clerk/Auth0) later — the first-party module does NOT
    route through it; it keeps concrete, well-typed service functions."""

    async def issue_tokens(
        self, user_id: str, organization_id: str | None = None
    ) -> dict[str, str]: ...

    async def verify_access(self, token: str) -> dict[str, Any]: ...

    async def rotate_refresh(self, token: str) -> dict[str, str]: ...


@runtime_checkable
class LoginThrottle(Protocol):
    """Brute-force guard. MVP: in-process sliding window. Scale: Redis-backed."""

    async def check(self, key: str) -> None: ...  # raise LoginThrottleError if locked out

    async def record_failure(self, key: str) -> None: ...

    async def reset(self, key: str) -> None: ...
