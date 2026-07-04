"""Default EmailChannel: renders the email to structured logs (no external dependency).

Used in development and tests only — never deployed in production or staging (the
real Resend channel requires RESEND_API_KEY). Sensitive fields (token, password_reset_url,
verify_url, invite_url) are redacted before logging so that raw secrets never appear
in log aggregators even if this channel is accidentally activated.
"""

from __future__ import annotations

import logging
from typing import Any

from app.core.config import Settings
from app.emails.renderer import render

logger = logging.getLogger("app.email")

_REDACTED_FIELDS = frozenset(
    {"token", "password_reset_url", "verify_url", "invite_url", "magic_link", "otp"}
)


def _redact(data: dict[str, Any]) -> dict[str, Any]:
    return {k: "[REDACTED]" if k in _REDACTED_FIELDS else v for k, v in data.items()}


class LogEmailChannel:
    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings

    async def send(self, to: str, template: str, data: dict[str, Any]) -> str:
        subject: str | None = None
        if self._settings is not None:
            try:
                subject = render(template, data, settings=self._settings).subject
            except Exception:
                subject = None
        logger.info(
            "email.sent",
            extra={"to": to, "template": template, "subject": subject, "data": _redact(data)},
        )
        return "logged"
