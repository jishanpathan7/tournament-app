"use client";

import type { PartnerWarning } from "@tournament/api-client";
import { AlertTriangle, Sparkles, Trophy, Users, Wand2 } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { ProposedTeamCard } from "@/features/pairing/components/proposed-team-card";
import { entrantsById, pairingStats, skillMeta, sortedTeams } from "@/features/pairing/config";
import {
  useGeneratePairing,
  usePairing,
  usePartnerWarnings,
  usePublishPairing,
  useSwapMembers,
  useUpdateProposedTeam,
} from "@/features/pairing/use-pairing";
import { useDivisions } from "@/features/tournaments/use-tournaments";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { errorMessage } from "@/lib/problem";

/**
 * Smart Pairing review board: generate skill-balanced doubles teams, review each team's
 * strength + confidence, lock/rename, swap members (a two-click manual override), then
 * publish → real pair participants. The backend engine owns every pairing rule.
 */
export function PairingBoard({
  tournamentId,
  divisionId,
}: {
  tournamentId: string;
  divisionId: string;
}) {
  const can = useCan();
  const canManage = can(ACTIONS.TOURNAMENT_UPDATE);

  const divisions = useDivisions(tournamentId);
  const division = divisions.data?.find((d) => d.id === divisionId);
  const pairing = usePairing(divisionId);
  const warnings = usePartnerWarnings(divisionId);
  const generate = useGeneratePairing(divisionId);
  const publish = usePublishPairing(divisionId, tournamentId);
  const updateTeam = useUpdateProposedTeam(divisionId);

  const run = pairing.data ?? null;
  const swap = useSwapMembers(divisionId, run?.id ?? "");

  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);

  const busy = generate.isPending || publish.isPending || swap.isPending || updateTeam.isPending;

  function onGenerate() {
    setSelectedMember(null);
    generate.mutate(
      {},
      {
        onSuccess: (r) => toast.success(`Generated ${r.teams.length} teams`),
        onError: (e) => toast.error(errorMessage(e, "Couldn't generate pairings")),
      },
    );
  }

  function onSelectMember(memberId: string) {
    if (!run) return;
    if (selectedMember === null) {
      setSelectedMember(memberId);
      return;
    }
    if (selectedMember === memberId) {
      setSelectedMember(null);
      return;
    }
    // Second pick → swap the two members (backend rejects same-team swaps).
    swap.mutate(
      { memberA: selectedMember, memberB: memberId },
      {
        onSuccess: () => toast.success("Teams updated"),
        onError: (e) => toast.error(errorMessage(e, "Couldn't swap those players")),
        onSettled: () => setSelectedMember(null),
      },
    );
  }

  function onPublish() {
    if (!run) return;
    publish.mutate(run.id, {
      onSuccess: (res) => {
        toast.success(`Published ${res.publishedTeams} teams`);
        setConfirmPublish(false);
      },
      onError: (e) => toast.error(errorMessage(e, "Couldn't publish teams")),
    });
  }

  const generateLabel = run ? "Regenerate" : "Generate teams";
  const action = canManage ? (
    <div className="flex items-center gap-2">
      <Button tone="paper" size="sm" onClick={onGenerate} disabled={busy}>
        <Wand2 className="h-4 w-4" /> {generateLabel}
      </Button>
      {run ? (
        <Button tone="candy" size="sm" onClick={() => setConfirmPublish(true)} disabled={busy}>
          <Trophy className="h-4 w-4" /> Publish
        </Button>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Smart pairing"
        title="Team pairing"
        description={
          division?.name
            ? `Pairs for ${division.name} — review, adjust, and publish.`
            : "Skill-balanced doubles teams — review, adjust, and publish."
        }
        actions={action}
      />

      {warnings.data && warnings.data.total > 0 ? (
        <PartnerWarningsCard warnings={warnings.data.warnings} />
      ) : null}

      {pairing.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      ) : pairing.isError ? (
        <ErrorState error={pairing.error} onRetry={() => pairing.refetch()} />
      ) : !run ? (
        <EmptyState
          icon={Sparkles}
          title="No teams yet"
          description={
            canManage
              ? "Generate skill-balanced doubles teams from the approved solo entrants."
              : "Teams haven't been generated for this division yet."
          }
          action={
            canManage ? (
              <Button tone="candy" onClick={onGenerate} disabled={busy}>
                <Wand2 className="h-4 w-4" /> Generate teams
              </Button>
            ) : undefined
          }
        />
      ) : (
        <PairingContent
          run={run}
          canManage={canManage}
          busy={busy}
          selectedMember={selectedMember}
          onSelectMember={onSelectMember}
          onToggleLock={(teamId, locked) =>
            updateTeam.mutate(
              { teamId, body: { locked: !locked, clearTeamName: false } },
              { onError: (e) => toast.error(errorMessage(e, "Couldn't update team")) },
            )
          }
        />
      )}

      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        title="Publish these teams?"
        description="This creates the doubles participants for the draw. Entrants left unpaired stay in the queue."
        confirmLabel="Publish teams"
        loading={publish.isPending}
        onConfirm={onPublish}
      />
    </div>
  );
}

function PartnerWarningsCard({ warnings }: { warnings: PartnerWarning[] }) {
  return (
    <div className="border-yellow bg-yellow-tint flex flex-col gap-3 rounded-2xl border-2 p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="text-yellow h-4 w-4 shrink-0" />
        <span className="text-sm font-semibold">
          {warnings.length} unresolved partner preference
          {warnings.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="text-muted-foreground text-sm">
        These players listed a preferred partner whose name didn&apos;t match any approved
        registration. They&apos;ll be paired by skill balance instead. Check for typos in the
        registration form.
      </p>
      <div className="flex flex-col gap-1.5">
        {warnings.map((w) => (
          <div
            key={w.registrationId}
            className="border-ink/10 bg-card flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2 text-sm"
          >
            <span className="font-medium">{w.playerName}</span>
            <span className="text-muted-foreground">wants</span>
            <span className="font-medium">&ldquo;{w.requestedPartnerName}&rdquo;</span>
            <Badge tone="yellow" className="ml-auto capitalize">
              {w.reason === "ambiguous" ? "ambiguous name" : "not found"}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function PairingContent({
  run,
  canManage,
  busy,
  selectedMember,
  onSelectMember,
  onToggleLock,
}: {
  run: NonNullable<ReturnType<typeof usePairing>["data"]>;
  canManage: boolean;
  busy: boolean;
  selectedMember: string | null;
  onSelectMember: (memberId: string) => void;
  onToggleLock: (teamId: string, locked: boolean) => void;
}) {
  const entrants = entrantsById(run);
  const teams = sortedTeams(run);
  const stats = pairingStats(run);
  const unpaired = run.unpairedIds.map((id) => entrants.get(id)).filter(Boolean);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="ink">
          <Users className="h-3.5 w-3.5" /> {stats.teamCount} teams
        </Badge>
        <Badge tone="mint">avg confidence {Math.round(stats.averageConfidence * 100)}%</Badge>
        {stats.lockedCount > 0 ? <Badge tone="candy">{stats.lockedCount} locked</Badge> : null}
        {stats.unpairedCount > 0 ? (
          <Badge tone="yellow">{stats.unpairedCount} unpaired</Badge>
        ) : null}
        {canManage ? (
          <span className="text-2xs text-muted-foreground ml-auto">
            Tip: click a player, then a player on another team, to swap them.
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team, i) => (
          <ProposedTeamCard
            key={team.id}
            team={team}
            index={i}
            entrants={entrants}
            canManage={canManage}
            busy={busy}
            selectedMemberId={selectedMember}
            onSelectMember={onSelectMember}
            onToggleLock={() => onToggleLock(team.id, team.locked)}
          />
        ))}
      </div>

      {unpaired.length > 0 ? (
        <div className="border-ink bg-yellow-tint flex flex-col gap-2 rounded-2xl border-2 p-4">
          <span className="text-2xs text-ink font-mono uppercase tracking-[0.14em]">
            Unpaired reserves
          </span>
          <div className="flex flex-wrap gap-2">
            {unpaired.map((e) => (
              <span
                key={e!.registrationId}
                className="border-ink bg-card flex items-center gap-2 rounded-full border-2 px-3 py-1"
              >
                <span className="text-sm font-medium">{e!.displayName}</span>
                <Badge tone={skillMeta(e!.skillLevel).tone}>{skillMeta(e!.skillLevel).label}</Badge>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
