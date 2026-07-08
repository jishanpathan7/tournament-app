"use client";

import { Clock, Radio, Swords, Timer, Trophy, Users } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import type { OpsSummary } from "@/features/matches/config";
import { cn } from "@/lib/utils";

function SummaryCard({
  icon: Icon,
  label,
  value,
  tint,
  href,
}: {
  icon: typeof Radio;
  label: string;
  value: number | string;
  tint: string;
  href?: string;
}) {
  const content = (
    <Card className={cn("border-ink shadow-sticker-xs border-2 p-4", tint)}>
      <div className="flex items-center gap-3">
        <span className="border-ink bg-card flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2">
          <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.16em]">
            {label}
          </p>
          <p className="stat font-mono text-2xl font-bold tabular-nums">{value}</p>
        </div>
      </div>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block transition-opacity hover:opacity-90">
        {content}
      </Link>
    );
  }
  return content;
}

export function OpsSummaryRow({
  summary,
  courtsHref,
}: {
  summary: OpsSummary;
  courtsHref?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <SummaryCard icon={Radio} label="Live now" value={summary.live} tint="bg-mint-tint" />
      <SummaryCard
        icon={Timer}
        label="Waiting to start"
        value={summary.waitingToStart}
        tint="bg-yellow-tint"
      />
      <SummaryCard icon={Trophy} label="Completed" value={summary.completed} tint="bg-card" />
      <SummaryCard
        icon={Users}
        label="Courts open"
        value={summary.availableCourts}
        tint="bg-candy-tint"
        href={courtsHref}
      />
      <SummaryCard icon={Clock} label="Delayed" value={summary.delayed} tint="bg-pink-tint" />
      <SummaryCard
        icon={Swords}
        label="Progress"
        value={`${summary.progressPct}%`}
        tint="bg-lavender/40"
      />
    </div>
  );
}
