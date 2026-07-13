"use client";

import { AlertTriangle, Check, UserPlus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { ProposedTeamCard } from "@/features/pairing/components/proposed-team-card";
import {
  entrantsById,
  pairingStats,
  preferenceConflicts,
  skillMeta,
  sortedTeams,
} from "@/features/pairing/config";
import {
  useAddDuplicatePair,
  useCreateManualPair,
  useDeleteProposedTeam,
  useGeneratePairing,
  usePairing,
  usePartnerWarnings,
  usePublishPairing,
  useSwapMembers,
  useUpdateProposedTeam,
} from "@/features/pairing/use-pairing";
import { ManualPairingBuilder } from "@/features/squads/components/manual-pairing-builder";
import type { SquadView } from "@/features/squads/types";
import { errorMessage } from "@/lib/problem";
import { cn } from "@/lib/utils";

/**
 * Slide-over sheet for pairing members of a single squad into doubles pairs.
 * Uses the same engine as the division-wide PairingBoard, but scopes the run
 * to squad_id — so Adv+Beg pairs stay within the franchise team.
 *
 * Odd-squad handling: when the squad has an odd number of players the engine
 * leaves one player in ``run.unpairedIds``. The captain resolves this by
 * choosing an existing player to partner the odd-one-out — allowing that
 * player to compete in two pairs. The resulting "duplicate pair" is locked,
 * and both the pair card and the duplicated player's chip are visually flagged.
 */
export function SquadPairingSheet({
  squad,
  divisionId,
  tournamentId,
  isManualPairing = false,
  onClose,
  onNext,
}: {
  squad: SquadView;
  divisionId: string;
  tournamentId: string;
  isManualPairing?: boolean;
  onClose: () => void;
  /** If provided, show "Next team →" in the published footer to jump straight to that squad. */
  onNext?: () => void;
}) {
  const squadId = squad.id;

  const pairing = usePairing(divisionId, { squadId });
  const warnings = usePartnerWarnings(divisionId);
  const generate = useGeneratePairing(divisionId, squadId);
  const publish = usePublishPairing(divisionId, tournamentId, squadId);
  const updateTeam = useUpdateProposedTeam(divisionId, squadId);

  const run = pairing.data ?? null;
  const swap = useSwapMembers(divisionId, run?.id ?? "", squadId);
  const addDuplicatePair = useAddDuplicatePair(divisionId, run?.id ?? "", squadId);
  const createManualPair = useCreateManualPair(divisionId, run?.id ?? "", squadId);
  const deleteProposedTeam = useDeleteProposedTeam(divisionId, squadId);

  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  // When set, the captain is picking a partner for this unpaired registration id.
  const [assigningFor, setAssigningFor] = useState<string | null>(null);

  const busy =
    generate.isPending ||
    publish.isPending ||
    swap.isPending ||
    updateTeam.isPending ||
    addDuplicatePair.isPending ||
    createManualPair.isPending ||
    deleteProposedTeam.isPending;

  function onGenerate() {
    setSelectedMember(null);
    setAssigningFor(null);
    generate.mutate(
      { manual: false },
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
    if (assigningFor !== null) return; // lock swap mode out when assigning a partner
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

  function onPickDuplicate(duplicateId: string) {
    if (!run || !assigningFor) return;
    addDuplicatePair.mutate(
      { unpairedId: assigningFor, duplicateId },
      {
        onSuccess: (r) => {
          const unpairedName = entrantsMap.get(assigningFor)?.displayName ?? "Player";
          const duplicateName = entrantsMap.get(duplicateId)?.displayName ?? "Player";
          toast.success(`${unpairedName} paired with ${duplicateName} (plays twice)`);
          setAssigningFor(null);
        },
        onError: (e) => {
          toast.error(errorMessage(e, "Couldn't assign partner"));
          setAssigningFor(null);
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

  // Filter partner warnings to only players in this squad.
  const squadWarnings = (warnings.data?.warnings ?? []).filter(
    (w) => !run || entrantsMap.has(w.registrationId),
  );
  const teams = run ? sortedTeams(run) : [];
  const stats = run ? pairingStats(run) : null;
  const isPublished = run?.status === "published";

  // Stale-pairs detection: published run entrants vs current squad roster.
  const pairsAreStale = (() => {
    if (!isPublished || !run) return false;
    const runIds = new Set(run.entrants.map((e) => e.registrationId));
    const squadIds = new Set(squad.members.map((m) => m.registrationId));
    if (runIds.size !== squadIds.size) return true;
    for (const id of squadIds) if (!runIds.has(id)) return true;
    return false;
  })();

  // Build a set of registration ids that appear in more than one proposed team.
  // These are players who have been assigned to "play twice" via add_duplicate_pair.
  const duplicatePlayerIds: ReadonlySet<string> = (() => {
    const freq = new Map<string, number>();
    for (const team of teams) {
      for (const id of team.memberIds) {
        freq.set(id, (freq.get(id) ?? 0) + 1);
      }
    }
    return new Set([...freq.entries()].filter(([, count]) => count > 1).map(([id]) => id));
  })();

  // All paired member ids (for filtering the "pick duplicate" list).
  const pairedIds = new Set(teams.flatMap((t) => t.memberIds));

  // Preference conflict map: entrants whose requested partner wasn't honored.
  const prefConflicts = run && !isPublished ? preferenceConflicts(run) : new Map<string, string>();

  // Unpaired players — sorted by skill weight descending for consistent display.
  const unpairedEntrants = (run?.unpairedIds ?? [])
    .map((id) => entrantsMap.get(id))
    .filter(Boolean);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <p className="text-muted-foreground font-mono text-xs font-semibold uppercase tracking-widest">
            Doubles Pairs
          </p>
          <h2 className="text-lg font-bold">{squad.name}</h2>
          <p className="text-muted-foreground text-sm">
            {squad.memberCount} players · paired by skill level
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-full p-1.5 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {pairsAreStale && (
          <div className="mb-4 flex flex-col gap-2 rounded-2xl border-2 border-orange-400 bg-orange-50 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-orange-600" />
              <span className="text-sm font-semibold text-orange-800">
                Team roster changed — pairs are outdated
              </span>
            </div>
            <p className="text-xs text-orange-700">
              Players were added or removed after these pairs were published. Review and publish
              again to reflect the current roster.
            </p>
          </div>
        )}
        {isManualPairing && !isPublished ? (
          <ManualPairingBuilder
            run={run}
            squad={squad}
            divisionId={divisionId}
            squadWarnings={squadWarnings}
            busy={busy}
            isPublished={isPublished}
            onInitRun={() =>
              generate.mutate(
                { manual: true, forcedGroups: [], forbiddenPairs: [] },
                {
                  onSuccess: () => {},
                  onError: (e) => toast.error(errorMessage(e, "Couldn't start pairing")),
                },
              )
            }
            onCreatePair={(memberIds) =>
              createManualPair.mutate(memberIds, {
                onError: (e) => toast.error(errorMessage(e, "Couldn't create pair")),
              })
            }
            onDeletePair={(teamId) =>
              deleteProposedTeam.mutate(teamId, {
                onError: (e) => toast.error(errorMessage(e, "Couldn't delete pair")),
              })
            }
            onToggleLock={(team) =>
              updateTeam.mutate(
                { teamId: team.id, body: { locked: !team.locked, clearTeamName: false } },
                { onError: (e) => toast.error(errorMessage(e, "Couldn't update")) },
              )
            }
            onAssignPartner={setAssigningFor}
            assigningFor={assigningFor}
            onPickDuplicate={onPickDuplicate}
          />
        ) : (
          <>
            {squadWarnings.length > 0 && (
              <div className="mb-4 flex flex-col gap-2 rounded-2xl border-2 border-yellow-400 bg-yellow-50 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-600" />
                  <span className="text-sm font-semibold text-yellow-800">
                    {squadWarnings.length} unresolved partner preference
                    {squadWarnings.length === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="text-xs text-yellow-700">
                  These players listed a preferred partner whose name didn&apos;t match any approved
                  registration. Check for typos — they&apos;ll be paired by skill balance instead.
                </p>
                <div className="flex flex-col gap-1.5">
                  {squadWarnings.map((w) => (
                    <div
                      key={w.registrationId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-yellow-300 bg-white px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{w.playerName}</span>
                      <span className="text-yellow-700">
                        wants &ldquo;{w.requestedPartnerName}&rdquo;
                      </span>
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold capitalize text-yellow-800">
                        {w.reason === "ambiguous" ? "ambiguous name" : "not found"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pairing.isLoading ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Loading…
              </div>
            ) : !run || run.teams.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <p className="text-muted-foreground text-sm">
                  No pairs generated yet for <strong>{squad.name}</strong>.
                </p>
                <Button
                  tone="candy"
                  size="sm"
                  onClick={onGenerate}
                  loading={generate.isPending}
                  disabled={busy}
                >
                  {generate.isPending ? "Generating pairs…" : "Generate Doubles Pairs"}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Stats bar */}
                {stats && (
                  <div className="bg-muted/30 flex flex-wrap gap-4 rounded-xl border px-4 py-3 text-sm">
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
                    {duplicatePlayerIds.size > 0 && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-semibold text-yellow-600">
                          {duplicatePlayerIds.size} playing twice
                        </span>
                      </>
                    )}
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                      Avg confidence {Math.round(stats.averageConfidence * 100)}%
                    </span>
                  </div>
                )}

                {/* ── Odd-player banner ────────────────────────────────────────── */}
                {unpairedEntrants.length > 0 && (
                  <div className="flex flex-col gap-3 rounded-2xl border-2 border-yellow-400 bg-yellow-50 p-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-600" />
                      <p className="text-sm font-semibold text-yellow-800">
                        {unpairedEntrants.length === 1
                          ? "One player needs a partner"
                          : `${unpairedEntrants.length} players need a partner`}
                      </p>
                    </div>
                    <p className="text-xs text-yellow-700">
                      {squad.name} has an odd number of players. Choose an existing player to
                      partner the player below — they will play in two pairs.
                    </p>

                    {unpairedEntrants.map((entrant) => {
                      if (!entrant) return null;
                      const skill = skillMeta(entrant.skillLevel);
                      const isAssigning = assigningFor === entrant.registrationId;

                      return (
                        <div key={entrant.registrationId} className="flex flex-col gap-3">
                          {/* Unpaired player chip */}
                          <div className="flex items-center justify-between rounded-xl border-2 border-yellow-300 bg-white px-3 py-2">
                            <div className="flex items-center gap-2">
                              <UserPlus className="h-4 w-4 text-yellow-600" />
                              <span className="font-medium">{entrant.displayName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-xs font-semibold",
                                  skill.tone === "pink" &&
                                    "border-pink-200 bg-pink-50 text-pink-700",
                                  skill.tone === "candy" &&
                                    "border-purple-200 bg-purple-50 text-purple-700",
                                  skill.tone === "mint" &&
                                    "border-emerald-200 bg-emerald-50 text-emerald-700",
                                  skill.tone === "muted" &&
                                    "border-gray-200 bg-gray-50 text-gray-600",
                                )}
                              >
                                {skill.label}
                              </span>
                              {!isPublished && (
                                <Button
                                  tone={isAssigning ? "paper" : "candy"}
                                  size="sm"
                                  disabled={busy}
                                  onClick={() =>
                                    setAssigningFor(isAssigning ? null : entrant.registrationId)
                                  }
                                >
                                  {isAssigning ? "Cancel" : "Assign partner"}
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Inline player picker */}
                          {isAssigning && (
                            <div className="flex flex-col gap-2 rounded-xl border-2 border-yellow-300 bg-white p-3">
                              <p className="text-xs font-semibold text-yellow-800">
                                Pick who plays a second match with{" "}
                                <strong>{entrant.displayName}</strong>:
                              </p>
                              <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
                                {[...pairedIds]
                                  .filter((id) => id !== entrant.registrationId)
                                  .map((id) => {
                                    const candidate = entrantsMap.get(id);
                                    if (!candidate) return null;
                                    const cSkill = skillMeta(candidate.skillLevel);
                                    return (
                                      <button
                                        key={id}
                                        type="button"
                                        disabled={busy}
                                        onClick={() => onPickDuplicate(id)}
                                        className="flex w-full items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-left text-sm transition-colors hover:border-yellow-400 hover:bg-yellow-100 disabled:opacity-50"
                                      >
                                        <span className="font-medium">{candidate.displayName}</span>
                                        <span className="flex items-center gap-1.5">
                                          {duplicatePlayerIds.has(id) && (
                                            <span className="text-2xs rounded-full bg-yellow-200 px-1.5 py-0.5 font-semibold text-yellow-800">
                                              Already plays twice
                                            </span>
                                          )}
                                          <span
                                            className={cn(
                                              "rounded-full border px-2 py-0.5 text-xs font-semibold",
                                              cSkill.tone === "pink" &&
                                                "border-pink-200 bg-pink-50 text-pink-700",
                                              cSkill.tone === "candy" &&
                                                "border-purple-200 bg-purple-50 text-purple-700",
                                              cSkill.tone === "mint" &&
                                                "border-emerald-200 bg-emerald-50 text-emerald-700",
                                              cSkill.tone === "muted" &&
                                                "border-gray-200 bg-gray-50 text-gray-600",
                                            )}
                                          >
                                            {cSkill.label}
                                          </span>
                                          <Check className="h-3.5 w-3.5 text-yellow-600 opacity-0 group-hover:opacity-100" />
                                        </span>
                                      </button>
                                    );
                                  })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Swap mode hint */}
                {selectedMember && !assigningFor && (
                  <p className="text-candy-dark text-sm font-semibold">
                    Click another player to swap, or click the same player to cancel.
                  </p>
                )}

                {/* Team cards grid */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {teams.map((team, i) => (
                    <ProposedTeamCard
                      key={team.id}
                      team={team}
                      entrants={entrantsMap}
                      index={i}
                      selectedMemberId={selectedMember}
                      canManage={!isPublished && assigningFor === null}
                      busy={busy}
                      duplicatePlayerIds={duplicatePlayerIds}
                      preferenceConflicts={prefConflicts}
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
          </>
        )}
      </div>

      {/* Footer */}
      {run && run.teams.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-t px-5 py-4">
          {isPublished && onNext ? (
            <>
              <Button tone="paper" size="sm" onClick={onClose}>
                Done
              </Button>
              <Button tone="candy" size="sm" onClick={onNext}>
                Next team →
              </Button>
            </>
          ) : (
            <>
              <Button
                tone="paper"
                size="sm"
                onClick={onGenerate}
                loading={generate.isPending}
                disabled={busy || isPublished}
              >
                {generate.isPending ? "Regenerating…" : "Regenerate"}
              </Button>
              <Button
                tone="candy"
                size="sm"
                onClick={onPublish}
                loading={publish.isPending}
                disabled={busy || isPublished || (run.unpairedIds?.length ?? 0) > 0}
                title={
                  (run.unpairedIds?.length ?? 0) > 0
                    ? "Resolve unpaired players before locking"
                    : undefined
                }
              >
                {publish.isPending
                  ? "Publishing…"
                  : isPublished
                    ? "Locked ✓"
                    : "Lock & Confirm Pairs"}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
