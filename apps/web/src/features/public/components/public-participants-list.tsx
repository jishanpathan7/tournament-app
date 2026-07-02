"use client";

import type { PublicParticipantView } from "@tournament/api-client";
import { Users } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicDivisions, usePublicParticipants } from "@/features/public/use-public-tournament";

/** Every approved participant, grouped by division, each linking to their profile. */
export function PublicParticipantsList({ slug }: { slug: string }) {
  const divisions = usePublicDivisions(slug);
  const participants = usePublicParticipants(slug);

  const byDivision = useMemo(() => {
    const map = new Map<string, PublicParticipantView[]>();
    for (const p of participants.data ?? []) {
      map.set(p.divisionId, [...(map.get(p.divisionId) ?? []), p]);
    }
    return map;
  }, [participants.data]);

  if (divisions.isLoading || participants.isLoading) {
    return <Skeleton className="h-64 rounded-2xl" />;
  }
  if (participants.isError) {
    return <ErrorState error={participants.error} onRetry={() => participants.refetch()} />;
  }
  if ((participants.data?.length ?? 0) === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No participants yet"
        description="Approved entrants will show up here."
        className="py-16"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {(divisions.data ?? []).map((division) => {
        const rows = byDivision.get(division.id) ?? [];
        if (rows.length === 0) return null;
        return (
          <section key={division.id} className="flex flex-col gap-3">
            <h2 className="font-serif text-xl font-semibold tracking-tight">{division.name}</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((p) => (
                <Link
                  key={p.id}
                  href={`/t/${slug}/participants/${p.id}`}
                  className="border-ink bg-card shadow-sticker-xs hover:shadow-sticker-md ease-bouncy flex items-center gap-2 rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition-[transform,box-shadow] hover:-translate-y-0.5"
                >
                  {p.seed != null ? (
                    <span className="border-ink bg-yellow-tint rounded-md border-2 px-1.5 py-0.5 font-mono text-2xs font-bold">
                      {p.seed}
                    </span>
                  ) : null}
                  <span className="truncate">{p.displayName}</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
