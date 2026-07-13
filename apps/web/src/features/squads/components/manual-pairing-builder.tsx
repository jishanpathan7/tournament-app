"use client";

import type {
  EntrantView,
  PairingRunView,
  PartnerWarning,
  ProposedTeamView,
} from "@tournament/api-client";
import { AlertTriangle, Lock, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { skillMeta } from "@/features/pairing/config";
import type { SquadView } from "@/features/squads/types";
import { cn } from "@/lib/utils";

interface ManualPairingBuilderProps {
  run: PairingRunView | null;
  squad: SquadView;
  divisionId: string;
  squadWarnings: PartnerWarning[];
  busy: boolean;
  isPublished: boolean;
  onInitRun: () => void;
  onCreatePair: (memberIds: string[]) => void;
  onDeletePair: (teamId: string) => void;
  onToggleLock: (team: ProposedTeamView) => void;
  onAssignPartner: (id: string | null) => void;
  assigningFor: string | null;
  onPickDuplicate: (duplicateId: string) => void;
}

export function ManualPairingBuilder({
  run,
  squad,
  squadWarnings,
  busy,
  isPublished,
  onInitRun,
  onCreatePair,
  onDeletePair,
  onToggleLock,
  onAssignPartner,
  assigningFor,
  onPickDuplicate,
}: ManualPairingBuilderProps) {
  const [selectedFirst, setSelectedFirst] = useState<string | null>(null);

  if (!run) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="text-muted-foreground text-sm">
          No pairs yet for <strong>{squad.name}</strong>.
        </p>
        <Button tone="candy" size="sm" onClick={onInitRun} disabled={busy}>
          Start Pairing
        </Button>
      </div>
    );
  }

  const entrantsMap = new Map<string, EntrantView>(run.entrants.map((e) => [e.registrationId, e]));

  const pairedIds = new Set(run.teams.flatMap((t) => t.memberIds));
  const availableEntrants = run.entrants.filter((e) => !pairedIds.has(e.registrationId));

  const duplicatePlayerIds = (() => {
    const freq = new Map<string, number>();
    for (const team of run.teams) {
      for (const id of team.memberIds) {
        freq.set(id, (freq.get(id) ?? 0) + 1);
      }
    }
    return new Set([...freq.entries()].filter(([, c]) => c > 1).map(([id]) => id));
  })();

  const unpairedEntrants = (run.unpairedIds ?? [])
    .map((id) => entrantsMap.get(id))
    .filter(Boolean) as EntrantView[];

  function handleChipClick(entrantId: string) {
    if (busy) return;
    if (selectedFirst === null) {
      setSelectedFirst(entrantId);
      return;
    }
    if (selectedFirst === entrantId) {
      setSelectedFirst(null);
      return;
    }
    onCreatePair([selectedFirst, entrantId]);
    setSelectedFirst(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Partner warnings */}
      {squadWarnings.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-yellow-400 bg-yellow-50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-600" />
            <span className="text-sm font-semibold text-yellow-800">
              {squadWarnings.length} unresolved partner preference
              {squadWarnings.length === 1 ? "" : "s"}
            </span>
          </div>
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

      {/* Available Players */}
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
          Available Players
          {availableEntrants.length > 0 && (
            <span className="ml-1 font-normal">
              — {selectedFirst ? "click a second player to pair" : "click a player to select"}
            </span>
          )}
        </p>
        {availableEntrants.length === 0 ? (
          <p className="text-muted-foreground text-sm">All players paired.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableEntrants.map((e) => {
              const skill = skillMeta(e.skillLevel);
              const isSelected = selectedFirst === e.registrationId;
              return (
                <button
                  key={e.registrationId}
                  type="button"
                  disabled={busy}
                  onClick={() => handleChipClick(e.registrationId)}
                  className={cn(
                    "rounded-full border-2 px-3 py-1 text-sm font-semibold transition-all",
                    isSelected
                      ? "border-candy bg-candy/10 text-candy-dark ring-candy ring-2 ring-offset-1"
                      : "border-muted bg-muted/40 hover:border-candy/60 hover:bg-candy/5",
                  )}
                >
                  {e.displayName}
                  <span
                    className={cn(
                      "ml-1.5 text-xs font-normal opacity-70",
                      skill.tone === "pink" && "text-pink-600",
                      skill.tone === "candy" && "text-purple-600",
                      skill.tone === "mint" && "text-emerald-600",
                    )}
                  >
                    {skill.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Odd-player banner */}
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
            {squad.name} has an odd number of players. Choose an existing player to partner the
            player below — they will play in two pairs.
          </p>
          {unpairedEntrants.map((entrant) => {
            const skill = skillMeta(entrant.skillLevel);
            const isAssigning = assigningFor === entrant.registrationId;
            return (
              <div key={entrant.registrationId} className="flex flex-col gap-3">
                <div className="flex items-center justify-between rounded-xl border-2 border-yellow-300 bg-white px-3 py-2">
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-yellow-600" />
                    <span className="font-medium">{entrant.displayName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs font-semibold",
                        skill.tone === "pink" && "border-pink-200 bg-pink-50 text-pink-700",
                        skill.tone === "candy" && "border-purple-200 bg-purple-50 text-purple-700",
                        skill.tone === "mint" &&
                          "border-emerald-200 bg-emerald-50 text-emerald-700",
                        skill.tone === "muted" && "border-gray-200 bg-gray-50 text-gray-600",
                      )}
                    >
                      {skill.label}
                    </span>
                    {!isPublished && (
                      <Button
                        tone={isAssigning ? "paper" : "candy"}
                        size="sm"
                        disabled={busy}
                        onClick={() => onAssignPartner(isAssigning ? null : entrant.registrationId)}
                      >
                        {isAssigning ? "Cancel" : "Assign partner"}
                      </Button>
                    )}
                  </div>
                </div>
                {isAssigning && (
                  <div className="flex flex-col gap-2 rounded-xl border-2 border-yellow-300 bg-white p-3">
                    <p className="text-xs font-semibold text-yellow-800">
                      Pick who plays a second match with <strong>{entrant.displayName}</strong>:
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

      {/* Pairs list */}
      {run.teams.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
            Pairs ({run.teams.length})
          </p>
          <div className="flex flex-col gap-2">
            {run.teams.map((team, i) => {
              const members = team.memberIds
                .map((id) => entrantsMap.get(id))
                .filter(Boolean) as EntrantView[];
              return (
                <div
                  key={team.id}
                  className={cn(
                    "flex items-center justify-between rounded-xl border-2 px-3 py-2",
                    team.locked ? "border-emerald-300 bg-emerald-50" : "border-muted bg-muted/20",
                  )}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground font-mono text-xs">P{i + 1}</span>
                    <span className="font-semibold">
                      {members.map((m) => m.displayName).join(" + ")}
                    </span>
                    {team.locked && <Lock className="h-3.5 w-3.5 text-emerald-600" />}
                  </div>
                  {!isPublished && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onToggleLock(team)}
                        title={team.locked ? "Unlock" : "Lock"}
                        className={cn(
                          "rounded-lg p-1.5 transition-colors",
                          team.locked
                            ? "text-emerald-700 hover:bg-emerald-100"
                            : "text-muted-foreground hover:bg-muted",
                        )}
                      >
                        <Lock className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={busy || team.locked}
                        onClick={() => onDeletePair(team.id)}
                        title={team.locked ? "Unlock to delete" : "Delete pair"}
                        className="text-muted-foreground hover:bg-muted rounded-lg p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
