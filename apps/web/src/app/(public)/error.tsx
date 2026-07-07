"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { ErrorState } from "@/components/common/error-state";

export default function PublicError({
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
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-4">
      <ErrorState error={error} onRetry={reset} title="This page couldn't load" />
    </div>
  );
}
