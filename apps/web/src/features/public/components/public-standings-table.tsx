"use client";

import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { participantName } from "@/features/public/config";
import { usePublicParticipants, usePublicStandings } from "@/features/public/use-public-tournament";

/** Rankings, W-D-L, points, and game difference for one stage. Point difference (raw
 * badminton points, not games) isn't tracked as a persisted, queryable aggregate
 * anywhere in the backend today — only game difference is — so it's intentionally
 * left out rather than fabricated; see the PR description for the full reasoning. */
export function PublicStandingsTable({ slug, stageId }: { slug: string; stageId: string }) {
  const standings = usePublicStandings(slug, stageId);
  const participants = usePublicParticipants(slug);

  const participantsById = useMemo(
    () => new Map((participants.data ?? []).map((p) => [p.id, p])),
    [participants.data],
  );
  const rows = (standings.data?.rows ?? [])
    .slice()
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

  if (standings.isLoading || participants.isLoading) {
    return <Skeleton className="h-64 rounded-2xl" />;
  }
  if (standings.isError) {
    return <ErrorState error={standings.error} onRetry={() => standings.refetch()} />;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No standings yet"
        description="Standings appear once matches in this stage are completed."
        className="py-16"
      />
    );
  }

  return (
    <div className="border-ink bg-card shadow-sticker-md overflow-x-auto rounded-2xl border-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border text-muted-foreground text-2xs border-b-2 text-left font-mono font-semibold uppercase tracking-[0.14em]">
            <th className="px-4 py-2.5">#</th>
            <th className="px-4 py-2.5">Participant</th>
            <th className="px-4 py-2.5 text-right">W</th>
            <th className="px-4 py-2.5 text-right">D</th>
            <th className="px-4 py-2.5 text-right">L</th>
            <th className="px-4 py-2.5 text-right">Diff</th>
            <th className="px-4 py-2.5 text-right">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.participantId} className="border-border border-t">
              <td className="text-muted-foreground px-4 py-2.5 font-mono tabular-nums">
                {row.rank ?? "—"}
              </td>
              <td className="px-4 py-2.5">
                <Link
                  href={`/t/${slug}/participants/${row.participantId}`}
                  className="font-semibold hover:underline"
                >
                  {participantName(row.participantId, participantsById)}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums">{row.won}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums">{row.drawn}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums">{row.lost}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                {row.diff > 0 ? `+${row.diff}` : row.diff}
              </td>
              <td className="px-4 py-2.5 text-right font-mono font-bold tabular-nums">
                {row.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
