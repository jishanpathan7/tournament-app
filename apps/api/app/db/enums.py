"""Postgres ENUM types — the single source of truth for the DB enums.

Each class mirrors (or extends) the TypeScript unions in
`packages/shared/src/types.ts`. VALUES are the lowercase wire strings and must
match the TS side byte-for-byte (the generated API client depends on it).

Native PG enums are used for closed, UI-bound sets. Open-ended taxonomies
(`outbox.event_type`, `match_result_events.type`, `audit_logs.action/entity`,
`identities.provider`, `notifications.type`) are plain ``text`` columns instead.

FORWARD-ONLY: ``ALTER TYPE ... ADD VALUE`` cannot run inside a transaction block
alongside other DDL, and the new value is not usable until the transaction
commits; removing a value requires recreating the type and rewriting columns.
Treat enum changes as append-only migrations.
"""

from __future__ import annotations

import enum

import sqlalchemy as sa


class _StrEnum(str, enum.Enum):
    """str-valued enum so members serialize as their plain wire string."""

    def __str__(self) -> str:  # pragma: no cover - cosmetic
        return str(self.value)


# --- Mirrored from packages/shared/src/types.ts (values must match exactly) ---
class SkillLevel(_StrEnum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class ParticipantKind(_StrEnum):
    INDIVIDUAL = "individual"
    PAIR = "pair"
    TEAM = "team"
    SQUAD = "squad"  # franchise team — competes in team-vs-team ties


class ContestKind(_StrEnum):
    STANDARD = "standard"
    TIE = "tie"  # squad-vs-squad container
    LEG = "leg"  # doubles leg within a tie


class MatchStatus(_StrEnum):
    PENDING = "pending"  # bracket match whose sides aren't resolved yet (decision #1)
    SCHEDULED = "scheduled"
    LIVE = "live"
    COMPLETED = "completed"
    WALKOVER = "walkover"
    NO_SHOW = "no_show"
    CANCELLED = "cancelled"


class TournamentStatus(_StrEnum):
    DRAFT = "draft"
    REGISTRATION = "registration"
    SEEDING = "seeding"
    LIVE = "live"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class StageFormat(_StrEnum):
    ROUND_ROBIN = "round_robin"
    SINGLE_ELIM = "single_elim"
    GROUP_KNOCKOUT = "group_knockout"
    SWISS = "swiss"
    LADDER = "ladder"


# --- Additional enums (mirror into packages/shared/src/types.ts for parity) ---
class OrgRole(_StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    ORGANIZER = "organizer"
    SCOREKEEPER = "scorekeeper"
    VIEWER = "viewer"


class Visibility(_StrEnum):
    PUBLIC = "public"
    UNLISTED = "unlisted"
    PRIVATE = "private"


class ParticipantStatus(_StrEnum):
    REGISTERED = "registered"
    APPROVED = "approved"
    WAITLISTED = "waitlisted"
    WITHDRAWN = "withdrawn"
    REJECTED = "rejected"
    CHECKED_IN = "checked_in"


class RegistrationStatus(_StrEnum):
    SUBMITTED = "submitted"
    APPROVED = "approved"
    WAITLISTED = "waitlisted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class AttendanceStatus(_StrEnum):
    """Event-day attendance — kept separate from the registration-lifecycle ``status``
    so an approved participant can independently be pending / checked-in / absent
    (``ParticipantStatus.CHECKED_IN`` predates this and is left unused)."""

    PENDING = "pending"
    CHECKED_IN = "checked_in"
    ABSENT = "absent"


class MatchOutcome(_StrEnum):
    """Per-side outcome on match_participants — the abstract result the engine reads."""

    WIN = "win"
    LOSS = "loss"
    DRAW = "draw"
    RANK = "rank"


class AssignmentRole(_StrEnum):
    SCOREKEEPER = "scorekeeper"
    MARSHAL = "marshal"


class ShareLinkScope(_StrEnum):
    PUBLIC_VIEW = "public_view"
    CHECK_IN = "check_in"
    SCOREKEEPER = "scorekeeper"
    TEAM_INVITE = "team_invite"


class NotificationChannel(_StrEnum):
    EMAIL = "email"
    IN_APP = "in_app"


class NotificationPriority(_StrEnum):
    ACTION_REQUIRED = "action_required"
    IMPORTANT = "important"
    INFO = "info"


class NotificationStatus(_StrEnum):
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    READ = "read"
    RESOLVED = "resolved"


class FileKind(_StrEnum):
    ORG_LOGO = "org_logo"
    TOURNAMENT_LOGO = "tournament_logo"
    RULES_DOC = "rules_doc"
    EXPORT = "export"
    AVATAR = "avatar"


class FileStatus(_StrEnum):
    PENDING = "pending"
    READY = "ready"
    FAILED = "failed"


class OrgInviteStatus(_StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REVOKED = "revoked"
    EXPIRED = "expired"


class IdempotencyStatus(_StrEnum):
    STARTED = "started"
    COMPLETED = "completed"
    FAILED = "failed"


class AuthTokenPurpose(_StrEnum):
    EMAIL_VERIFICATION = "email_verification"
    PASSWORD_RESET = "password_reset"


class FeatureFlagScope(_StrEnum):
    GLOBAL = "global"
    ORGANIZATION = "organization"
    USER = "user"


class CourtStatus(_StrEnum):
    ACTIVE = "active"
    MAINTENANCE = "maintenance"
    DISABLED = "disabled"


class PairingRunStatus(_StrEnum):
    DRAFT = "draft"  # generated, under organizer review — not yet real participants
    PUBLISHED = "published"  # materialized into Team + pair Participant rows
    DISCARDED = "discarded"  # superseded by a regenerate or thrown away


def pg_enum(py_enum: type[enum.Enum], name: str) -> sa.Enum:
    """Build a named native PG ENUM bound to a Python enum.

    ``values_callable`` stores the enum *values* (lowercase wire strings), not the
    member names. ``create_type=False``: the type is created/dropped explicitly in
    the migration, so a type shared by several tables is not emitted more than once.
    """
    return sa.Enum(
        py_enum,
        name=name,
        native_enum=True,
        create_type=False,
        values_callable=lambda e: [m.value for m in e],
    )


# Named ENUM instances — imported by models (for columns) AND by the initial
# migration (to create/drop the types). One instance per type; reused across tables.
SKILL_LEVEL = pg_enum(SkillLevel, "skill_level")
PARTICIPANT_KIND = pg_enum(ParticipantKind, "participant_kind")
MATCH_STATUS = pg_enum(MatchStatus, "match_status")
TOURNAMENT_STATUS = pg_enum(TournamentStatus, "tournament_status")
STAGE_FORMAT = pg_enum(StageFormat, "stage_format")
ORG_ROLE = pg_enum(OrgRole, "org_role")
VISIBILITY = pg_enum(Visibility, "visibility")
PARTICIPANT_STATUS = pg_enum(ParticipantStatus, "participant_status")
REGISTRATION_STATUS = pg_enum(RegistrationStatus, "registration_status")
MATCH_OUTCOME = pg_enum(MatchOutcome, "match_outcome")
ASSIGNMENT_ROLE = pg_enum(AssignmentRole, "assignment_role")
SHARE_LINK_SCOPE = pg_enum(ShareLinkScope, "share_link_scope")
NOTIFICATION_CHANNEL = pg_enum(NotificationChannel, "notification_channel")
NOTIFICATION_STATUS = pg_enum(NotificationStatus, "notification_status")
NOTIFICATION_PRIORITY = pg_enum(NotificationPriority, "notification_priority")  # 0019
FILE_KIND = pg_enum(FileKind, "file_kind")
FILE_STATUS = pg_enum(FileStatus, "file_status")
ORG_INVITE_STATUS = pg_enum(OrgInviteStatus, "org_invite_status")
IDEMPOTENCY_STATUS = pg_enum(IdempotencyStatus, "idempotency_status")

# Added in later migrations (NOT part of the 0001 baseline below — each migration
# owns the enum types it introduces).
AUTH_TOKEN_PURPOSE = pg_enum(AuthTokenPurpose, "auth_token_purpose")  # 0002
FEATURE_FLAG_SCOPE = pg_enum(FeatureFlagScope, "feature_flag_scope")  # 0006
COURT_STATUS = pg_enum(CourtStatus, "court_status")  # 0010
PAIRING_RUN_STATUS = pg_enum(PairingRunStatus, "pairing_run_status")  # 0011
ATTENDANCE_STATUS = pg_enum(AttendanceStatus, "attendance_status")  # 0012
CONTEST_KIND = pg_enum(ContestKind, "contest_kind")  # 0016

# The 0001 baseline enum set. Consumed by the initial migration's
# upgrade()/downgrade(). Order is irrelevant (no inter-enum dependencies).
ALL_PG_ENUMS: list[sa.Enum] = [
    SKILL_LEVEL,
    PARTICIPANT_KIND,
    MATCH_STATUS,
    TOURNAMENT_STATUS,
    STAGE_FORMAT,
    ORG_ROLE,
    VISIBILITY,
    PARTICIPANT_STATUS,
    REGISTRATION_STATUS,
    MATCH_OUTCOME,
    ASSIGNMENT_ROLE,
    SHARE_LINK_SCOPE,
    NOTIFICATION_CHANNEL,
    NOTIFICATION_STATUS,
    NOTIFICATION_PRIORITY,
    FILE_KIND,
    FILE_STATUS,
    ORG_INVITE_STATUS,
    IDEMPOTENCY_STATUS,
]
