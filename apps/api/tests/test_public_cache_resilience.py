"""A stale or corrupt public-cache blob must never 500 a read path — the revive
helpers treat anything that no longer fits the schema as a cache miss so the
endpoint rebuilds from the database (see public/router `_revive`)."""

from __future__ import annotations

import uuid

from app.modules.public.router import _revive, _revive_list
from app.modules.public.schemas import PublicDivisionView, PublicTournamentView


def _valid_tournament_blob() -> dict:
    return {
        "id": str(uuid.uuid4()),
        "slug": "sibl",
        "name": "SIBL",
        "sportKey": "badminton",
        "status": "draft",
        "visibility": "public",
        "startsAt": None,
        "endsAt": None,
        "venueName": None,
        "venue": None,
        "drawPublishedAt": None,
        "schedulePublishedAt": None,
        "resultsPublishedAt": None,
        "organization": {"slug": "org", "name": "Org", "branding": {}},
    }


def test_revive_reconstructs_a_valid_blob() -> None:
    view = _revive(PublicTournamentView, _valid_tournament_blob())
    assert view is not None
    assert view.slug == "sibl"


def test_revive_returns_none_for_a_stale_shape() -> None:
    # An older deploy's blob missing a now-required field must be treated as a miss.
    blob = _valid_tournament_blob()
    del blob["organization"]
    assert _revive(PublicTournamentView, blob) is None


def test_revive_returns_none_for_non_dict() -> None:
    assert _revive(PublicTournamentView, ["not", "a", "dict"]) is None
    assert _revive(PublicTournamentView, None) is None


def test_revive_list_reconstructs_and_rejects_bad_rows() -> None:
    good = [
        {
            "id": str(uuid.uuid4()),
            "name": "Open",
            "participantType": "pair",
            "capacity": None,
            "approvedCount": 3,
        }
    ]
    revived = _revive_list(PublicDivisionView, good)
    assert revived is not None and revived[0].approved_count == 3

    # One malformed row invalidates the cached list → rebuild from DB.
    assert _revive_list(PublicDivisionView, [{"name": "missing fields"}]) is None
    assert _revive_list(PublicDivisionView, "not a list") is None
