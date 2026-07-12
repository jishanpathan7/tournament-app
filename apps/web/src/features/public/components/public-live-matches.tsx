"use client";

import type { MatchView, PublicParticipantView } from "@tournament/api-client";
import { Radio } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { matchStatusMeta } from "@/features/draws/config";
import { participantName } from "@/features/public/config";
import { usePublicMatches, usePublicParticipants } from "@/features/public/use-public-tournament";

function LiveFixtureCard({
  slug,
  match,
  participantsById,
}: {
  slug: string;
  match: MatchView;
  participantsById: Map<string, PublicParticipantView>;
}) {
  const status = matchStatusMeta(match.status);
  const [a, b] = match.sides;
  return (
    <Link
      href={`/t/${slug}/matches/${match.id}`}
      className="border-ink bg-card shadow-sticker-xs hover:shadow-sticker-md ease-bouncy flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-sm transition-[transform,box-shadow] hover:-translate-y-0.5"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate">
          <span className={a?.outcome === "win" ? "font-bold" : ""}>
            {participantName(a?.participantId, participantsById)}
          </span>
          <span className="text-muted-foreground"> vs </span>
          <span className={b?.outcome === "win" ? "font-bold" : ""}>
            {participantName(b?.participantId, participantsById)}
          </span>
        </span>
        <span className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.14em]">
          {match.roundLabel ?? "Round"}
        </span>
      </div>
      <Badge tone={status.tone} className="shrink-0">
        {status.label}
      </Badge>
    </Link>
  );
}

/** Today's matches only — the "Live" tab, shown while the tournament itself is live.
 * Same underlying data as Fixtures, just narrowed to today with no filter chrome. */
export function PublicLiveMatches({ slug }: { slug: string }) {
  const matches = usePublicMatches(slug);
  const participants = usePublicParticipants(slug);

  const participantsById = useMemo(
    () => new Map((participants.data ?? []).map((p) => [p.id, p])),
    [participants.data],
  );
  const today = useMemo(
    () => (matches.data ?? []).filter((m) => m.status === "in_progress"),
    [matches.data],
  );

  if (matches.isLoading) {
    return <Skeleton className="h-48 rounded-2xl" />;
  }
  if (matches.isError) {
    return <ErrorState error={matches.error} onRetry={() => matches.refetch()} />;
  }
  if (today.length === 0) {
    return (
      <EmptyState
        icon={Radio}
        title="Nothing live right now"
        description="Check Fixtures for the full schedule."
        className="py-16"
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {today.map((match) => (
        <LiveFixtureCard
          key={match.id}
          slug={slug}
          match={match}
          participantsById={participantsById}
        />
      ))}
    </div>
  );
}
