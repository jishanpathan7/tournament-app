"use client";

import type { PlayerStats } from "@/features/players/players-config";
import { cn } from "@/lib/utils";

const STATS = [
  { key: "total", label: "Total", tone: "bg-card" },
  { key: "confirmed", label: "Confirmed", tone: "bg-mint-tint" },
  { key: "checkedIn", label: "Checked in", tone: "bg-candy-tint" },
  { key: "needsReview", label: "Needs review", tone: "bg-pink-tint" },
] as const;

export function PlayersStatRow({ stats }: { stats: PlayerStats }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {STATS.map(({ key, label, tone }) => (
        <div
          key={key}
          className={cn("border-ink shadow-sticker-xs rounded-2xl border-2 p-4", tone)}
        >
          <p className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.2em]">
            {label}
          </p>
          <p className="stat mt-1 font-mono text-3xl font-bold tabular-nums">{stats[key]}</p>
        </div>
      ))}
    </div>
  );
}
