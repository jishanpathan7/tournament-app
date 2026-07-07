"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Root-level error boundary (Next.js 15 convention).
 * Catches crashes in the root layout itself — must render its own <html>/<body>.
 * Reports to Sentry if DSN is configured.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#fafaf9",
          color: "#1c1917",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            textAlign: "center",
            padding: "2rem",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              width: 64,
              height: 64,
              borderRadius: "1rem",
              background: "#fff0f3",
              border: "2px solid #f9a8d4",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1.5rem",
            }}
            aria-hidden
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#db2777"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>

          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: "0.75rem",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#78716c",
              marginBottom: "2rem",
              lineHeight: 1.6,
            }}
          >
            An unexpected error occurred. Our team has been notified.
            {error.digest ? (
              <>
                {" "}
                (ref: <code style={{ fontFamily: "monospace" }}>{error.digest}</code>)
              </>
            ) : null}
          </p>

          <button
            onClick={reset}
            style={{
              background: "#f9a8d4",
              border: "2px solid #db2777",
              borderRadius: "0.5rem",
              padding: "0.5rem 1.5rem",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.875rem",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
