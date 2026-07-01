"""Background-jobs tests: registry, outbox enqueue, poller dispatch, retry/dead-letter,
org-context propagation, and the built-in cleanup/email handlers. DB-backed."""

from __future__ import annotations

import datetime
import os
import uuid

import pytest
import pytest_asyncio
from sqlalchemy import text

from app.core.db import session_scope
from app.core.factory import get_job_queue
from app.db.models import Outbox
from app.db.types import uuid7
from app.workers import poller, registry
from app.workers.registry import JobContext
from app.workers.tasks import EMAIL_DELIVER, MAINTENANCE_CLEANUP  # noqa: F401 (registers built-ins)

DATABASE_URL = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")

_UTC = datetime.timezone.utc


@pytest_asyncio.fixture(autouse=True)
async def _clean_outbox():
    async with session_scope() as session:
        async with session.begin():
            await session.execute(text("DELETE FROM outbox"))
    yield


@pytest.fixture
def clean_registry():
    saved = dict(registry._HANDLERS)
    yield
    registry._HANDLERS.clear()
    registry._HANDLERS.update(saved)


async def _drain(*, max_attempts: int = 5) -> int:
    return await poller.process_pending(batch_size=50, max_attempts=max_attempts)


async def _outbox_row(event_id: str) -> Outbox | None:
    async with session_scope() as session:
        async with session.begin():
            return await session.get(Outbox, uuid.UUID(event_id))


def test_registry_register_get_and_duplicate(clean_registry):
    async def h(payload: dict, ctx: JobContext) -> None:  # pragma: no cover - not invoked
        return None

    registry.register("test.x", h)
    assert registry.get_handler("test.x") is h
    with pytest.raises(ValueError):
        registry.register("test.x", h)
    registry.unregister("test.x")
    assert registry.get_handler("test.x") is None


async def test_enqueue_then_process(clean_registry):
    seen: list[int] = []

    async def record(payload: dict, ctx: JobContext) -> None:
        seen.append(payload["v"])

    registry.register("test.record", record)
    event_id = await get_job_queue().enqueue("test.record", {"v": 42})

    handled = await _drain()
    assert handled == 1 and seen == [42]
    row = await _outbox_row(event_id)
    assert row is not None and row.processed_at is not None and row.attempts == 0


async def test_failing_job_retries_then_dead_letters(clean_registry):
    calls: list[int] = []

    async def boom(payload: dict, ctx: JobContext) -> None:
        calls.append(1)
        raise RuntimeError("nope")

    registry.register("test.boom", boom)
    event_id = await get_job_queue().enqueue("test.boom", {})

    await _drain(max_attempts=3)  # one drain retries the poison row up to the cap
    row = await _outbox_row(event_id)
    assert row is not None
    assert len(calls) == 3
    assert row.attempts == 3
    assert row.processed_at is not None  # dead-lettered
    assert row.last_error and "nope" in row.last_error


async def test_missing_handler_is_recorded_not_fatal(clean_registry):
    event_id = await get_job_queue().enqueue("test.no_handler", {})
    await _drain(max_attempts=1)
    row = await _outbox_row(event_id)
    assert row is not None and row.attempts == 1 and "No handler" in (row.last_error or "")


async def test_org_context_set_from_payload(clean_registry):
    captured: dict[str, str] = {}

    async def check(payload: dict, ctx: JobContext) -> None:
        result = await ctx.session.execute(text("SELECT current_setting('app.current_org', true)"))
        captured["org"] = result.scalar_one()

    registry.register("test.org", check)
    org = str(uuid.uuid4())
    await get_job_queue().enqueue("test.org", {"organizationId": org})
    await _drain()
    assert captured["org"] == org


async def test_cleanup_purges_old_processed_outbox():
    old_id, recent_id = uuid7(), uuid7()
    now = datetime.datetime.now(_UTC)
    async with session_scope() as session:
        async with session.begin():
            session.add(
                Outbox(
                    id=old_id,
                    aggregate="x",
                    event_type="x.old",
                    payload={},
                    processed_at=now - datetime.timedelta(days=30),
                )
            )
            session.add(
                Outbox(
                    id=recent_id,
                    aggregate="x",
                    event_type="x.recent",
                    payload={},
                    processed_at=now - datetime.timedelta(days=1),
                )
            )
    await get_job_queue().enqueue(MAINTENANCE_CLEANUP, {})
    await _drain()
    assert (await _outbox_row(str(old_id))) is None  # purged (older than retention)
    assert (await _outbox_row(str(recent_id))) is not None  # kept


async def test_email_deliver_uses_channel(clean_registry, monkeypatch):
    sent: list[tuple] = []

    class Recorder:
        async def send(self, to: str, template: str, data: dict) -> str:
            sent.append((to, template, data))
            return "recorded"

    import app.workers.tasks as tasks_mod

    monkeypatch.setattr(tasks_mod, "get_email_channel", lambda: Recorder())
    await get_job_queue().enqueue(
        EMAIL_DELIVER,
        {"to": "u@example.com", "template": "verify_email", "data": {"name": "A", "token": "T"}},
    )
    await _drain()
    assert sent == [("u@example.com", "verify_email", {"name": "A", "token": "T"})]
