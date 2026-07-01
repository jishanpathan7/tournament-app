import type { TournamentResponse } from "@tournament/api-client";
import { ArrowRight, Eye, EyeOff, Globe } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { getSport } from "@/features/tournaments/config";
import { TournamentStatusBadge } from "@/features/tournaments/components/tournament-status-badge";

const VISIBILITY_ICON = { public: Globe, unlisted: Eye, private: EyeOff } as const;

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Tournament list card (Expressive tier): hover-lift, serif name, sport/date eyebrow, status. */
export function TournamentCard({ tournament }: { tournament: TournamentResponse }) {
  const sport = getSport(tournament.sportKey);
  const SportIcon = sport?.icon;
  const VisIcon = VISIBILITY_ICON[tournament.visibility as keyof typeof VISIBILITY_ICON] ?? Globe;
  const dates = formatDate(tournament.startsAt);

  return (
    <Card hoverable className="group flex flex-col p-5">
      <Link
        href={`/console/tournaments/${tournament.id}`}
        className="flex flex-1 flex-col outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-muted-foreground text-2xs flex items-center gap-1.5 font-mono font-semibold uppercase tracking-[0.18em]">
            {SportIcon ? <SportIcon className="h-3.5 w-3.5" strokeWidth={2.25} /> : null}
            {sport?.label ?? tournament.sportKey}
            {dates ? <span className="text-muted-foreground/70">· {dates}</span> : null}
          </p>
          <TournamentStatusBadge status={tournament.status} />
        </div>

        <h3 className="mt-3 font-serif text-xl font-semibold leading-tight tracking-tight">
          {tournament.name}
        </h3>

        <div className="text-muted-foreground mt-auto flex items-center justify-between pt-5">
          <span className="text-2xs flex items-center gap-1.5 font-mono uppercase tracking-[0.16em]">
            <VisIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
            {tournament.visibility}
          </span>
          <span className="text-candy-dark flex items-center gap-1 text-sm font-semibold">
            Open
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              strokeWidth={2.5}
            />
          </span>
        </div>
      </Link>
    </Card>
  );
}
