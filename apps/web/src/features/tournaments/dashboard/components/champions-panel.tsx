"use client";

import type { ChampionRow } from "@/features/tournaments/dashboard/config";
import { Crown } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";

export function ChampionsPanel({ champions }: { champions: ChampionRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Crown className="h-5 w-5" strokeWidth={2.25} />
          Champions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {champions.length === 0 ? (
          <EmptyState
            icon={Crown}
            title="No champions yet"
            description="Winners appear once final standings are computed."
            className="py-8"
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {champions.map((c) => (
              <li
                key={`${c.divisionId}-${c.participantId}`}
                className="border-ink bg-mint-tint flex flex-col gap-0.5 rounded-xl border-2 px-4 py-3"
              >
                <span className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.18em]">
                  {c.divisionName}
                </span>
                <span className="font-serif text-xl font-semibold">{c.displayName}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
