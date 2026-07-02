"use client";

import { ArrowLeft, Trophy, User } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { ErrorState } from "@/components/common/error-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { matchStatusMeta } from "@/features/draws/config";
import { PARTICIPANT_KINDS } from "@/features/tournaments/config";
import { participantName } from "@/features/public/config";
import {
  usePublicDivisions,
  usePublicMatches,
  usePublicParticipant,
  usePublicParticipants,
  usePublicStages,
  usePublicStandings,
} from "@/features/public/use-public-tournament";

const TERMINAL_STATUSES = new Set(["completed", "walkover", "no_show", "cancelled"]);

function MatchRow({
  slug,
  matchId,
  opponentLabel,
  status,
  roundLabel,
  outcome,
}: {
  slug: string;
  matchId: string;
  opponentLabel: string;
  status: string;
  roundLabel: string | null;
  outcome: string | null;
}) {
  const meta = matchStatusMeta(status);
  return (
    <Link
      href={`/t/${slug}/matches/${matchId}`}
      className="border-ink bg-card shadow-sticker-xs hover:shadow-sticker-md ease-bouncy flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-sm transition-[transform,box-shadow] hover:-translate-y-0.5"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`truncate ${outcome === "win" ? "font-bold" : ""}`}>vs {opponentLabel}</span>
        <span className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.14em]">
          {roundLabel ?? "Round"}
        </span>
      </div>
      <Badge tone={meta.tone} className="shrink-0">
        {meta.label}
      </Badge>
    </Link>
  );
}

/** A participant's public profile: who they are, where they stand, and every match
 * they've played (or will play) in this tournament — "tournament history" scoped to
 * this one event, since there's no cross-tournament player identity in the data
 * model to draw on (and inventing one is out of scope here). */
export function PublicParticipantProfile({
  slug,
  participantId,
}: {
  slug: string;
  participantId: string;
}) {
  const participant = usePublicParticipant(slug, participantId);
  const divisions = usePublicDivisions(slug);
  const stages = usePublicStages(slug);
  const matches = usePublicMatches(slug);
  const participants = usePublicParticipants(slug);

  const participantsById = useMemo(
    () => new Map((participants.data ?? []).map((p) => [p.id, p])),
    [participants.data],
  );
  const division = divisions.data?.find((d) => d.id === participant.data?.divisionId);
  const stage = stages.data?.find((s) => s.divisionId === participant.data?.divisionId);
  const standings = usePublicStandings(slug, stage?.id ?? null);
  const myRow = standings.data?.rows.find((r) => r.participantId === participantId);

  const myMatches = (matches.data ?? []).filter((m) =>
    m.sides.some((s) => s.participantId === participantId),
  );
  const current = myMatches.filter((m) => !TERMINAL_STATUSES.has(m.status));
  const completed = myMatches.filter((m) => TERMINAL_STATUSES.has(m.status));

  if (participant.isLoading) {
    return <Skeleton className="h-48 rounded-2xl" />;
  }
  if (participant.isError || !participant.data) {
    return <ErrorState error={participant.error} title="Participant not found" />;
  }

  const renderMatch = (match: (typeof myMatches)[number]) => {
    const mySide = match.sides.find((s) => s.participantId === participantId);
    const opponentSide = match.sides.find((s) => s.participantId !== participantId);
    return (
      <MatchRow
        key={match.id}
        slug={slug}
        matchId={match.id}
        opponentLabel={participantName(opponentSide?.participantId, participantsById)}
        status={match.status}
        roundLabel={match.roundLabel}
        outcome={mySide?.outcome ?? null}
      />
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/t/${slug}/participants`}
        className="text-muted-foreground -ml-1 flex items-center gap-1 self-start text-sm font-semibold hover:underline"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
        Participants
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <div className="border-ink bg-candy-tint text-candy-dark shadow-sticker-xs flex h-14 w-14 items-center justify-center rounded-full border-2">
          <User className="h-6 w-6" strokeWidth={2.25} />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            {participant.data.displayName}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="muted">
              {PARTICIPANT_KINDS[participant.data.kind as keyof typeof PARTICIPANT_KINDS] ??
                participant.data.kind}
            </Badge>
            {division ? <Badge tone="candy">{division.name}</Badge> : null}
            {participant.data.seed != null ? (
              <Badge tone="yellow">Seed {participant.data.seed}</Badge>
            ) : null}
          </div>
        </div>
      </div>

      {myRow ? (
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Trophy className="text-candy-dark h-5 w-5" strokeWidth={2.25} />
            <CardTitle className="text-lg">Standing</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.16em]">
                Rank
              </p>
              <p className="font-mono text-lg font-bold tabular-nums">{myRow.rank ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.16em]">
                W-D-L
              </p>
              <p className="font-mono text-lg font-bold tabular-nums">
                {myRow.won}-{myRow.drawn}-{myRow.lost}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.16em]">
                Points
              </p>
              <p className="font-mono text-lg font-bold tabular-nums">{myRow.points}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {current.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-xl font-semibold tracking-tight">Current matches</h2>
          <div className="flex flex-col gap-2">{current.map(renderMatch)}</div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-xl font-semibold tracking-tight">Match history</h2>
        {completed.length === 0 ? (
          <p className="text-muted-foreground text-sm">No completed matches yet.</p>
        ) : (
          <div className="flex flex-col gap-2">{completed.map(renderMatch)}</div>
        )}
      </section>
    </div>
  );
}
