"use client";

import { CalendarDays, Trophy, Users } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/features/auth/use-session";
import { HealthStatus } from "@/features/health/health-status";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const STATS = [
  { label: "Tournaments", value: "—", icon: Trophy, tint: "bg-candy-tint" },
  { label: "Participants", value: "—", icon: Users, tint: "bg-mint-tint" },
  { label: "Upcoming matches", value: "—", icon: CalendarDays, tint: "bg-yellow-tint" },
];

export default function ConsolePage() {
  const { session } = useSession();
  const can = useCan();
  const firstName = session?.name?.split(" ")[0];

  const newTournament = can(ACTIONS.TOURNAMENT_CREATE) ? (
    <Button asChild tone="candy">
      <Link href="/console/tournaments">+ New tournament</Link>
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Console"
        title={firstName ? `Welcome, ${firstName}` : "Welcome"}
        description="Your organizer home. Create tournaments, manage registrations, and run live scoring."
        actions={newTournament}
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STATS.map((s) => (
          <Card key={s.label} className={cn("flex items-center gap-4 p-5", s.tint)}>
            <span className="border-ink bg-card shadow-sticker-xs flex h-12 w-12 items-center justify-center rounded-xl border-2">
              <s.icon className="h-6 w-6" strokeWidth={2.25} aria-hidden />
            </span>
            <span className="flex flex-col">
              <span className="text-3xl font-extrabold tabular-nums leading-none">{s.value}</span>
              <span className="text-muted-foreground text-2xs mt-1 font-mono font-semibold uppercase tracking-[0.18em]">
                {s.label}
              </span>
            </span>
          </Card>
        ))}
      </section>

      <HealthStatus />

      <Card className="p-2">
        <EmptyState
          icon={Trophy}
          eyebrow="Get started"
          title="Run your first tournament"
          description="Create a tournament, open registration, generate the draw, and score matches live — all from here."
          action={newTournament ?? undefined}
        />
      </Card>
    </div>
  );
}
