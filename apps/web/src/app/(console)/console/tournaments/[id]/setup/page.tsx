"use client";

import { use } from "react";

import { ErrorState } from "@/components/common/error-state";
import { LoadingPanel } from "@/components/common/loading";
import { DivisionsSection } from "@/features/tournaments/components/detail/divisions-section";
import { OverviewPanel } from "@/features/tournaments/components/detail/overview-panel";
import { PairingModeCard } from "@/features/tournaments/setup/pairing-mode-card";
import { SetupHub } from "@/features/tournaments/setup/setup-hub";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { ApiError } from "@/lib/problem";
import { useTournament } from "@/features/tournaments/use-tournaments";

export default function TournamentSetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const can = useCan();
  const canManage = can(ACTIONS.TOURNAMENT_UPDATE);
  const { data: tournament, isLoading, isError, error, refetch } = useTournament(id);

  if (isLoading) return <LoadingPanel label="Loading setup" />;
  if (isError || !tournament) {
    const notFound = error instanceof ApiError && error.isNotFound;
    return (
      <ErrorState
        error={error}
        onRetry={notFound ? undefined : () => refetch()}
        title={notFound ? "Tournament not found" : "Couldn't load setup"}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <OverviewPanel tournament={tournament} />
      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-xl font-semibold tracking-tight">Setup</h2>
        <p className="text-muted-foreground text-sm">
          Everything needed to configure and run this tournament.
        </p>
        <SetupHub tournamentId={id} />
      </section>
      {canManage && (
        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-xl font-semibold tracking-tight">Pairing</h2>
          <p className="text-muted-foreground text-sm">
            Controls how doubles pairs are created within franchise teams.
          </p>
          <PairingModeCard tournamentId={id} />
        </section>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-xl font-semibold tracking-tight">Event types</h2>
        <p className="text-muted-foreground text-sm">
          Categories within this tournament — most events only need one.
        </p>
        <DivisionsSection tournamentId={id} canManage={canManage} />
      </section>
    </div>
  );
}
