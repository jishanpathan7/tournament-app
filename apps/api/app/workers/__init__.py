"""Background jobs — in-process, outbox-backed (the ``JobQueue`` port at MVP).

`emit_event` / `JobQueue.enqueue` append rows to the transactional ``outbox``;
the `poller` claims them (`FOR UPDATE SKIP LOCKED`), dispatches to handlers
registered in `registry`, and marks them processed — with per-row retry +
dead-letter. Single instance runs the loop in the app lifespan; at scale the
same handler registry runs behind ARQ/Celery on Redis — a swap, not a rewrite.
"""
