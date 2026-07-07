"""Unit tests for entrant name resolution on imported registrations."""

from __future__ import annotations

import uuid

from app.db.models import Registration
from app.modules.registrations.entrant import (
    entrant_display_name,
    entrant_has_external_identity,
    form_entrant_name,
)


def _registration(**form: object) -> Registration:
    return Registration(
        organization_id=uuid.uuid4(),
        division_id=uuid.uuid4(),
        submitted_by=uuid.uuid4(),
        status="submitted",
        form_response=dict(form),
    )


def test_form_entrant_name_from_import() -> None:
    reg = _registration(name="Mihir Tuli", _organizer_import=True)
    assert form_entrant_name(reg) == "Mihir Tuli"
    assert entrant_has_external_identity(reg) is True
    assert entrant_display_name(reg, account_name="Organizer") == "Mihir Tuli"


def test_form_entrant_name_falls_back_to_account() -> None:
    reg = _registration(teamName="Aces", players=[{"name": "A"}, {"name": "B"}])
    assert form_entrant_name(reg) is None
    assert entrant_has_external_identity(reg) is False
    assert entrant_display_name(reg, account_name="Alice") == "Alice"
