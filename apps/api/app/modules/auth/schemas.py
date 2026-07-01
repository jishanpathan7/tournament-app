"""Auth request/response schemas (camelCase on the wire via ApiModel)."""

from __future__ import annotations

import datetime
import uuid

from pydantic import EmailStr, Field

from app.api.schemas import ApiModel
from app.db.enums import OrgRole

PASSWORD_MIN_LENGTH = 8


class RegisterRequest(ApiModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=200)


class LoginRequest(ApiModel):
    email: EmailStr
    password: str
    remember_me: bool = False


class VerifyEmailConfirmRequest(ApiModel):
    token: str


class PasswordResetRequest(ApiModel):
    email: EmailStr


class PasswordResetConfirmRequest(ApiModel):
    token: str
    new_password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=200)


class ChangePasswordRequest(ApiModel):
    current_password: str
    new_password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=200)


class OrgSummary(ApiModel):
    id: uuid.UUID
    slug: str
    name: str
    role: OrgRole


class MeResponse(ApiModel):
    id: uuid.UUID
    email: str
    name: str
    email_verified: bool
    active_organization_id: uuid.UUID | None
    active_role: OrgRole | None
    organizations: list[OrgSummary]


class SessionItem(ApiModel):
    id: uuid.UUID
    created_at: datetime.datetime
    expires_at: datetime.datetime
    ip: str | None
    user_agent: str | None
    current: bool
