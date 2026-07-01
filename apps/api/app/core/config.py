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

    # Object storage — Cloudflare R2 (S3 API) in prod; local disk fallback in dev.
    # When the four r2_* below are set the R2 backend is used automatically.
    r2_account_id: str | None = None
    r2_access_key_id: str | None = None
    r2_secret_access_key: str | None = None
    r2_bucket: str | None = None
    r2_endpoint_url: str | None = None  # defaults to https://<account>.r2.cloudflarestorage.com
    r2_public_base_url: str | None = None  # public bucket / custom domain for public_url()
    storage_local_dir: str = ".storage"  # dev disk root (gitignored)
    storage_presign_ttl: int = 900  # 15m default lifetime for presigned PUT/GET URLs
    storage_max_upload_size: int = 52_428_800  # 50MB hard ceiling across all kinds

    # Cache / Redis — in-process cache at MVP; set REDIS_URL to move cache (and later
    # pub/sub + jobs) onto Redis/Upstash when scaling to a 2nd instance.
    redis_url: str | None = None
    cache_default_ttl: int = 300  # 5m default for cached entries

    # Background jobs (in-process outbox poller). Runs inside the API lifespan at MVP;
    # disable to run a standalone worker (python -m app.workers) or in tests.
    worker_enabled: bool = True
    worker_poll_interval: float = 2.0  # seconds to sleep when the queue is idle
    worker_batch_size: int = 20  # rows drained per poll cycle
    worker_max_attempts: int = 5  # dead-letter a job after this many failures
    outbox_retention_days: int = 7  # processed outbox rows older than this are purged

    # Realtime — SSE transport at MVP; WebSocket/Ably/Pusher slot in behind the seam.
    realtime_transport: str = "sse"
    realtime_ping_interval: int = 15  # SSE heartbeat seconds (keeps the connection alive)
    realtime_max_queue: int = 100  # per-subscriber buffer before events drop

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

    @property
    def r2_configured(self) -> bool:
        return bool(
            self.r2_account_id
            and self.r2_access_key_id
            and self.r2_secret_access_key
            and self.r2_bucket
        )

    @property
    def r2_endpoint(self) -> str | None:
        if self.r2_endpoint_url:
            return self.r2_endpoint_url
        if self.r2_account_id:
            return f"https://{self.r2_account_id}.r2.cloudflarestorage.com"
        return None

    @property
    def storage_backend(self) -> str:
        """'r2' when credentials are present, else the dev 'local' disk backend."""
        return "r2" if self.r2_configured else "local"

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
