"""Unit tests for partner-name → registration-id resolution."""

from __future__ import annotations

import uuid

from app.db.models import Registration
from app.modules.registrations.partner_resolution import (
    normalize_partner_name,
    preferred_partner_id_for,
    resolve_preferred_partner_ids,
)


def _reg(name: str, *, partner_name: str | None = None, partner_id: str | None = None) -> Registration:
    form: dict[str, str] = {"name": name}
    if partner_name:
        form["preferredPartnerName"] = partner_name
    if partner_id:
        form["preferredPartnerRegistrationId"] = partner_id
    return Registration(
        id=uuid.uuid4(),
        organization_id=uuid.uuid4(),
        division_id=uuid.uuid4(),
        submitted_by=uuid.uuid4(),
        status="submitted",
        form_response=form,
    )


def test_normalize_partner_name_collapses_whitespace() -> None:
    assert normalize_partner_name("  Alice   Smith  ") == "alice smith"


def test_resolve_preferred_partner_ids_links_mutual_names() -> None:
    alice = _reg("Alice Smith")
    bob = _reg("Bob Jones", partner_name="Alice Smith")
    linked = resolve_preferred_partner_ids([alice, bob])
    assert linked == 1
    orm = bob.form_response or {}
    assert orm["preferredPartnerRegistrationId"] == str(alice.id)


def test_preferred_partner_id_for_falls_back_to_name() -> None:
    alice = _reg("Alice Smith")
    bob = _reg("Bob Jones", partner_name="alice smith")
    by_id = {str(alice.id): alice, str(bob.id): bob}
    assert preferred_partner_id_for(bob, by_id=by_id) == str(alice.id)


def test_ambiguous_partner_name_is_skipped() -> None:
    a1 = _reg("Alice Smith")
    a2 = _reg("Alice Smith")
    bob = _reg("Bob Jones", partner_name="Alice Smith")
    linked = resolve_preferred_partner_ids([a1, a2, bob])
    assert linked == 0
