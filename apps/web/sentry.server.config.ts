import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    // Do not log PII from request bodies.
    beforeSend(event) {
      delete event.request?.data;
      return event;
    },
  });
}
