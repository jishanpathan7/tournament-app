import type { TournamentResponse } from "@tournament/api-client";
import { CheckCircle2, Circle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PUBLISH_ARTIFACTS, VISIBILITIES, getSport } from "@/features/tournaments/config";

function fmt(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.18em]">
        {label}
      </dt>
      <dd className="text-sm font-semibold">{value}</dd>
    </div>
  );
}

/** Overview: core metadata + publication status of public artifacts. */
export function OverviewPanel({ tournament }: { tournament: TournamentResponse }) {
  const sport = getSport(tournament.sportKey);
  const visibility = VISIBILITIES.find((v) => v.value === tournament.visibility);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <MetaRow label="Sport" value={sport?.label ?? tournament.sportKey} />
            <MetaRow label="Visibility" value={visibility?.label ?? tournament.visibility} />
            <MetaRow label="Slug" value={tournament.slug} />
            <MetaRow label="Created" value={fmt(tournament.createdAt)} />
            <MetaRow label="Starts" value={fmt(tournament.startsAt)} />
            <MetaRow label="Ends" value={fmt(tournament.endsAt)} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Publication</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {PUBLISH_ARTIFACTS.map((a) => {
            const live = !!tournament[a.field];
            return (
              <div key={a.key} className="flex items-center justify-between">
                <span className="text-sm font-semibold">{a.label}</span>
                {live ? (
                  <span className="text-mint-dark text-2xs flex items-center gap-1.5 font-mono font-semibold uppercase tracking-[0.16em]">
                    <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />
                    Published
                  </span>
                ) : (
                  <span className="text-muted-foreground text-2xs flex items-center gap-1.5 font-mono uppercase tracking-[0.16em]">
                    <Circle className="h-4 w-4" strokeWidth={2.25} />
                    Draft
                  </span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
