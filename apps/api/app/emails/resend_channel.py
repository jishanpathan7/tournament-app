"""Resend-backed ``EmailChannel`` — renders a template then sends via the Resend API.

Selected by ``factory.get_email_channel`` when ``RESEND_API_KEY`` is set. The Resend
SDK is synchronous, so the send is offloaded to a worker thread.
"""

from __future__ import annotations

import asyncio
from typing import Any

import resend

from app.core.config import Settings
from app.emails.renderer import render


class ResendEmailChannel:
    """Satisfies ``app.core.ports.EmailChannel``."""

    def __init__(self, *, api_key: str, sender: str, settings: Settings) -> None:
        self._sender = sender
        self._settings = settings
        resend.api_key = api_key

    async def send(self, to: str, template: str, data: dict[str, Any]) -> str:
        email = render(template, data, settings=self._settings)
        params: resend.Emails.SendParams = {
            "from": self._sender,
            "to": [to],
            "subject": email.subject,
            "html": email.html,
            "text": email.text,
        }
        result = await asyncio.to_thread(resend.Emails.send, params)
        if isinstance(result, dict):
            return str(result.get("id", "sent"))
        return str(getattr(result, "id", "sent"))
