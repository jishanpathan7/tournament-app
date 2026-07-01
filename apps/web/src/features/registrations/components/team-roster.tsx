"use client";

import { Users } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useTeam } from "@/features/registrations/use-registrations";

/** Approved roster (partner/teammate names) for a pair/team participant. Backend-authoritative. */
export function TeamRoster({ teamId }: { teamId: string }) {
  const { data: team, isLoading, isError } = useTeam(teamId);

  if (isLoading) return <Skeleton className="h-16 border-0" />;
  if (isError || !team) return null;

  return (
    <div className="border-border rounded-xl border-2 p-3">
      <p className="text-muted-foreground text-2xs flex items-center gap-1.5 font-mono font-semibold uppercase tracking-[0.16em]">
        <Users className="h-3.5 w-3.5" strokeWidth={2.25} />
        {team.name}
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {team.roster.map((entry) => (
          <li key={entry.id} className="text-sm">
            {entry.externalName ?? "Registered player"}
            {entry.role ? <span className="text-muted-foreground"> · {entry.role}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
