"""Application settings, loaded from environment (.env in dev)."""

from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    app_name: str = "Tournament Platform API"
    version: str = "0.1.0"
    api_v1_prefix: str = "/api/v1"

    app_base_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"
    cors_origins: str = "http://localhost:3000"

    database_url: str | None = None

    jwt_secret: str = "dev-insecure-change-me"
    jwt_algorithm: str = "HS256"
    access_token_ttl: int = 900  # 15m
    refresh_token_ttl: int = 2_592_000  # 30d server-side session lifetime
    email_verification_token_ttl: int = 86_400  # 24h
    password_reset_token_ttl: int = 3_600  # 1h

    # Cookies (secure/samesite finalized per request scheme; secure enforced in prod).
    cookie_domain: str | None = None
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    access_cookie_name: str = "access_token"
    refresh_cookie_name: str = "refresh_token"
    csrf_cookie_name: str = "csrf_token"

    # Brute-force throttle (in-process at MVP; Redis later behind LoginThrottle port).
    login_max_attempts: int = 10
    login_attempt_window: int = 900  # 15m sliding window

    # Google OAuth — endpoints stay inert until all three are set.
    google_client_id: str | None = None
    google_client_secret: str | None = None
    google_redirect_uri: str | None = None

    # Email — LogEmailChannel default until an API key is set.
    resend_api_key: str | None = None
    email_from: str = "Tournament Platform <noreply@localhost>"

    sentry_dsn: str | None = None
    log_level: str = "INFO"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def google_oauth_configured(self) -> bool:
        return bool(
            self.google_client_id and self.google_client_secret and self.google_redirect_uri
        )

    @model_validator(mode="after")
    def _fail_fast_in_production(self) -> "Settings":
        """Refuse to boot with insecure/missing config in production."""
        if self.is_production:
            problems = []
            if self.jwt_secret == "dev-insecure-change-me":
                problems.append("JWT_SECRET must be set")
            if not self.database_url:
                problems.append("DATABASE_URL must be set")
            if not self.cookie_secure:
                problems.append("COOKIE_SECURE must be true")
            if problems:
                raise ValueError("Invalid production configuration: " + "; ".join(problems))
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
