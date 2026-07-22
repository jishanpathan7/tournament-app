"use client";

import { useQueries } from "@tanstack/react-query";
import { AlertTriangle, Repeat } from "lucide-react";
import { useMemo } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { getPairing } from "@/features/pairing/pairing-api";
import { useSquads } from "@/features/squads/use-squads";
import { useDivisions } from "@/features/tournaments/use-tournaments";
import { queryKeys } from "@/lib/query-keys";

/**
 * What the draw is about to do, shown before the organizer commits to it.
 *
 * Matches per fixture is set by the team holding the MOST pairs, so every pair
 * gets on court. A team with fewer pairs fields one of them twice, and which
 * pair that is rotates fixture to fixture. None of that was visible anywhere —
 * an organizer had no way to know a roster imbalance was about to double
 * someone's workload until the schedule already existed.
 */
export function DrawPlanPreview({ tournamentId }: { tournamentId: string }) {
  const squads = useSquads(tournamentId);
  const divisions = useDivisions(tournamentId);
  const divisionId = divisions.data?.[0]?.id ?? null;
  const squadIds = useMemo(() => squads.data?.squads.map((s) => s.id) ?? [], [squads.data]);

  const pairingQueries = useQueries({
    queries: squadIds.map((squadId) => ({
      queryKey: queryKeys.divisions.pairing(divisionId ?? "", squadId),
      queryFn: () => getPairing(divisionId!, squadId),
      enabled: !!divisionId,
    })),
  });

  const loading =
    squads.isLoading || divisions.isLoading || pairingQueries.some((q) => q.isLoading);

  const rows = useMemo(() => {
    const list = squads.data?.squads ?? [];
    return list.map((squad, i) => ({
      id: squad.id,
      name: squad.name,
      pairs: pairingQueries[i]?.data?.teams.length ?? 0,
    }));
  }, [squads.data, pairingQueries]);

  if (loading) return <Skeleton className="h-40 rounded-2xl" />;
  if (rows.length < 2 || rows.every((r) => r.pairs === 0)) return null;

  const teams = rows.length;
  const perFixture = Math.max(...rows.map((r) => r.pairs));
  const fixtures = (teams * (teams - 1)) / 2;
  const totalMatches = fixtures * perFixture;
  const short = rows.filter((r) => r.pairs > 0 && r.pairs < perFixture);
  const drawsPossible = perFixture % 2 === 0;

  return (
    <div className="border-ink bg-card rounded-2xl border-2 p-5">
      <p className="text-2xs text-muted-foreground mb-3 font-mono font-bold uppercase tracking-widest">
        What this will create
      </p>

      <div className="mb-4 flex flex-wrap gap-6">
        <Stat label="Fixtures" value={fixtures} hint="every team plays every team" />
        <Stat label="Matches per fixture" value={perFixture} hint="set by your largest team" />
        <Stat label="Total matches" value={totalMatches} hint="to schedule onto courts" />
      </div>

      <div className="flex flex-col gap-1.5">
        {rows.map((r) => {
          const doublesUp = r.pairs > 0 && r.pairs < perFixture;
          return (
            <div key={r.id} className="flex items-center gap-2 text-sm">
              <span className="w-40 shrink-0 truncate font-semibold">{r.name}</span>
              <span className="text-muted-foreground font-mono tabular-nums">
                {r.pairs} pair{r.pairs === 1 ? "" : "s"}
              </span>
              {r.pairs === 0 ? (
                <span className="text-pink-dark flex items-center gap-1 text-xs font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  no pairs published
                </span>
              ) : doublesUp ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-yellow-700 dark:text-yellow-400">
                  <Repeat className="h-3.5 w-3.5" />
                  {perFixture - r.pairs} pair{perFixture - r.pairs === 1 ? "" : "s"} play twice per
                  fixture
                </span>
              ) : (
                <span className="text-muted-foreground text-xs">every pair plays once</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-muted-foreground mt-4 flex flex-col gap-1 text-xs">
        <p>
          Every pair gets on court. Teams with fewer pairs field one twice, and which pair that is
          rotates each fixture so nobody carries it all day.
        </p>
        {short.length > 0 && (
          <p>
            Add {short.length === 1 ? "a pair" : "pairs"} to{" "}
            <span className="font-semibold">{short.map((r) => r.name).join(", ")}</span> before
            generating if you would rather everyone played the same number.
          </p>
        )}
        {short.length > 0 && (
          <p>
            Pair 1 meets pair 1, pair 2 meets pair 2, and so on. Teams that are a pair short field
            someone twice in the last match of each fixture, so only that match is unmatched.
          </p>
        )}
        {drawsPossible && (
          <p>
            With {perFixture} matches a fixture can finish level — a drawn fixture is worth 1 point
            to each team.
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div>
      <p className="font-mono text-2xl font-black tabular-nums">{value}</p>
      <p className="text-xs font-semibold">{label}</p>
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  );
}
