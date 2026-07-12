"""Smart Pairing API schemas (camelCase on the wire).

Strength/confidence are emitted as floats (numbers on the wire for the TS client);
member ids are the source *registration* ids (each a solo entrant).
"""

from __future__ import annotations

import uuid

from pydantic import Field

from app.api.schemas import ApiModel


class GeneratePairingRequest(ApiModel):
    # Optional explicit seed for reproducibility; the service picks a stable one if omitted.
    rng_seed: int | None = None
    # Manual hard constraints (each a group of registration ids):
    forced_groups: list[list[uuid.UUID]] = Field(default_factory=list)
    forbidden_pairs: list[list[uuid.UUID]] = Field(default_factory=list)
    # When set, pair only the members of this squad (franchise / SIBL flow).
    squad_id: uuid.UUID | None = None


class EntrantView(ApiModel):
    registration_id: uuid.UUID
    display_name: str
    skill_level: str | None
    weight: float
    preferred_partner_id: uuid.UUID | None
    squad_name: str | None = None


class ProposedTeamView(ApiModel):
    id: uuid.UUID
    member_ids: list[uuid.UUID]
    strength: float
    confidence: float  # 0..1
    reasons: list[str]
    locked: bool
    team_name: str | None


class PairingSummary(ApiModel):
    team_count: int
    entrant_count: int
    unpaired_count: int
    average_confidence: float


class PairingRunView(ApiModel):
    id: uuid.UUID
    division_id: uuid.UUID
    squad_id: uuid.UUID | None = None
    status: str
    rng_seed: int | None
    entrants: list[EntrantView]
    teams: list[ProposedTeamView]
    unpaired_ids: list[uuid.UUID]
    summary: PairingSummary


class UpdateProposedTeamRequest(ApiModel):
    locked: bool | None = None
    team_name: str | None = None
    clear_team_name: bool = False


class SwapMembersRequest(ApiModel):
    """Swap two members between their (different) proposed teams — a manual override."""

    member_a: uuid.UUID
    member_b: uuid.UUID


class PublishPairingResponse(ApiModel):
    run_id: uuid.UUID
    published_teams: int
    unpaired_count: int


class RepairPairingResponse(ApiModel):
    teams_repaired: int


class AddDuplicatePairRequest(ApiModel):
    """Captain assigns a partner to an odd-one-out player by choosing an existing
    player to play twice.  The resulting duplicate pair is locked automatically so
    a regenerate does not remove it.

    ``unpaired_id``  – registration id of the player who currently has no partner.
    ``duplicate_id`` – registration id of the player who will play a second match.
    """

    unpaired_id: uuid.UUID
    duplicate_id: uuid.UUID


class PartnerWarning(ApiModel):
    registration_id: uuid.UUID
    player_name: str
    requested_partner_name: str
    reason: str  # "not_found" | "ambiguous"


class PartnerWarningsResponse(ApiModel):
    warnings: list[PartnerWarning]
    total: int
