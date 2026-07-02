"use client";

import { Search, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicSearch } from "@/features/public/use-public-tournament";
import { TOURNAMENT_STATUS } from "@/features/tournaments/config";

/**
 * Tournament discovery — searches every org's `public` tournaments (not `unlisted`,
 * which is reachable only by direct link; see `app.modules.public.repository`).
 * Participant/team search is scoped to inside a tournament you've already opened
 * (the Fixtures and Participants pages both have their own search box) rather than a
 * global cross-tournament player search — see the PR description for why.
 */
export function PublicSearchPage() {
  const [query, setQuery] = useState("");
  const results = usePublicSearch(query);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-16 sm:px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Find a tournament</h1>
        <p className="text-muted-foreground max-w-md text-sm">
          Search by tournament name or organizer.
        </p>
      </div>

      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
          strokeWidth={2.25}
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tournaments…"
          aria-label="Search tournaments"
          autoFocus
          className="h-14 pl-12 text-base"
        />
      </div>

      {query.trim().length === 0 ? null : results.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      ) : results.isError ? (
        <ErrorState error={results.error} onRetry={() => results.refetch()} />
      ) : (results.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No tournaments found"
          description="Try a different search term."
          className="py-10"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {results.data!.map((result) => {
            const status = TOURNAMENT_STATUS[result.status as keyof typeof TOURNAMENT_STATUS];
            return (
              <Link
                key={result.slug}
                href={`/t/${result.slug}`}
                className="border-ink bg-card shadow-sticker-xs hover:shadow-sticker-md ease-bouncy flex items-center gap-3 rounded-2xl border-2 px-4 py-3 transition-[transform,box-shadow] hover:-translate-y-0.5"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-semibold">{result.name}</span>
                  <span className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.14em]">
                    {result.organizationName} · {result.sportKey}
                  </span>
                </div>
                {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
