import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Only initialise when a DSN is configured (dev/CI skips).
if (dsn) {
  Sentry.init({
    dsn,
    // Capture 10 % of transactions in production for performance tracing.
    tracesSampleRate: 0.1,
    // Capture 10 % of sessions for session replay.
    replaysSessionSampleRate: 0.1,
    // Always replay sessions that had an error.
    replaysOnErrorSampleRate: 1.0,
    integrations: [Sentry.replayIntegration()],
    // Strip PII: do not send query-string or fragment from URL.
    beforeSend(event) {
      if (event.request?.url) {
        try {
          const u = new URL(event.request.url);
          event.request.url = u.origin + u.pathname;
        } catch {
          // malformed URL — leave as-is
        }
      }
      return event;
    },
  });
}
