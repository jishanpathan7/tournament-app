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
    access_token_ttl: int = 900
    refresh_token_ttl: int = 2_592_000

    sentry_dsn: str | None = None
    log_level: str = "INFO"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @model_validator(mode="after")
    def _fail_fast_in_production(self) -> "Settings":
        """Refuse to boot with insecure/missing config in production."""
        if self.is_production:
            problems = []
            if self.jwt_secret == "dev-insecure-change-me":
                problems.append("JWT_SECRET must be set")
            if not self.database_url:
                problems.append("DATABASE_URL must be set")
            if problems:
                raise ValueError("Invalid production configuration: " + "; ".join(problems))
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
