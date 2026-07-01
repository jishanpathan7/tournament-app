"use client";

import { ArrowRight, Users } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { deriveCapacity } from "@/features/registrations/capacity";
import { useParticipants, useRegistrations } from "@/features/registrations/use-registrations";

/**
 * Compact capacity/pending glance inside the tournament detail, linking out to the full
 * Registration Management screen (search/filters/bulk actions/detail) rather than
 * cramming that into this panel.
 */
export function RegistrationsSummaryLink({
  tournamentId,
  divisionId,
  capacity,
  canManage,
}: {
  tournamentId: string;
  divisionId: string;
  capacity: number | null;
  canManage: boolean;
}) {
  const registrations = useRegistrations(divisionId, { enabled: canManage });
  const participants = useParticipants(divisionId);

  if (registrations.isLoading || participants.isLoading) {
    return <Skeleton className="h-10 border-0" />;
  }

  const summary = deriveCapacity(capacity, registrations.data ?? [], participants.data ?? []);

  return (
    <Link
      href={`/console/tournaments/${tournamentId}/divisions/${divisionId}/registrations`}
      className="focus-visible:bg-muted group flex items-center justify-between gap-3 rounded-xl px-1 py-1 outline-none"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Users className="h-4 w-4" strokeWidth={2.25} />
          {summary.approved}
          {capacity !== null ? ` / ${capacity}` : ""} approved
        </span>
        {canManage && summary.pending > 0 ? (
          <Badge tone="candy">{summary.pending} pending</Badge>
        ) : null}
        {summary.waitlisted > 0 ? (
          <Badge tone="yellow">{summary.waitlisted} waitlisted</Badge>
        ) : null}
      </div>
      <span className="text-candy-dark flex items-center gap-1 text-sm font-semibold">
        {canManage ? "Manage registrations" : "View participants"}
        <ArrowRight
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          strokeWidth={2.5}
        />
      </span>
    </Link>
  );
}
