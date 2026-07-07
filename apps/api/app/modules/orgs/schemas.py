"""Organization request/response schemas (camelCase via ApiModel)."""

from __future__ import annotations

import datetime
import uuid
from typing import Any

from pydantic import EmailStr, Field

from app.api.schemas import ApiModel
from app.db.enums import OrgInviteStatus, OrgRole


class CreateOrgRequest(ApiModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=2, max_length=120, pattern=r"^[a-z0-9][a-z0-9-]*$")


class UpdateOrgRequest(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    timezone: str | None = Field(default=None, max_length=64)
    branding: dict[str, Any] | None = None
    emails_enabled: bool | None = None


class SwitchOrgRequest(ApiModel):
    organization_id: uuid.UUID


class OrgResponse(ApiModel):
    id: uuid.UUID
    slug: str
    name: str
    timezone: str
    plan: str
    branding: dict[str, Any]
    emails_enabled: bool


class MemberItem(ApiModel):
    user_id: uuid.UUID
    email: str
    name: str
    role: OrgRole
    joined_at: datetime.datetime


class UpdateMemberRoleRequest(ApiModel):
    role: OrgRole


class CreateInviteRequest(ApiModel):
    email: EmailStr
    role: OrgRole


class InviteItem(ApiModel):
    id: uuid.UUID
    email: str
    role: OrgRole
    status: OrgInviteStatus
    expires_at: datetime.datetime
    created_at: datetime.datetime


class AcceptInviteRequest(ApiModel):
    token: str
