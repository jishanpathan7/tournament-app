"use client";

import type { MatchView, PublicParticipantView } from "@tournament/api-client";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { groupMatchesByGroup, matchStatusMeta } from "@/features/draws/config";
import { participantName } from "@/features/public/config";

function FixtureRow({
  slug,
  match,
  participantsById,
}: {
  slug: string;
  match: MatchView;
  participantsById: Map<string, PublicParticipantView>;
}) {
  const [a, b] = match.sides;
  const status = matchStatusMeta(match.status);
  const nameLink = (participantId: string | undefined, bold: boolean) =>
    participantId ? (
      <Link
        href={`/t/${slug}/participants/${participantId}`}
        className={`min-w-0 flex-1 truncate hover:underline ${bold ? "font-bold" : ""}`}
      >
        {participantName(participantId, participantsById)}
      </Link>
    ) : (
      <span className="text-muted-foreground min-w-0 flex-1 truncate italic">TBD</span>
    );

  return (
    <div className="border-border flex items-center gap-3 border-t px-4 py-3 text-sm first:border-t-0">
      {nameLink(a?.participantId, a?.outcome === "win")}
      {match.status === "pending" || match.status === "scheduled" ? (
        <span className="text-muted-foreground text-xs">vs</span>
      ) : (
        <span className="text-muted-foreground font-mono text-xs">
          {a?.scoreFor ?? "—"} · {b?.scoreFor ?? "—"}
        </span>
      )}
      <div className="min-w-0 flex-1 text-right">{nameLink(b?.participantId, b?.outcome === "win")}</div>
      <Badge tone={status.tone} className="shrink-0">
        {status.label}
      </Badge>
    </div>
  );
}

/** Round-robin fixtures grouped by pool — the Bracket page's round-robin format
 * (single elimination gets its own tree view; both live under the same "Bracket"
 * tab per stage/division). */
export function PublicRoundRobinFixtures({
  slug,
  matches,
  participantsById,
}: {
  slug: string;
  matches: MatchView[];
  participantsById: Map<string, PublicParticipantView>;
}) {
  const groups = groupMatchesByGroup(matches);

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-3">
          <h3 className="font-serif text-lg font-semibold tracking-tight">{group.label}</h3>
          <div className="border-ink bg-card shadow-sticker-md overflow-hidden rounded-2xl border-2">
            {group.matches.map((match) => (
              <FixtureRow key={match.id} slug={slug} match={match} participantsById={participantsById} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
