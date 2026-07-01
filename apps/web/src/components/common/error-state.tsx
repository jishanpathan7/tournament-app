import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/problem";
import { cn } from "@/lib/utils";

/**
 * Inline error surface for a failed query/section. Pink (never red) + icon, with an
 * optional retry. Use at the panel level so the rest of the shell keeps working.
 */
export function ErrorState({
  error,
  onRetry,
  title = "Something went wrong",
  className,
}: {
  error?: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center gap-4 px-6 py-14 text-center", className)}
    >
      <div className="border-pink bg-pink-tint text-pink-dark rounded-blob shadow-sticker-xs flex h-16 w-16 items-center justify-center border-2">
        <AlertTriangle className="h-7 w-7" strokeWidth={2} aria-hidden />
      </div>
      <h2 className="font-serif text-xl font-semibold tracking-tight">{title}</h2>
      <p className="text-muted-foreground max-w-sm text-sm">{errorMessage(error)}</p>
      {onRetry ? (
        <Button tone="paper" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
