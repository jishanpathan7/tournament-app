"""Auth domain event-type constants.

User-level security events are written to structured logs now (they have no org, so
they can't go to the org-scoped ``audit_logs``). These names are reserved for an
outbox-backed security feed later (``app.core.events.emit_event``)."""

USER_REGISTERED = "user.registered"
USER_LOGGED_IN = "user.logged_in"
USER_LOGGED_OUT = "user.logged_out"
EMAIL_VERIFIED = "user.email_verified"
PASSWORD_RESET = "user.password_reset"
PASSWORD_CHANGED = "user.password_changed"
REFRESH_REUSE_DETECTED = "user.refresh_reuse_detected"
