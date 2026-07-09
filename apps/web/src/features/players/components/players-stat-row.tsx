"use client";

import type { PlayerStats } from "@/features/players/players-config";
import { Link2, Star } from "lucide-react";

import { cn } from "@/lib/utils";

const DEFAULT_STATS = [
  { key: "total", label: "Total", tone: "bg-card" },
  { key: "confirmed", label: "Confirmed", tone: "bg-mint-tint" },
  { key: "checkedIn", label: "Checked in", tone: "bg-candy-tint" },
  { key: "needsReview", label: "Needs review", tone: "bg-pink-tint" },
] as const;

type StatKey = keyof PlayerStats;

function StatTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={cn("border-ink shadow-sticker-xs rounded-2xl border-2 p-4", tone)}>
      <p className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.2em]">
        {label}
      </p>
      <p className="stat mt-1 font-mono text-3xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export function PlayersStatRow({ stats }: { stats: PlayerStats }) {
  const franchisePaired = (stats.pairs ?? 0) > 0;

  if (franchisePaired) {
    const tiles: { key: StatKey; label: string; tone: string }[] = [
      { key: "confirmed", label: "Players", tone: "bg-mint-tint" },
      { key: "pairs", label: "Pairs", tone: "bg-candy-tint" },
      ...(stats.franchiseTeams && stats.franchiseTeams > 0
        ? [{ key: "franchiseTeams" as const, label: "Franchise teams", tone: "bg-yellow-tint" }]
        : []),
      { key: "checkedIn", label: "Checked in", tone: "bg-card" },
      { key: "needsReview", label: "Needs review", tone: "bg-pink-tint" },
    ];

    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map(({ key, label, tone }) => (
          <StatTile key={key} label={label} value={stats[key] ?? 0} tone={tone} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {DEFAULT_STATS.map(({ key, label, tone }) => (
        <StatTile key={key} label={label} value={stats[key]} tone={tone} />
      ))}
    </div>
  );
}

/** Compact inline chips for headers or toolbars. */
export function FranchiseRosterChips({ stats }: { stats: PlayerStats }) {
  if ((stats.pairs ?? 0) === 0) return null;
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
      <span className="inline-flex items-center gap-1.5">
        <Link2 className="h-3.5 w-3.5" aria-hidden />
        <span className="text-ink font-semibold tabular-nums">{stats.pairs}</span> pairs
      </span>
      {(stats.franchiseTeams ?? 0) > 0 ? (
        <span className="inline-flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5" aria-hidden />
          <span className="text-ink font-semibold tabular-nums">{stats.franchiseTeams}</span>{" "}
          franchise teams
        </span>
      ) : null}
    </div>
  );
}
