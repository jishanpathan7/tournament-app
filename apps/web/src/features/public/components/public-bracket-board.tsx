"use client";

import type { MatchView, PublicParticipantView } from "@tournament/api-client";
import { Trophy } from "lucide-react";
import Link from "next/link";

import { TeamBadge } from "@/components/ui/team-badge";
import { groupMatchesByRound } from "@/features/draws/config";
import { cn } from "@/lib/utils";

interface Slot {
  key: string;
  participantId: string | null;
  label: string;
  teamName: string | null | undefined;
  seedLabel: string | null;
  score: string | null;
  isWinner: boolean;
  isPlaceholder: boolean;
}

function buildSlots(
  match: MatchView,
  participantsById: Map<string, PublicParticipantView>,
): Slot[] {
  const slots: Slot[] = match.sides.map((side) => {
    const participant = participantsById.get(side.participantId);
    return {
      key: side.participantId,
      participantId: side.participantId,
      label: participant?.displayName ?? "Unknown",
      teamName: participant?.teamName,
      seedLabel: participant?.seed != null ? String(participant.seed) : null,
      score: side.scoreFor != null ? String(side.scoreFor) : null,
      isWinner: side.outcome === "win",
      isPlaceholder: false,
    };
  });
  while (slots.length < 2) {
    const isBye = match.status === "walkover" && slots.length === 1;
    slots.push({
      key: `placeholder-${match.id}-${slots.length}`,
      participantId: null,
      label: isBye ? "Bye" : "TBD",
      teamName: null,
      seedLabel: null,
      score: null,
      isWinner: false,
      isPlaceholder: !isBye,
    });
  }
  return slots;
}

function SlotLabel({ slug, slot }: { slug: string; slot: Slot }) {
  if (!slot.participantId) return <span className="truncate">{slot.label}</span>;
  return (
    <Link
      href={`/t/${slug}/participants/${slot.participantId}`}
      className="truncate hover:underline"
    >
      {slot.label}
    </Link>
  );
}

function SeedCard({
  slug,
  match,
  participantsById,
}: {
  slug: string;
  match: MatchView;
  participantsById: Map<string, PublicParticipantView>;
}) {
  const slots = buildSlots(match, participantsById);
  return (
    <div
      className="border-ink bg-card shadow-sticker overflow-hidden rounded-2xl border-2"
      data-match-status={match.status}
    >
      {slots.map((slot) => (
        <div
          key={slot.key}
          className={cn(
            "border-border flex items-center gap-2.5 border-t px-3 py-2.5 text-sm first:border-t-0",
            slot.isWinner && "font-bold",
            slot.isPlaceholder && "text-muted-foreground italic",
            !slot.isWinner &&
              !slot.isPlaceholder &&
              match.status !== "pending" &&
              "text-muted-foreground",
          )}
        >
          {slot.seedLabel ? (
            <span className="border-ink bg-yellow-tint text-2xs rounded-md border-2 px-1.5 py-0.5 font-mono font-bold">
              {slot.seedLabel}
            </span>
          ) : null}
          <div className="flex min-w-0 flex-col">
            <TeamBadge teamName={slot.teamName} />
            <SlotLabel slug={slug} slot={slot} />
          </div>
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

/** Single-elimination bracket: columns per round, no connector lines, horizontal
 * scroll on mobile — matches the Candy Sticker reference. Every participant name
 * links through to their public profile ("participant navigation"). */
export function PublicBracketBoard({
  slug,
  matches,
  participantsById,
}: {
  slug: string;
  matches: MatchView[];
  participantsById: Map<string, PublicParticipantView>;
}) {
  const rounds = groupMatchesByRound(matches);
  const finalRound = rounds[rounds.length - 1];
  const finalMatch = finalRound?.matches[0];
  const championSlot =
    finalMatch && (finalMatch.status === "completed" || finalMatch.status === "walkover")
      ? buildSlots(finalMatch, participantsById).find((s) => s.isWinner)
      : null;

  return (
    <div
      className="flex items-stretch gap-6 overflow-x-auto pb-6 pt-2 sm:gap-10"
      role="group"
      aria-label="Bracket"
    >
      {rounds.map((round) => (
        <div key={round.key} className="flex min-w-[200px] flex-col justify-around gap-4">
          <span className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.22em]">
            {round.label}
          </span>
          {round.matches.map((match) => (
            <SeedCard
              key={match.id}
              slug={slug}
              match={match}
              participantsById={participantsById}
            />
          ))}
        </div>
      ))}
      {finalRound ? (
        <div className="flex min-w-[170px] flex-col justify-center gap-4">
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
