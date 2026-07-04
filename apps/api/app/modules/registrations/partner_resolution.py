"""Resolve CSV ``preferredPartnerName`` values to ``preferredPartnerRegistrationId``.

The pairing engine honors partner links by registration id; import stores partner names
as plain text. This module normalizes names and links mutual or one-way preferences
after import (or at pairing time as a fallback).
"""

from __future__ import annotations

import re
import uuid
from collections.abc import Sequence

from app.db.models import Registration


def normalize_partner_name(name: str) -> str:
    """Case-insensitive, whitespace-collapsed key for name matching."""
    return re.sub(r"\s+", " ", name.strip().lower())


def _name_index(registrations: Sequence[Registration]) -> dict[str, list[Registration]]:
    index: dict[str, list[Registration]] = {}
    for reg in registrations:
        form = reg.form_response or {}
        raw = form.get("name")
        if not raw:
            continue
        key = normalize_partner_name(str(raw))
        if key:
            index.setdefault(key, []).append(reg)
    return index


def _lookup_partner_id(
    partner_name: str,
    *,
    self_id: uuid.UUID,
    index: dict[str, list[Registration]],
) -> uuid.UUID | None:
    candidates = [r for r in index.get(normalize_partner_name(partner_name), []) if r.id != self_id]
    if len(candidates) == 1:
        return candidates[0].id
    return None


def resolve_preferred_partner_ids(registrations: Sequence[Registration]) -> int:
    """Mutate ``form_response`` on each registration that has a resolvable partner name.

    Returns the count of registrations that gained a ``preferredPartnerRegistrationId``.
    """
    index = _name_index(registrations)
    linked = 0
    for reg in registrations:
        form = dict(reg.form_response or {})
        if form.get("preferredPartnerRegistrationId") or not form.get("preferredPartnerName"):
            continue
        partner_id = _lookup_partner_id(
            str(form["preferredPartnerName"]), self_id=reg.id, index=index
        )
        if partner_id is None:
            continue
        form["preferredPartnerRegistrationId"] = str(partner_id)
        reg.form_response = form
        linked += 1
    return linked


def preferred_partner_id_for(
    reg: Registration,
    *,
    by_id: dict[str, Registration],
) -> str | None:
    """Resolve a partner link from id or name for pairing."""
    form = reg.form_response or {}
    pref = form.get("preferredPartnerRegistrationId")
    if pref and str(pref) in by_id:
        return str(pref)
    partner_name = form.get("preferredPartnerName")
    if not partner_name:
        return None
    index = _name_index(by_id.values())
    partner_id = _lookup_partner_id(str(partner_name), self_id=reg.id, index=index)
    return str(partner_id) if partner_id else None
