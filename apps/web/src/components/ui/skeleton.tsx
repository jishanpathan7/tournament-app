import { cn } from "@/lib/utils";

/**
 * Loading skeleton — cream/muted block, 2px ink border, NO blur (opacity pulse only,
 * honoring reduced-motion via the global rule). See design system §10.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-ink/15 bg-muted animate-pulse rounded-xl border-2", className)}
      {...props}
    />
  );
}
