"use client";

import { Trophy } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { CardGridSkeleton } from "@/components/common/loading";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { TournamentCard } from "@/features/tournaments/components/tournament-card";
import { TournamentFiltersBar } from "@/features/tournaments/components/tournament-filters";
import { DEFAULT_FILTERS, applyTournamentFilters, paginate } from "@/features/tournaments/filter";
import { useTournaments } from "@/features/tournaments/use-tournaments";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";

const PAGE_SIZE = 9;

export function TournamentList() {
  const { data, isLoading, isError, error, refetch } = useTournaments();
  const can = useCan();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => applyTournamentFilters(data ?? [], filters), [data, filters]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = paginate(filtered, currentPage, PAGE_SIZE);

  const newButton = can(ACTIONS.TOURNAMENT_CREATE) ? (
    <Button asChild tone="candy">
      <Link href="/console/tournaments/new">+ New tournament</Link>
    </Button>
  ) : null;

  const total = data?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Console"
        title="Tournaments"
        description="Create, configure, and run your events."
        actions={newButton}
      />

      {/* Controls stay mounted across states so focus/keyboard flow is stable. */}
      {total > 0 ? (
        <TournamentFiltersBar
          filters={filters}
          onChange={(next) => {
            setFilters(next);
            setPage(1);
          }}
        />
      ) : null}

      {isLoading ? (
        <CardGridSkeleton count={6} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} title="Couldn't load tournaments" />
      ) : total === 0 ? (
        <EmptyState
          icon={Trophy}
          eyebrow="Get started"
          title="Run your first tournament"
          description="Create a tournament, open registration, generate the draw, and score matches live."
          action={newButton ?? undefined}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No tournaments match"
          description="Try a different search or clear the filters."
          action={
            <Button tone="paper" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
          <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
