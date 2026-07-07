"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { ProposedTeamCard } from "@/features/pairing/components/proposed-team-card";
import { entrantsById, pairingStats, sortedTeams } from "@/features/pairing/config";
import {
  useGeneratePairing,
  usePairing,
  usePublishPairing,
  useSwapMembers,
  useUpdateProposedTeam,
} from "@/features/pairing/use-pairing";
import type { SquadView } from "@/features/squads/types";
import { errorMessage } from "@/lib/problem";

/**
 * Slide-over sheet for pairing members of a single squad into doubles pairs.
 * Uses the same engine as the division-wide PairingBoard, but scopes the run
 * to squad_id — so Adv+Beg pairs stay within the franchise team.
 */
export function SquadPairingSheet({
  squad,
  divisionId,
  tournamentId,
  onClose,
}: {
  squad: SquadView;
  divisionId: string;
  tournamentId: string;
  onClose: () => void;
}) {
  const squadId = squad.id;

  const pairing = usePairing(divisionId, { squadId });
  const generate = useGeneratePairing(divisionId, squadId);
  const publish = usePublishPairing(divisionId, tournamentId, squadId);
  const updateTeam = useUpdateProposedTeam(divisionId, squadId);

  const run = pairing.data ?? null;
  const swap = useSwapMembers(divisionId, run?.id ?? "", squadId);

  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  const busy = generate.isPending || publish.isPending || swap.isPending || updateTeam.isPending;

  function onGenerate() {
    setSelectedMember(null);
    generate.mutate(
      {},
      {
        onSuccess: (r) =>
          toast.success(
            `Generated ${r.teams.length} pair${r.teams.length !== 1 ? "s" : ""} for ${squad.name}`,
          ),
        onError: (e) => toast.error(errorMessage(e, "Couldn't generate pairs")),
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
    swap.mutate(
      { memberA: selectedMember, memberB: memberId },
      {
        onSuccess: () => {
          toast.success("Members swapped");
          setSelectedMember(null);
        },
        onError: (e) => {
          toast.error(errorMessage(e, "Couldn't swap"));
          setSelectedMember(null);
        },
      },
    );
  }

  function onPublish() {
    if (!run) return;
    publish.mutate(run.id, {
      onSuccess: (res) => {
        toast.success(
          `Published ${res.publishedTeams} pair${res.publishedTeams !== 1 ? "s" : ""} for ${squad.name}`,
        );
        onClose();
      },
      onError: (e) => toast.error(errorMessage(e, "Couldn't publish")),
    });
  }

  const entrantsMap = run ? entrantsById(run) : new Map();
  const teams = run ? sortedTeams(run) : [];
  const stats = run ? pairingStats(run) : null;
  const isPublished = run?.status === "published";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Doubles Pairs
          </p>
          <h2 className="text-lg font-bold">{squad.name}</h2>
          <p className="text-sm text-muted-foreground">
            {squad.memberCount} players · paired by skill level
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {pairing.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Loading…
          </div>
        ) : !run || run.teams.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No pairs generated yet for <strong>{squad.name}</strong>.
            </p>
            <Button tone="candy" size="sm" onClick={onGenerate} disabled={busy}>
              Generate Doubles Pairs
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {stats && (
              <div className="flex flex-wrap gap-4 rounded-xl border bg-muted/30 px-4 py-3 text-sm">
                <span>
                  <strong>{stats.teamCount}</strong> pairs
                </span>
                <span className="text-muted-foreground">·</span>
                <span>
                  <strong>{stats.entrantCount}</strong> players
                </span>
                {stats.unpairedCount > 0 && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="font-semibold text-yellow-600">
                      {stats.unpairedCount} unpaired
                    </span>
                  </>
                )}
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  Avg confidence {Math.round(stats.averageConfidence * 100)}%
                </span>
              </div>
            )}

            {selectedMember && (
              <p className="text-sm font-semibold text-candy-dark">
                Click another player to swap, or click the same player to cancel.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {teams.map((team, i) => (
                <ProposedTeamCard
                  key={team.id}
                  team={team}
                  entrants={entrantsMap}
                  index={i}
                  selectedMemberId={selectedMember}
                  canManage={!isPublished}
                  busy={busy}
                  onSelectMember={onSelectMember}
                  onToggleLock={() =>
                    updateTeam.mutate(
                      { teamId: team.id, body: { locked: !team.locked, clearTeamName: false } },
                      { onError: (e) => toast.error(errorMessage(e, "Couldn't update")) },
                    )
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {run && run.teams.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-t px-5 py-4">
          <Button
            tone="paper"
            size="sm"
            onClick={onGenerate}
            disabled={busy || isPublished}
          >
            Regenerate
          </Button>
          <Button
            tone="candy"
            size="sm"
            onClick={onPublish}
            disabled={busy || isPublished}
          >
            {isPublished ? "Locked ✓" : "Lock & Confirm Pairs"}
          </Button>
        </div>
      )}
    </div>
  );
}
