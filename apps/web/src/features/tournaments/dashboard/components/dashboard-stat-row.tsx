"use client";

import type { DashboardStat } from "@/features/tournaments/dashboard/config";
import { cn } from "@/lib/utils";

const TONE_BG: Record<NonNullable<DashboardStat["tone"]>, string> = {
  mint: "bg-mint-tint",
  candy: "bg-candy-tint",
  pink: "bg-pink-tint",
  yellow: "bg-yellow-tint",
  muted: "bg-muted/50",
};

export function DashboardStatRow({ stats }: { stats: DashboardStat[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={cn(
            "border-ink shadow-sticker-xs rounded-2xl border-2 p-4",
            TONE_BG[stat.tone ?? "muted"],
          )}
        >
          <p className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.2em]">
            {stat.label}
          </p>
          <p className="stat mt-1 font-mono text-3xl font-bold tabular-nums">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
