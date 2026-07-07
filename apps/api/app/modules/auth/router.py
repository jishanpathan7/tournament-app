"""Auth HTTP endpoints. Thin: cookies + delegation to the service.

Identity tables are NO_RLS, so everything runs on get_session / get_tx_session
(no org context). Mutations that already carry an authenticated session add
``csrf_protect``; public bootstrap endpoints (login/register/refresh/reset/verify)
are CSRF-exempt by construction.
"""

from __future__ import annotations

import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth_context import CurrentUser, get_current_user
from app.api.deps import authed_csrf, csrf_protect, get_tx_session
from app.api.errors import AuthenticationError, PermissionDeniedError
from app.core import oauth, security
from app.core.config import Settings, get_settings
from app.core.db import get_session
from app.core.factory import get_email_channel, get_login_throttle
from app.core.limiter import limiter
from app.core.ports import EmailChannel, LoginThrottle
from app.modules.auth import repository as repo
from app.modules.auth import service
from app.modules.auth.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    MeResponse,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    RegisterRequest,
    SessionItem,
    VerifyEmailConfirmRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])

OAUTH_STATE_COOKIE = "oauth_state"


def _secure(request: Request, settings: Settings) -> bool:
    return settings.cookie_secure or request.url.scheme == "https"


def _client(request: Request) -> tuple[str | None, str | None]:
    ip = request.client.host if request.client else None
    return ip, request.headers.get("user-agent")


def _apply_bundle(response: Response, request: Request, bundle: service.TokenBundle) -> None:
    security.set_auth_cookies(
        response,
        access_token=bundle.access_token,
        refresh_token=bundle.refresh_token,
        csrf_token=bundle.csrf_token,
        secure=_secure(request, get_settings()),
        remember=bundle.remember,
    )


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(
    body: RegisterRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_tx_session),
    email_channel: EmailChannel = Depends(get_email_channel),
) -> MeResponse:
    ip, user_agent = _client(request)
    result = await service.register(
        session,
        email=body.email,
        name=body.name,
        password=body.password,
        email_channel=email_channel,
        ip=ip,
        user_agent=user_agent,
    )
    # Registration signs the user in (sets auth cookies) so onboarding can proceed directly.
    _apply_bundle(response, request, result.bundle)
    return service.build_me(
        result.user, result.organization_id, result.org_role, result.memberships
    )


@router.post("/login")
@limiter.limit("20/minute")
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_tx_session),
    throttle: LoginThrottle = Depends(get_login_throttle),
) -> MeResponse:
    ip, user_agent = _client(request)
    result = await service.authenticate(
        session,
        email=body.email,
        password=body.password,
        remember=body.remember_me,
        ip=ip,
        user_agent=user_agent,
        throttle=throttle,
    )
    _apply_bundle(response, request, result.bundle)
    return service.build_me(
        result.user, result.organization_id, result.org_role, result.memberships
    )


@router.post("/refresh")
async def refresh(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_tx_session),
) -> MeResponse:
    settings = get_settings()
    raw_refresh = request.cookies.get(settings.refresh_cookie_name)
    if not raw_refresh:
        raise AuthenticationError("No refresh token")
    ip, user_agent = _client(request)
    result = await service.rotate(
        session,
        raw_refresh=raw_refresh,
        access_token=request.cookies.get(settings.access_cookie_name),
        ip=ip,
        user_agent=user_agent,
    )
    _apply_bundle(response, request, result.bundle)
    return service.build_me(
        result.user, result.organization_id, result.org_role, result.memberships
    )


@router.post(
    "/logout", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(csrf_protect)]
)
async def logout(
    request: Request, response: Response, session: AsyncSession = Depends(get_tx_session)
) -> None:
    raw_refresh = request.cookies.get(get_settings().refresh_cookie_name)
    if raw_refresh:
        await service.logout_current(session, raw_refresh=raw_refresh)
    security.clear_auth_cookies(response)


@router.post(
    "/logout-all", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(csrf_protect)]
)
async def logout_all(
    request: Request, response: Response, session: AsyncSession = Depends(get_tx_session)
) -> None:
    raw_refresh = request.cookies.get(get_settings().refresh_cookie_name)
    if raw_refresh:
        await service.logout_all_by_refresh(session, raw_refresh=raw_refresh)
    security.clear_auth_cookies(response)


@router.get("/sessions")
async def list_sessions(
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[SessionItem]:
    rows = await service.list_sessions(session, user_id=current.user_id)
    return [
        SessionItem(
            id=row.id,
            created_at=row.created_at,
            expires_at=row.expires_at,
            ip=str(row.ip) if row.ip is not None else None,
            user_agent=row.user_agent,
            current=row.id == current.session_id,
        )
        for row in rows
    ]


@router.delete(
    "/sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(authed_csrf)],
)
async def revoke_session(
    session_id: uuid.UUID,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_tx_session),
) -> None:
    await service.revoke_session(session, user_id=current.user_id, session_id=session_id)


@router.post(
    "/verify-email/request",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(authed_csrf)],
)
async def request_email_verification(
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_tx_session),
    email_channel: EmailChannel = Depends(get_email_channel),
) -> None:
    await service.request_email_verification(
        session, user_id=current.user_id, email_channel=email_channel
    )


@router.post("/verify-email/confirm", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def confirm_email(
    body: VerifyEmailConfirmRequest,
    request: Request,
    session: AsyncSession = Depends(get_tx_session),
) -> None:
    await service.confirm_email(session, raw_token=body.token)


@router.post("/password-reset/request", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/minute")
async def request_password_reset(
    body: PasswordResetRequest,
    request: Request,
    session: AsyncSession = Depends(get_tx_session),
    email_channel: EmailChannel = Depends(get_email_channel),
) -> None:
    await service.request_password_reset(session, email=body.email, email_channel=email_channel)


@router.post("/password-reset/confirm", status_code=status.HTTP_204_NO_CONTENT)
async def confirm_password_reset(
    body: PasswordResetConfirmRequest, session: AsyncSession = Depends(get_tx_session)
) -> None:
    await service.confirm_password_reset(
        session, raw_token=body.token, new_password=body.new_password
    )


@router.post(
    "/password/change",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(authed_csrf)],
)
async def change_password(
    body: ChangePasswordRequest,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_tx_session),
) -> None:
    await service.change_password(
        session,
        user_id=current.user_id,
        current_session_id=current.session_id,
        current_password=body.current_password,
        new_password=body.new_password,
    )


@router.get("/me")
async def me(
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MeResponse:
    user = await repo.get_user_by_id(session, current.user_id)
    if user is None:
        raise AuthenticationError("User not found")
    memberships = await repo.list_memberships(session, current.user_id)
    return service.build_me(user, current.organization_id, current.org_role, memberships)


@router.get("/google/authorize")
async def google_authorize(request: Request) -> RedirectResponse:
    provider = oauth.get_google_provider()
    if provider is None:
        raise HTTPException(status_code=501, detail="Google OAuth is not configured")
    state = security.new_opaque_token()
    redirect = RedirectResponse(url=provider.authorize_url(state), status_code=302)
    redirect.set_cookie(
        OAUTH_STATE_COOKIE,
        state,
        httponly=True,
        secure=_secure(request, get_settings()),
        samesite="lax",
        max_age=600,
        path="/api/v1/auth",
    )
    return redirect


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: str,
    state: str,
    session: AsyncSession = Depends(get_tx_session),
) -> RedirectResponse:
    provider = oauth.get_google_provider()
    if provider is None:
        raise HTTPException(status_code=501, detail="Google OAuth is not configured")
    settings = get_settings()
    cookie_state = request.cookies.get(OAUTH_STATE_COOKIE)
    if not cookie_state or not secrets.compare_digest(cookie_state, state):
        raise PermissionDeniedError("Invalid OAuth state", code="oauth_state")
    try:
        info = await provider.exchange(code)
    except Exception as exc:  # noqa: BLE001 - any exchange failure → 401
        raise AuthenticationError("OAuth exchange failed") from exc
    ip, user_agent = _client(request)
    result = await service.oauth_login(session, info=info, ip=ip, user_agent=user_agent)
    redirect = RedirectResponse(url=settings.frontend_url, status_code=303)
    _apply_bundle(redirect, request, result.bundle)
    redirect.delete_cookie(OAUTH_STATE_COOKIE, path="/api/v1/auth")
    return redirect
