"use client";

import { BarChart3, HelpCircle } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamBadge } from "@/components/ui/team-badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
            <th className="px-3 py-2 sm:px-4 sm:py-2.5">#</th>
            <th className="px-3 py-2 sm:px-4 sm:py-2.5">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-help items-center gap-1">
                      Participant
                      <HelpCircle className="h-3 w-3 opacity-50" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-56 text-xs leading-relaxed">
                    <p className="font-semibold">Tiebreaker order</p>
                    <ol className="mt-1 list-decimal pl-4">
                      <li>Points (3 win / 1 draw / 0 loss)</li>
                      <li>Game difference (games won − lost)</li>
                      <li>Head-to-head result</li>
                      <li>Alphabetical (if still tied)</li>
                    </ol>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </th>
            <th className="px-3 py-2 text-right sm:px-4 sm:py-2.5">W</th>
            <th className="px-3 py-2 text-right sm:px-4 sm:py-2.5">D</th>
            <th className="px-3 py-2 text-right sm:px-4 sm:py-2.5">L</th>
            <th className="px-3 py-2 text-right sm:px-4 sm:py-2.5">Diff</th>
            <th className="px-3 py-2 text-right sm:px-4 sm:py-2.5">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.participantId} className="border-border border-t">
              <td className="text-muted-foreground px-3 py-2 font-mono tabular-nums sm:px-4 sm:py-2.5">
                {row.rank ?? "—"}
              </td>
              <td className="px-3 py-2 sm:px-4 sm:py-2.5">
                <div className="flex flex-col gap-0.5">
                  <TeamBadge teamName={participantsById.get(row.participantId)?.teamName} />
                  <Link
                    href={`/t/${slug}/participants/${row.participantId}`}
                    className="font-semibold hover:underline"
                  >
                    {participantName(row.participantId, participantsById)}
                  </Link>
                </div>
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums sm:px-4 sm:py-2.5">
                {row.won}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums sm:px-4 sm:py-2.5">
                {row.drawn}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums sm:px-4 sm:py-2.5">
                {row.lost}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums sm:px-4 sm:py-2.5">
                {row.diff > 0 ? `+${row.diff}` : row.diff}
              </td>
              <td className="px-3 py-2 text-right font-mono font-bold tabular-nums sm:px-4 sm:py-2.5">
                {row.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
