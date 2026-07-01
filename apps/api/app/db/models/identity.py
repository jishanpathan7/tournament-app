"""Identity, tenancy & auth tables (global plane — see app/db/rls.py for RLS scope).

`users`, `organizations`, `memberships`, `identities`, `auth_sessions`, `org_invites`
are NOT RLS-managed: they are read before/around an org context exists (login,
org creation, enumerating memberships, accepting an invite). The auth layer guards
them at the app level.
"""

from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import AUTH_TOKEN_PURPOSE, ORG_INVITE_STATUS, ORG_ROLE
from app.db.mixins import OrgScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.db.models.tournament import Tournament


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"
    # Case-insensitive unique email (avoids the citext extension dependency).
    __table_args__ = (Index("uq_users_email_ci", text("lower(email)"), unique=True),)

    email: Mapped[str] = mapped_column(String(320), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # References files.id; no DB FK to avoid a users<->files circular dependency.
    avatar_file_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'active'"))
    email_verified_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_login_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # org_id/user_id FKs are RESTRICT, so no ORM delete-cascade here.
    memberships: Mapped[list[Membership]] = relationship(back_populates="user")
    # CI-unique on lower(email) is created in the initial migration.


class Organization(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "organizations"

    slug: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    branding: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, server_default=text("'UTC'"))
    plan: Mapped[str] = mapped_column(String(40), nullable=False, server_default=text("'free'"))
    # use_alter breaks the organizations <-> sport_profiles FK cycle at create time.
    default_sport_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "sport_profiles.id",
            ondelete="RESTRICT",
            use_alter=True,
            name="fk_organizations_default_sport_profile_id_sport_profiles",
        ),
        nullable=True,
    )

    memberships: Mapped[list[Membership]] = relationship(back_populates="organization")
    tournaments: Mapped[list[Tournament]] = relationship(back_populates="organization")


class Membership(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("user_id", "organization_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    org_role: Mapped[str] = mapped_column(ORG_ROLE, nullable=False)

    user: Mapped[User] = relationship(back_populates="memberships")
    organization: Mapped[Organization] = relationship(back_populates="memberships")


class Identity(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """OAuth / SSO link for a user (post-MVP auth)."""

    __tablename__ = "identities"
    __table_args__ = (UniqueConstraint("provider", "provider_subject"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    provider_subject: Mapped[str] = mapped_column(String(255), nullable=False)


class AuthSession(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Refresh/session record (rotation + reuse-detection). Global; keyed by user."""

    __tablename__ = "auth_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    expires_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip: Mapped[str | None] = mapped_column(INET, nullable=True)


class OrgInvite(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    """Email invite to join an org with a role (token-based acceptance)."""

    __tablename__ = "org_invites"

    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    org_role: Mapped[str] = mapped_column(ORG_ROLE, nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    invited_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        ORG_INVITE_STATUS, nullable=False, server_default=text("'pending'")
    )
    expires_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    accepted_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class AuthToken(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Single-use, expiring token for email verification / password reset (NO_RLS)."""

    __tablename__ = "auth_tokens"
    __table_args__ = (Index("ix_auth_tokens_user_id_purpose", "user_id", "purpose"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    purpose: Mapped[str] = mapped_column(AUTH_TOKEN_PURPOSE, nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    expires_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
