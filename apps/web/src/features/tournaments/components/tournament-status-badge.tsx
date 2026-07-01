import type { TournamentStatus } from "@tournament/api-client";

import { Badge } from "@/components/ui/badge";
import { TOURNAMENT_STATUS } from "@/features/tournaments/config";
import { cn } from "@/lib/utils";

/** Status badge with the design-system tone + a pulsing dot for Live (never color-only). */
export function TournamentStatusBadge({ status }: { status: string }) {
  const meta = TOURNAMENT_STATUS[status as TournamentStatus] ?? {
    label: status,
    tone: "muted" as const,
    description: "",
  };
  return (
    <Badge tone={meta.tone}>
      {meta.live ? (
        <span className="bg-pink-dark h-1.5 w-1.5 animate-pulse rounded-full" aria-hidden />
      ) : null}
      {meta.label}
    </Badge>
  );
}

/** Small helper for arbitrary states (visibility, participant status) elsewhere. */
export function DotBadge({
  tone,
  label,
  className,
}: {
  tone: React.ComponentProps<typeof Badge>["tone"];
  label: string;
  className?: string;
}) {
  return (
    <Badge tone={tone} className={cn(className)}>
      {label}
    </Badge>
  );
}
