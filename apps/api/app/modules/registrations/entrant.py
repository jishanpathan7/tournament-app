"""Resolve the human-facing name for a registration entrant.

Self-service sign-ups use the submitter's account; organizer imports store the player's
name in ``form_response.name`` while ``submitted_by`` remains the organizer.
"""

from __future__ import annotations

from app.db.models import Registration


def form_entrant_name(registration: Registration) -> str | None:
    form = registration.form_response or {}
    name = form.get("name")
    if name is None:
        return None
    text = str(name).strip()
    return text or None


def entrant_display_name(registration: Registration, *, account_name: str | None = None) -> str:
    return form_entrant_name(registration) or account_name or "Player"


def entrant_has_external_identity(registration: Registration) -> bool:
    return form_entrant_name(registration) is not None
