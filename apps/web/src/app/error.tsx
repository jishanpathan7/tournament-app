"use client";

import { ErrorState } from "@/components/common/error-state";

/** Route-segment error boundary (Next convention). Keeps failures on-brand + recoverable. */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-4">
      <ErrorState error={error} onRetry={reset} />
    </div>
  );
}
