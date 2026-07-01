"""Default EmailChannel: renders the email to structured logs (no external dependency).

Lets verification / reset / invite flows run end-to-end in dev and tests with no
secret. The token-bearing link is logged so it can be picked up in tests.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("app.email")


class LogEmailChannel:
    async def send(self, to: str, template: str, data: dict[str, Any]) -> str:
        logger.info("email.sent", extra={"to": to, "template": template, "data": data})
        return "logged"
