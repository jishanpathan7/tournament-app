"""Default EmailChannel: renders the email to structured logs (no external dependency).

Lets verification / reset / invite flows run end-to-end in dev and tests with no
secret. The token-bearing data is logged so it can be picked up in tests; when
settings are provided it also renders the subject through the shared renderer for
a realistic dev view (best-effort — a template error never breaks the flow).
"""

from __future__ import annotations

import logging
from typing import Any

from app.core.config import Settings
from app.emails.renderer import render

logger = logging.getLogger("app.email")


class LogEmailChannel:
    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings

    async def send(self, to: str, template: str, data: dict[str, Any]) -> str:
        subject: str | None = None
        if self._settings is not None:
            try:
                subject = render(template, data, settings=self._settings).subject
            except Exception:  # dev log channel — never fail on a template/data issue
                subject = None
        logger.info(
            "email.sent",
            extra={"to": to, "template": template, "subject": subject, "data": data},
        )
        return "logged"
