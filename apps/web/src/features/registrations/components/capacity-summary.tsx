import { Clock, ListTodo, Users } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { CapacitySummary } from "@/features/registrations/capacity";
import { cn } from "@/lib/utils";

function StatChip({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  tint: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "border-ink flex h-9 w-9 items-center justify-center rounded-xl border-2",
          tint,
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      </span>
      <span className="flex flex-col">
        <span className="text-xl font-extrabold tabular-nums leading-none">{value}</span>
        <span className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.16em]">
          {label}
        </span>
      </span>
    </div>
  );
}

/** Approved / remaining / waitlist / pending, with a fill bar when the division has a capacity limit. */
export function CapacitySummaryBar({ summary }: { summary: CapacitySummary }) {
  const pct =
    summary.capacity && summary.capacity > 0
      ? Math.min(100, Math.round((summary.approved / summary.capacity) * 100))
      : null;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <StatChip icon={Users} label="Approved" value={summary.approved} tint="bg-mint-tint" />
          <StatChip icon={ListTodo} label="Pending" value={summary.pending} tint="bg-candy-tint" />
          <StatChip
            icon={Clock}
            label="Waitlisted"
            value={summary.waitlisted}
            tint="bg-yellow-tint"
          />
        </div>
        {summary.capacity !== null ? (
          <span className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.16em]">
            {summary.remaining} of {summary.capacity} slots remaining
          </span>
        ) : (
          <span className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.16em]">
            No capacity limit
          </span>
        )}
      </div>
      {pct !== null ? (
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Approved capacity"
          className="border-ink bg-muted h-2.5 overflow-hidden rounded-full border-2"
        >
          <div
            className={cn("h-full rounded-full", summary.isFull ? "bg-pink" : "bg-candy")}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </Card>
  );
}
