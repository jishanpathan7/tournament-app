"use client";

import type { MatchView, ParticipantResponse, StandingsView } from "@tournament/api-client";

import { Badge } from "@/components/ui/badge";
import { TeamBadge } from "@/components/ui/team-badge";
import { groupMatchesByGroup, matchStatusMeta } from "@/features/draws/config";

function participantName(
  id: string | undefined,
  participantsById: Map<string, ParticipantResponse>,
): string {
  if (!id) return "TBD";
  return participantsById.get(id)?.displayName ?? "Unknown";
}

function FixtureRow({
  match,
  participantsById,
}: {
  match: MatchView;
  participantsById: Map<string, ParticipantResponse>;
}) {
  const [a, b] = match.sides;
  const status = matchStatusMeta(match.status);
  return (
    <div className="border-border flex items-center gap-3 border-t px-4 py-3 text-sm first:border-t-0">
      <div className={`flex min-w-0 flex-1 flex-col ${a?.outcome === "win" ? "font-bold" : ""}`}>
        <TeamBadge teamName={participantsById.get(a?.participantId ?? "")?.teamName} />
        <span className="truncate">{participantName(a?.participantId, participantsById)}</span>
      </div>
      {match.status === "pending" || match.status === "scheduled" ? (
        <span className="text-muted-foreground text-xs">vs</span>
      ) : (
        <span className="text-muted-foreground font-mono text-xs">
          {a?.scoreFor ?? "—"} · {b?.scoreFor ?? "—"}
        </span>
      )}
      <div
        className={`flex min-w-0 flex-1 flex-col items-end ${b?.outcome === "win" ? "font-bold" : ""}`}
      >
        <TeamBadge teamName={participantsById.get(b?.participantId ?? "")?.teamName} />
        <span className="truncate">{participantName(b?.participantId, participantsById)}</span>
      </div>
      <Badge tone={status.tone} className="shrink-0">
        {status.label}
      </Badge>
    </div>
  );
}

/** Round robin visualization: fixtures grouped by pool (or a single implicit pool),
 * ordered rounds within each — participant names + scheduling status per row. */
export function RoundRobinBoard({
  matches,
  participantsById,
  standings,
}: {
  matches: MatchView[];
  participantsById: Map<string, ParticipantResponse>;
  standings?: StandingsView;
}) {
  const groups = groupMatchesByGroup(matches);
  const standingsByGroup = new Map<string | null, StandingsView["rows"]>();
  for (const row of standings?.rows ?? []) {
    const key = row.groupId;
    standingsByGroup.set(key, [...(standingsByGroup.get(key) ?? []), row]);
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => {
        const rows = (standingsByGroup.get(group.key === "ungrouped" ? null : group.key) ?? [])
          .slice()
          .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
        return (
          <div key={group.key} className="flex flex-col gap-3">
            <h3 className="font-serif text-lg font-semibold tracking-tight">{group.label}</h3>
            <div className="border-ink bg-card shadow-sticker-md overflow-hidden rounded-2xl border-2">
              {group.matches.map((match) => (
                <FixtureRow key={match.id} match={match} participantsById={participantsById} />
              ))}
            </div>
            {rows.length > 0 ? (
              <div className="border-ink bg-card shadow-sticker-xs overflow-hidden rounded-2xl border-2">
                <div className="border-border text-2xs text-muted-foreground grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 border-b px-4 py-2 font-mono font-semibold uppercase tracking-[0.16em]">
                  <span>#</span>
                  <span>Participant</span>
                  <span>W-D-L</span>
                  <span>Diff</span>
                  <span>Pts</span>
                </div>
                {rows.map((row) => (
                  <div
                    key={row.participantId}
                    className="border-border grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 border-t px-4 py-2 text-sm first:border-t-0"
                  >
                    <span className="text-muted-foreground font-mono text-xs">
                      {row.rank ?? "—"}
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <TeamBadge teamName={participantsById.get(row.participantId)?.teamName} />
                      <span className="truncate">
                        {participantsById.get(row.participantId)?.displayName ?? "Unknown"}
                      </span>
                    </div>
                    <span className="text-muted-foreground font-mono text-xs">
                      {row.won}-{row.drawn}-{row.lost}
                    </span>
                    <span className="text-muted-foreground font-mono text-xs">
                      {row.diff > 0 ? `+${row.diff}` : row.diff}
                    </span>
                    <span className="font-mono text-xs font-bold">{row.points}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
