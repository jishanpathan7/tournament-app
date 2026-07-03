"""Model barrel — importing this registers every table on ``Base.metadata``.

Alembic (``migrations/env.py``) and the metadata test import this module so the
full schema is present on the shared metadata. Keep ``__all__`` in sync with the
models below.
"""

from app.db.models.competition import Match, MatchParticipant, MatchResultEvent, Standing
from app.db.models.crosscutting import (
    AuditLog,
    FeatureFlag,
    File,
    IdempotencyKey,
    Notification,
    Outbox,
    ShareLink,
)
from app.db.models.identity import (
    AuthSession,
    AuthToken,
    Identity,
    Membership,
    Organization,
    OrgInvite,
    User,
)
from app.db.models.logistics import Assignment, Court, ScheduleSlot, TournamentCourt, Venue
from app.db.models.participants import (
    PairingRequest,
    PairingRun,
    Participant,
    ProposedTeam,
    Registration,
    RosterEntry,
    Team,
)
from app.db.models.sport import PointsRule, SportProfile, TiebreakRuleset
from app.db.models.tournament import Division, Group, Round, Stage, Tournament

__all__ = [
    # identity
    "User",
    "Organization",
    "Membership",
    "Identity",
    "AuthSession",
    "AuthToken",
    "OrgInvite",
    # sport
    "SportProfile",
    "PointsRule",
    "TiebreakRuleset",
    # tournament
    "Tournament",
    "Division",
    "Stage",
    "Group",
    "Round",
    # participants
    "Team",
    "RosterEntry",
    "Participant",
    "Registration",
    "PairingRequest",
    "PairingRun",
    "ProposedTeam",
    # competition
    "Match",
    "MatchParticipant",
    "MatchResultEvent",
    "Standing",
    # logistics
    "Venue",
    "Court",
    "TournamentCourt",
    "ScheduleSlot",
    "Assignment",
    # crosscutting
    "ShareLink",
    "File",
    "Notification",
    "Outbox",
    "AuditLog",
    "IdempotencyKey",
    "FeatureFlag",
]
