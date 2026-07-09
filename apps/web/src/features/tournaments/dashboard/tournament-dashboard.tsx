"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { ErrorState } from "@/components/common/error-state";
import { LoadingPanel } from "@/components/common/loading";
import { Button } from "@/components/ui/button";
import { OverviewPanel } from "@/features/tournaments/components/detail/overview-panel";
import { DivisionsSection } from "@/features/tournaments/components/detail/divisions-section";
import { AfterPanel } from "@/features/tournaments/dashboard/components/after-panel";
import { ActivityFeedPanel } from "@/features/tournaments/dashboard/components/activity-feed-panel";
import { AlertsPanel } from "@/features/tournaments/dashboard/components/alerts-panel";
import { BeforePanel } from "@/features/tournaments/dashboard/components/before-panel";
import { DuringPanel } from "@/features/tournaments/dashboard/components/during-panel";
import { MobileTournamentOverview } from "@/features/tournaments/dashboard/components/mobile-tournament-overview";
import { PhaseHeroCard } from "@/features/tournaments/dashboard/components/phase-hero-card";
import { TournamentStepTracker } from "@/features/tournaments/dashboard/components/step-tracker";
import { useTournamentDashboard } from "@/features/tournaments/dashboard/use-tournament-dashboard";
import { TOURNAMENT_STATUS } from "@/features/tournaments/config";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { ApiError } from "@/lib/problem";
import { cn } from "@/lib/utils";

export function TournamentDashboard({ tournamentId }: { tournamentId: string }) {
  const can = useCan();
  const canManage = can(ACTIONS.TOURNAMENT_UPDATE);
  const data = useTournamentDashboard(tournamentId);
  const [detailsOpen, setDetailsOpen] = useState(false);

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
  const statusMeta = TOURNAMENT_STATUS[tournament.status as keyof typeof TOURNAMENT_STATUS];
  const showPrepTracker = data.phase === "before";

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground text-sm">{statusMeta.description}</p>

      {showPrepTracker ? (
        <MobileTournamentOverview tournamentId={tournamentId} currentStep={data.step} />
      ) : null}

      <div className="flex flex-col gap-6">
        <PhaseHeroCard
          tournamentId={tournamentId}
          step={data.step}
          signals={data.stepSignals}
          canManage={canManage}
          resultsPublishedAt={tournament.resultsPublishedAt}
        />

        {showPrepTracker ? (
          <div className="hidden md:block">
            <TournamentStepTracker step={data.step} variant="primary" />
          </div>
        ) : null}

        <AlertsPanel alerts={data.alerts} />

        {data.phase === "after" ? (
          <section id="results" className="scroll-mt-8">
            <AfterPanel tournament={tournament} data={data} canManage={canManage} />
          </section>
        ) : null}

        {data.phase === "during" ? <DuringPanel tournamentId={tournamentId} data={data} /> : null}

        <div className="flex flex-col gap-4">
          <Button
            type="button"
            tone="paper"
            size="sm"
            className="self-start"
            onClick={() => setDetailsOpen((open) => !open)}
          >
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", detailsOpen && "rotate-180")}
            />
            {detailsOpen ? "Hide details" : "More details"}
          </Button>

          {detailsOpen ? (
            <div className="flex flex-col gap-6">
              {data.phase === "before" ? (
                <BeforePanel tournamentId={tournamentId} data={data} canManage={canManage} />
              ) : null}
              {data.phase === "during" ? <ActivityFeedPanel tournamentId={tournamentId} /> : null}
              <OverviewPanel tournament={tournament} />
              <section id="event-types" className="flex scroll-mt-8 flex-col gap-3">
                <h2 className="font-serif text-xl font-semibold tracking-tight">Event types</h2>
                <p className="text-muted-foreground text-sm">
                  Categories within this tournament — most events only need one.
                </p>
                <DivisionsSection tournamentId={tournamentId} canManage={canManage} />
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
