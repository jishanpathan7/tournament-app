"use client";

import type { MatchView, ParticipantResponse } from "@tournament/api-client";
import { Trophy } from "lucide-react";

import { groupMatchesByRound } from "@/features/draws/config";
import { cn } from "@/lib/utils";

interface Slot {
  key: string;
  label: string;
  seedLabel: string | null;
  score: string | null;
  isWinner: boolean;
  isBye: boolean;
  isPlaceholder: boolean;
}

function buildSlots(match: MatchView, participantsById: Map<string, ParticipantResponse>): Slot[] {
  const slots: Slot[] = match.sides.map((side) => {
    const participant = participantsById.get(side.participantId);
    return {
      key: side.participantId,
      label: participant?.displayName ?? "Unknown",
      seedLabel: participant?.seed != null ? String(participant.seed) : null,
      score: side.scoreFor != null ? String(side.scoreFor) : null,
      isWinner: side.outcome === "win",
      isBye: false,
      isPlaceholder: false,
    };
  });
  while (slots.length < 2) {
    const isBye = match.status === "walkover" && slots.length === 1;
    slots.push({
      key: `placeholder-${match.id}-${slots.length}`,
      label: isBye ? "Bye" : "TBD",
      seedLabel: null,
      score: null,
      isWinner: false,
      isBye,
      isPlaceholder: !isBye,
    });
  }
  return slots;
}

function SeedCard({
  match,
  participantsById,
}: {
  match: MatchView;
  participantsById: Map<string, ParticipantResponse>;
}) {
  const slots = buildSlots(match, participantsById);
  return (
    <div
      className="border-ink bg-card shadow-sticker overflow-hidden rounded-2xl border-2"
      data-testid="seed-card"
      data-match-status={match.status}
    >
      {slots.map((slot) => (
        <div
          key={slot.key}
          className={cn(
            "border-border flex items-center gap-2.5 border-t px-3 py-2.5 text-sm first:border-t-0",
            slot.isWinner && "font-bold",
            slot.isPlaceholder && "text-muted-foreground italic",
            !slot.isWinner && !slot.isPlaceholder && match.status !== "pending" && "text-muted-foreground",
          )}
        >
          {slot.seedLabel ? (
            <span className="border-ink bg-yellow-tint rounded-md border-2 px-1.5 py-0.5 font-mono text-2xs font-bold">
              {slot.seedLabel}
            </span>
          ) : null}
          <span className="truncate">{slot.label}</span>
          {slot.score !== null ? (
            <span
              className={cn(
                "ml-auto font-mono text-xs font-bold",
                slot.isWinner ? "text-mint-dark" : "text-muted-foreground",
              )}
            >
              {slot.score}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Single elimination bracket: pure flex columns per round, no connector lines — matches
 * the Candy Sticker reference design. Byes/pending/completed all derive from fields the
 * backend already computes (round labels, seeds, outcomes) — nothing here recomputes the
 * bracket structure itself. */
export function BracketBoard({
  matches,
  participantsById,
}: {
  matches: MatchView[];
  participantsById: Map<string, ParticipantResponse>;
}) {
  const rounds = groupMatchesByRound(matches);
  const finalRound = rounds[rounds.length - 1];
  const finalMatch = finalRound?.matches[0];
  const championSlot =
    finalMatch && (finalMatch.status === "completed" || finalMatch.status === "walkover")
      ? buildSlots(finalMatch, participantsById).find((s) => s.isWinner)
      : null;

  return (
    <div className="flex items-stretch gap-10 overflow-x-auto pb-6 pt-2" role="group" aria-label="Bracket">
      {rounds.map((round) => (
        <div key={round.key} className="flex min-w-[220px] flex-col justify-around gap-4">
          <span className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.22em]">
            {round.label}
          </span>
          {round.matches.map((match) => (
            <SeedCard key={match.id} match={match} participantsById={participantsById} />
          ))}
        </div>
      ))}
      {finalRound ? (
        <div className="flex min-w-[180px] flex-col justify-center gap-4">
          <span className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.22em]">
            Champion
          </span>
          <div className="border-ink bg-candy-tint shadow-sticker-candy flex flex-col items-center gap-1 rounded-2xl border-2 p-4 text-center">
            <Trophy className="text-candy-dark h-6 w-6" strokeWidth={2.25} aria-hidden />
            <span className="font-serif text-lg font-semibold">{championSlot?.label ?? "TBD"}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
