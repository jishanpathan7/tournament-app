"use client";

import { Radio, Swords } from "lucide-react";
import Link from "next/link";

import { ErrorState } from "@/components/common/error-state";
import { LoadingPanel } from "@/components/common/loading";
import { Button } from "@/components/ui/button";
import { AfterPanel } from "@/features/tournaments/dashboard/components/after-panel";
import { ActivityFeedPanel } from "@/features/tournaments/dashboard/components/activity-feed-panel";
import { AlertsPanel } from "@/features/tournaments/dashboard/components/alerts-panel";
import { BeforePanel } from "@/features/tournaments/dashboard/components/before-panel";
import { DuringPanel } from "@/features/tournaments/dashboard/components/during-panel";
import { MobileTournamentOverview } from "@/features/tournaments/dashboard/components/mobile-tournament-overview";
import { PhaseHeroCard } from "@/features/tournaments/dashboard/components/phase-hero-card";
import { ReadinessSummary } from "@/features/tournaments/dashboard/components/readiness-summary";
import { RegistrationsSummaryPanel } from "@/features/tournaments/dashboard/components/registrations-summary-panel";
import { TournamentStepTracker } from "@/features/tournaments/dashboard/components/step-tracker";
import { useTournamentDashboard } from "@/features/tournaments/dashboard/use-tournament-dashboard";

type DashboardData = ReturnType<typeof useTournamentDashboard>;

function MobileDuringPanel({ tournamentId, data }: { tournamentId: string; data: DashboardData }) {
  const matches = data.matches.data ?? [];
  const terminal = new Set(["completed", "walkover", "no_show", "cancelled"]);
  const liveCount = matches.filter((m) => m.status === "live").length;
  const doneCount = matches.filter((m) => terminal.has(m.status)).length;
  const remaining = matches.length - doneCount;
  const pct = matches.length > 0 ? Math.round((doneCount / matches.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="border-mint bg-mint-tint/40 rounded-2xl border-2 p-3 text-center">
          <p className="font-mono text-2xl font-bold tabular-nums">{liveCount}</p>
          <p className="text-muted-foreground text-xs">Live now</p>
        </div>
        <div className="border-border rounded-2xl border p-3 text-center">
          <p className="font-mono text-2xl font-bold tabular-nums">{remaining}</p>
          <p className="text-muted-foreground text-xs">Remaining</p>
        </div>
        <div className="border-border rounded-2xl border p-3 text-center">
          <p className="font-mono text-2xl font-bold tabular-nums">{pct}%</p>
          <p className="text-muted-foreground text-xs">Done</p>
        </div>
      </div>
      <Button asChild tone="candy" size="lg" className="w-full justify-start gap-3">
        <Link href={`/console/tournaments/${tournamentId}/matches`}>
          <Swords className="h-5 w-5" strokeWidth={2.25} />
          Manage matches
        </Link>
      </Button>
      <Button asChild tone="paper" size="lg" className="w-full justify-start gap-3">
        <Link href={`/console/tournaments/${tournamentId}/live`}>
          <Radio className="h-5 w-5" strokeWidth={2.25} />
          Court ops
        </Link>
      </Button>
    </div>
  );
}
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { ApiError } from "@/lib/problem";

export function TournamentDashboard({ tournamentId }: { tournamentId: string }) {
  const can = useCan();
  const canManage = can(ACTIONS.TOURNAMENT_UPDATE);
  const data = useTournamentDashboard(tournamentId);
  if (data.tournament.isLoading || data.isLoadingCore) {
    return <LoadingPanel label="Loading overview" />;
  }

  if (data.tournament.isError || !data.tournament.data) {
    const error = data.tournament.error;
    const notFound = error instanceof ApiError && error.isNotFound;
    return (
      <ErrorState
        error={error}
        onRetry={notFound ? undefined : () => data.tournament.refetch()}
        title={notFound ? "Tournament not found" : "Couldn't load overview"}
      />
    );
  }

  const tournament = data.tournament.data;
  const showPrepTracker = data.phase === "before";
  const step = data.step;

  // Promote registration summary at step 2 (registration open)
  const showRegistrationSummary = showPrepTracker && step === 2;
  // Promote readiness summary at steps 5–7 (check-in, brackets, go live)
  const showReadinessSummary = showPrepTracker && step >= 5 && step <= 7;

  return (
    <div className="flex flex-col gap-6">
      {showPrepTracker ? (
        <MobileTournamentOverview
          tournamentId={tournamentId}
          currentStep={step}
          franchiseMode={data.stepSignals.franchiseMode}
        />
      ) : null}

      <div className="flex flex-col gap-6">
        <PhaseHeroCard
          tournamentId={tournamentId}
          step={step}
          signals={data.stepSignals}
          readiness={data.readiness.data}
          canManage={canManage}
          resultsPublishedAt={tournament.resultsPublishedAt}
        />
        {showPrepTracker ? (
          <div className="hidden md:block">
            <TournamentStepTracker
              step={step}
              tournamentId={tournamentId}
              variant="primary"
              franchiseMode={data.stepSignals.franchiseMode}
            />
          </div>
        ) : null}

        {showRegistrationSummary ? (
          <RegistrationsSummaryPanel
            tournamentId={tournamentId}
            divisions={data.divisions.data ?? []}
            totals={data.registrationTotals}
            readinessDivisionsByDivision={data.readinessDivisionsByDivision}
            registrationsByDivision={data.registrationsByDivision}
            participantsByDivision={data.participantsByDivision}
            canManage={canManage}
          />
        ) : null}

        {showReadinessSummary ? (
          <ReadinessSummary tournamentId={tournamentId} readiness={data.readiness} />
        ) : null}

        <AlertsPanel alerts={data.alerts} />

        {data.phase === "after" ? (
          <section id="results" className="scroll-mt-8">
            <AfterPanel tournament={tournament} data={data} canManage={canManage} />
          </section>
        ) : null}

        {data.phase === "during" ? (
          <>
            <div className="md:hidden">
              <MobileDuringPanel tournamentId={tournamentId} data={data} />
            </div>
            <div className="hidden md:block">
              <DuringPanel tournamentId={tournamentId} data={data} />
            </div>
          </>
        ) : null}

        {data.phase === "before" ? (
          <BeforePanel tournamentId={tournamentId} data={data} canManage={canManage} />
        ) : null}
        {data.phase === "during" ? <ActivityFeedPanel tournamentId={tournamentId} /> : null}
      </div>
    </div>
  );
}
