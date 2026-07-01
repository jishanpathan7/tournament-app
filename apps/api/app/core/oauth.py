"""Google OAuth (authorization-code flow), hand-rolled with httpx — no authlib.

Inert until GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI are set
(``get_google_provider`` returns None → the endpoints answer 501). The provider
Protocol is the seam for adding more providers later.
"""

from __future__ import annotations

import urllib.parse
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from app.core.config import Settings, get_settings

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


@dataclass(frozen=True)
class OAuthUserInfo:
    provider: str
    subject: str
    email: str
    name: str
    email_verified: bool


class OAuthProvider(Protocol):
    name: str

    def authorize_url(self, state: str) -> str: ...

    async def exchange(self, code: str) -> OAuthUserInfo: ...


class GoogleOAuthProvider:
    name = "google"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def authorize_url(self, state: str) -> str:
        params: dict[str, str] = {
            "client_id": self._settings.google_client_id or "",
            "redirect_uri": self._settings.google_redirect_uri or "",
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
            "prompt": "select_account",
        }
        return f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"

    async def exchange(self, code: str) -> OAuthUserInfo:
        async with httpx.AsyncClient(timeout=10.0) as client:
            token_resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": self._settings.google_client_id or "",
                    "client_secret": self._settings.google_client_secret or "",
                    "redirect_uri": self._settings.google_redirect_uri or "",
                    "grant_type": "authorization_code",
                },
            )
            token_resp.raise_for_status()
            access_token = token_resp.json()["access_token"]
            info_resp = await client.get(
                GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}
            )
            info_resp.raise_for_status()
            data: dict[str, Any] = info_resp.json()
        return OAuthUserInfo(
            provider="google",
            subject=str(data["sub"]),
            email=data["email"],
            name=data.get("name") or data.get("email", ""),
            email_verified=bool(data.get("email_verified", False)),
        )


def get_google_provider(settings: Settings | None = None) -> GoogleOAuthProvider | None:
    settings = settings or get_settings()
    if not settings.google_oauth_configured:
        return None
    return GoogleOAuthProvider(settings)
