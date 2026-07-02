import type { StageResponse, TournamentResponse } from "@tournament/api-client";

import { Badge } from "@/components/ui/badge";
import { DRAW_STATUS_META, drawStatusFlags } from "@/features/draws/config";

/** Shows the subset of {generated, published, locked, live} that's actually true — these
 * aren't mutually exclusive (a live tournament's draw is usually generated + locked too). */
export function DrawStatusBadges({
  stage,
  tournament,
}: {
  stage: StageResponse;
  tournament: TournamentResponse;
}) {
  const flags = drawStatusFlags(stage, tournament);
  const active = (Object.keys(flags) as (keyof typeof flags)[]).filter((key) => flags[key]);

  if (active.length === 0) {
    return <Badge tone="muted">Not generated</Badge>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {active.map((key) => (
        <Badge key={key} tone={DRAW_STATUS_META[key].tone}>
          {DRAW_STATUS_META[key].label}
        </Badge>
      ))}
    </div>
  );
}
