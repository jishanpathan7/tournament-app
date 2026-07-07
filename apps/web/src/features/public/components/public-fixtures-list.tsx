"use client";

import type { MatchView, PublicParticipantView, PublicStageView } from "@tournament/api-client";
import { CalendarDays, ChevronDown, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { matchStatusMeta } from "@/features/draws/config";
import {
  ALL,
  applyFixtureRowFilters,
  DEFAULT_FIXTURE_FILTERS,
  type FixtureBucket,
  type FixtureRow,
  groupRowsByBucket,
  nestFranchiseFixtures,
  participantName,
} from "@/features/public/config";
import {
  usePublicMatches,
  usePublicParticipants,
  usePublicStages,
} from "@/features/public/use-public-tournament";
import { getFormat } from "@/features/tournaments/config";

const BUCKET_LABELS: Record<FixtureBucket, string> = {
  today: "Today",
  upcoming: "Upcoming",
  completed: "Completed",
};

function MatchSides({
  match,
  participantsById,
}: {
  match: MatchView;
  participantsById: Map<string, PublicParticipantView>;
}) {
  const [a, b] = match.sides;
  return (
    <span className="truncate">
      <span className={a?.outcome === "win" ? "font-bold" : ""}>
        {participantName(a?.participantId, participantsById)}
      </span>
      <span className="text-muted-foreground"> vs </span>
      <span className={b?.outcome === "win" ? "font-bold" : ""}>
        {participantName(b?.participantId, participantsById)}
      </span>
    </span>
  );
}

function FixtureCard({
  slug,
  row,
  participantsById,
}: {
  slug: string;
  row: FixtureRow;
  participantsById: Map<string, PublicParticipantView>;
}) {
  const { match, legs } = row;
  const status = matchStatusMeta(match.status);
  const [open, setOpen] = useState(false);
  const isTie = row.kind === "tie" && (legs?.length ?? 0) > 0;

  if (!isTie) {
    return (
      <Link
        href={`/t/${slug}/matches/${match.id}`}
        className="border-ink bg-card shadow-sticker-xs hover:shadow-sticker-md ease-bouncy flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-sm transition-[transform,box-shadow] hover:-translate-y-0.5"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <MatchSides match={match} participantsById={participantsById} />
          <span className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.14em]">
            {match.roundLabel ?? "Round"}
            {match.groupName ? ` · ${match.groupName}` : ""}
          </span>
        </div>
        <Badge tone={status.tone} className="shrink-0">
          {status.label}
        </Badge>
      </Link>
    );
  }

  return (
    <div className="border-ink bg-card shadow-sticker-xs rounded-2xl border-2 text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hover:bg-muted/40 flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <MatchSides match={match} participantsById={participantsById} />
          <span className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.14em]">
            Team tie · {match.roundLabel ?? "Round"}
            {legs?.length ? ` · ${legs.length} legs` : ""}
          </span>
        </div>
        <Badge tone={status.tone} className="shrink-0 capitalize">
          {status.label}
        </Badge>
        <ChevronDown
          className={`text-muted-foreground h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2.25}
        />
      </button>
      {open ? (
        <div className="border-ink/10 flex flex-col gap-1 border-t px-3 py-2">
          {legs!.map((leg) => {
            const legStatus = matchStatusMeta(leg.status);
            return (
              <Link
                key={leg.id}
                href={`/t/${slug}/matches/${leg.id}`}
                className="hover:bg-muted/40 flex items-center justify-between gap-3 rounded-xl px-2 py-2"
              >
                <MatchSides match={leg} participantsById={participantsById} />
                <Badge tone={legStatus.tone} className="shrink-0 capitalize">
                  {legStatus.label}
                </Badge>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Today's / upcoming / completed matches, filterable by stage, round, and participant. */
export function PublicFixturesList({ slug }: { slug: string }) {
  const matches = usePublicMatches(slug);
  const stages = usePublicStages(slug);
  const participants = usePublicParticipants(slug);
  const [filters, setFilters] = useState(DEFAULT_FIXTURE_FILTERS);

  const participantsById = useMemo(
    () => new Map((participants.data ?? []).map((p) => [p.id, p])),
    [participants.data],
  );
  const rows = useMemo(() => nestFranchiseFixtures(matches.data ?? []), [matches.data]);
  const filtered = useMemo(
    () => applyFixtureRowFilters(rows, filters, participantsById),
    [rows, filters, participantsById],
  );
  const buckets = useMemo(() => groupRowsByBucket(filtered), [filtered]);

  const rounds = useMemo(() => {
    const seen = new Map<string, { seq: number; label: string }>();
    for (const m of matches.data ?? []) {
      if (m.contestKind === "leg") continue;
      if (m.roundId && !seen.has(m.roundId)) {
        seen.set(m.roundId, { seq: m.roundSeq ?? 0, label: m.roundLabel ?? "Round" });
      }
    }
    return [...seen.entries()].sort((a, b) => a[1].seq - b[1].seq);
  }, [matches.data]);

  if (matches.isLoading || stages.isLoading) {
    return <Skeleton className="h-64 rounded-2xl" />;
  }
  if (matches.isError) {
    return <ErrorState error={matches.error} onRetry={() => matches.refetch()} />;
  }
  if ((matches.data?.length ?? 0) === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No fixtures yet"
        description="Matches will show up here once the draw is published."
        className="py-16"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
            strokeWidth={2.25}
            aria-hidden
          />
          <Input
            type="search"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search by participant name…"
            aria-label="Search fixtures"
            className="h-10 pl-10 pr-9"
          />
          {filters.search ? (
            <button
              type="button"
              onClick={() => setFilters({ ...filters, search: "" })}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4" strokeWidth={2.25} />
            </button>
          ) : null}
        </div>

        <Select
          value={filters.stageId}
          onValueChange={(stageId) => setFilters({ ...filters, stageId })}
        >
          <SelectTrigger className="sm:w-48" aria-label="Filter by stage">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All stages</SelectItem>
            {(stages.data ?? []).map((stage: PublicStageView) => (
              <SelectItem key={stage.id} value={stage.id}>
                {getFormat(stage.type)?.label ?? stage.type} · Stage {stage.seq + 1}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {rounds.length > 1 ? (
          <Select
            value={filters.roundId}
            onValueChange={(roundId) => setFilters({ ...filters, roundId })}
          >
            <SelectTrigger className="sm:w-40" aria-label="Filter by round">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All rounds</SelectItem>
              {rounds.map(([id, r]) => (
                <SelectItem key={id} value={id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {(["today", "upcoming", "completed"] as const).map((bucket) =>
        buckets[bucket].length > 0 ? (
          <div key={bucket} className="flex flex-col gap-3">
            <h2 className="font-serif text-xl font-semibold tracking-tight">
              {BUCKET_LABELS[bucket]}
            </h2>
            <div className="flex flex-col gap-2">
              {buckets[bucket].map((row) => (
                <FixtureCard
                  key={row.match.id}
                  slug={slug}
                  row={row}
                  participantsById={participantsById}
                />
              ))}
            </div>
          </div>
        ) : null,
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No matches match"
          description="Try different filters."
        />
      ) : null}
    </div>
  );
}
