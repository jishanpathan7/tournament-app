"""Pydantic schemas for the tournament-members module."""

from __future__ import annotations

import datetime

from pydantic import EmailStr

from app.api.schemas import ApiModel
from app.db.enums import TournamentInviteStatus, TournamentRole


class TournamentMemberResponse(ApiModel):
    id: str
    user_id: str
    tournament_id: str
    tournament_role: TournamentRole
    name: str
    email: str
    invited_by: str | None
    accepted_at: datetime.datetime | None
    created_at: datetime.datetime


class TournamentInviteResponse(ApiModel):
    id: str
    email: str
    tournament_id: str
    tournament_role: TournamentRole
    status: TournamentInviteStatus
    expires_at: datetime.datetime
    created_at: datetime.datetime


class InviteTournamentMemberRequest(ApiModel):
    email: EmailStr
    tournament_role: TournamentRole


class UpdateTournamentMemberRoleRequest(ApiModel):
    tournament_role: TournamentRole


class TournamentMembersListResponse(ApiModel):
    members: list[TournamentMemberResponse]
    pending_invites: list[TournamentInviteResponse]


class ResolveTournamentRoleResponse(ApiModel):
    tournament_role: TournamentRole | None
    effective_role: str  # the role string used for authz (tournament_role or org_role)
    source: str  # "tournament" | "org"


class GenerateInviteLinkRequest(ApiModel):
    tournament_role: TournamentRole


class InviteLinkResponse(ApiModel):
    token: str
    expires_at: datetime.datetime
