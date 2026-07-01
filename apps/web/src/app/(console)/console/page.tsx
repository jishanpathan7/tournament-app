"use client";

import type { TournamentResponse } from "@tournament/api-client";
import { CircleDot, FileText, Trophy } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { CardGridSkeleton } from "@/components/common/loading";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/features/auth/use-session";
import { TournamentCard } from "@/features/tournaments/components/tournament-card";
import { useTournaments } from "@/features/tournaments/use-tournaments";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const ACTIVE = new Set(["registration", "seeding", "live"]);
const byRecent = (a: TournamentResponse, b: TournamentResponse) =>
  b.createdAt.localeCompare(a.createdAt);

export default function ConsolePage() {
  const { session } = useSession();
  const can = useCan();
  const { data, isLoading, isError, error, refetch } = useTournaments();
  const firstName = session?.name?.split(" ")[0];

  const { active, drafts, recent, stats } = useMemo(() => {
    const list = data ?? [];
    const active = list.filter((t) => ACTIVE.has(t.status)).sort(byRecent);
    const drafts = list.filter((t) => t.status === "draft").sort(byRecent);
    const recent = [...list].sort(byRecent).slice(0, 6);
    return {
      active,
      drafts,
      recent,
      stats: [
        { label: "Tournaments", value: list.length, icon: Trophy, tint: "bg-candy-tint" },
        { label: "Active", value: active.length, icon: CircleDot, tint: "bg-mint-tint" },
        { label: "Drafts", value: drafts.length, icon: FileText, tint: "bg-yellow-tint" },
      ],
    };
  }, [data]);

  const newButton = can(ACTIONS.TOURNAMENT_CREATE) ? (
    <Button asChild tone="candy">
      <Link href="/console/tournaments/new">+ New tournament</Link>
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Console"
        title={firstName ? `Welcome, ${firstName}` : "Welcome"}
        description="Your organizer home. Create tournaments, manage registrations, and run live scoring."
        actions={newButton}
      />

      {isLoading ? (
        <CardGridSkeleton count={3} />
      ) : isError ? (
        <ErrorState
          error={error}
          onRetry={() => refetch()}
          title="Couldn't load your tournaments"
        />
      ) : (data?.length ?? 0) === 0 ? (
        <Card className="p-2">
          <EmptyState
            icon={Trophy}
            eyebrow="Get started"
            title="Run your first tournament"
            description="Create a tournament, open registration, generate the draw, and score matches live."
            action={newButton ?? undefined}
          />
        </Card>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {stats.map((s) => (
              <Card key={s.label} className={cn("flex items-center gap-4 p-5", s.tint)}>
                <span className="border-ink bg-card shadow-sticker-xs flex h-12 w-12 items-center justify-center rounded-xl border-2">
                  <s.icon className="h-6 w-6" strokeWidth={2.25} aria-hidden />
                </span>
                <span className="flex flex-col">
                  <span className="text-3xl font-extrabold tabular-nums leading-none">
                    {s.value}
                  </span>
                  <span className="text-muted-foreground text-2xs mt-1 font-mono font-semibold uppercase tracking-[0.18em]">
                    {s.label}
                  </span>
                </span>
              </Card>
            ))}
          </section>

          <DashboardSection
            title={active.length > 0 ? "Active tournaments" : "Recent tournaments"}
            href="/console/tournaments"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(active.length > 0 ? active : recent).slice(0, 6).map((t) => (
                <TournamentCard key={t.id} tournament={t} />
              ))}
            </div>
          </DashboardSection>

          {drafts.length > 0 ? (
            <DashboardSection title="Drafts" href="/console/tournaments">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {drafts.slice(0, 3).map((t) => (
                  <TournamentCard key={t.id} tournament={t} />
                ))}
              </div>
            </DashboardSection>
          ) : null}
        </>
      )}
    </div>
  );
}

function DashboardSection({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold tracking-tight">{title}</h2>
        <Link
          href={href}
          className="text-candy-dark text-sm font-semibold underline-offset-2 hover:underline"
        >
          View all
        </Link>
      </div>
      {children}
    </section>
  );
}
