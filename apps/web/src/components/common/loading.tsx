import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** Centered spinner for full-panel/route loading (design system §10). */
export function LoadingPanel({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-20", className)}>
      <Spinner className="h-6 w-6" />
      <p className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.22em]">
        {label}
      </p>
    </div>
  );
}

/** Skeleton grid of sticker cards — dashboards/lists while data loads. */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-40 rounded-2xl" />
      ))}
    </div>
  );
}

/** Skeleton rows with hairline dividers — Functional-tier tables (design system §10). */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="border-ink divide-border bg-card overflow-hidden rounded-2xl border-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-border flex items-center gap-4 border-b p-4 last:border-b-0">
          <Skeleton className="h-4 w-8 border-0" />
          <Skeleton className="h-4 flex-1 border-0" />
          <Skeleton className="h-4 w-16 border-0" />
        </div>
      ))}
    </div>
  );
}
