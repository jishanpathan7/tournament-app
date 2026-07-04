"""Franchise squads — tournament-level player groupings before pairing or draw.

Distinct from ``teams`` (competition units / doubles pairs). A squad groups registrations
across divisions so organizers can balance skill before Smart Pairing runs.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import OrgScopedMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.db.models.participants import Registration
    from app.db.models.tournament import Tournament


class Squad(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "squads"

    tournament_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tournaments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    captain_registration_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("registrations.id", ondelete="SET NULL"),
        nullable=True,
    )

    tournament: Mapped[Tournament] = relationship(back_populates="squads")
    members: Mapped[list[SquadMember]] = relationship(
        back_populates="squad",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class SquadMember(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    __tablename__ = "squad_members"
    __table_args__ = (
        UniqueConstraint("registration_id", name="uq_squad_members_registration_id"),
        Index("ix_squad_members_squad_id", "squad_id"),
    )

    squad_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("squads.id", ondelete="CASCADE"),
        nullable=False,
    )
    registration_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("registrations.id", ondelete="CASCADE"),
        nullable=False,
    )

    squad: Mapped[Squad] = relationship(back_populates="members")
    registration: Mapped[Registration] = relationship()
