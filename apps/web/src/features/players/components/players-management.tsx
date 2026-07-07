"use client";

import type { ParticipantResponse } from "@tournament/api-client";
import { Sparkles, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { TableSkeleton } from "@/components/common/loading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { PlayersImportPanel } from "@/features/players/components/players-import-panel";
import { PlayersStatRow } from "@/features/players/components/players-stat-row";
import { PlayerFilterPills, PlayersTable } from "@/features/players/components/players-table";
import type { PlayerRow, PlayerSkillFilter } from "@/features/players/players-config";
import {
  useFilteredPlayers,
  useTournamentPlayers,
} from "@/features/players/use-tournament-players";
import { RegistrationDetailDialog } from "@/features/registrations/components/registration-detail-dialog";
import { useParticipants } from "@/features/registrations/use-registrations";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { paginate } from "@/lib/paginate";

const PAGE_SIZE = 20;

function firstPairingDivisionId(
  divisions: { id: string; participantType: string }[],
): string | null {
  const match = divisions.find(
    (d) => d.participantType === "individual" || d.participantType === "pair",
  );
  return match?.id ?? divisions[0]?.id ?? null;
}

/** Tournament-wide player roster — stats, import, and searchable table across divisions. */
export function PlayersManagement({ tournamentId }: { tournamentId: string }) {
  const can = useCan();
  const canManage = can(ACTIONS.TOURNAMENT_UPDATE);
  const data = useTournamentPlayers(tournamentId, { enabled: canManage || true });

  const [search, setSearch] = useState("");
  const [skill, setSkill] = useState<PlayerSkillFilter>("all");
  const [page, setPage] = useState(1);
  const [openRow, setOpenRow] = useState<PlayerRow | null>(null);

  const { filtered } = useFilteredPlayers(data.rows, search, skill);
  const pageRows = useMemo(() => paginate(filtered, page, PAGE_SIZE), [filtered, page]);

  const detailDivisionId = openRow?.divisionId ?? "";
  const participants = useParticipants(detailDivisionId, {
    enabled: !!openRow && !!detailDivisionId,
  });
  const participantsById = useMemo(
    () => new Map((participants.data ?? []).map((p) => [p.id, p])),
    [participants.data],
  );
  const detailParticipant: ParticipantResponse | null = openRow?.participantId
    ? (participantsById.get(openRow.participantId) ?? null)
    : null;

  const pairingDivisionId = firstPairingDivisionId(data.divisions.data ?? []);
  const primaryDivisionId = data.divisions.data?.[0]?.id ?? null;

  if (data.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-64 rounded-3xl" />
        <TableSkeleton rows={8} />
      </div>
    );
  }

  if (data.isError) {
    return (
      <ErrorState error={data.error} onRetry={() => data.refetch()} title="Couldn't load players" />
    );
  }

  const divisions = data.divisions.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Player management"
          title="Players"
          description="All entrants across divisions — import, review, and check-in status in one place."
        />
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            {pairingDivisionId ? (
              <Button asChild tone="pink">
                <Link
                  href={`/console/tournaments/${tournamentId}/divisions/${pairingDivisionId}/pairing`}
                >
                  <Sparkles className="h-4 w-4" strokeWidth={2.25} />
                  Smart pair
                </Link>
              </Button>
            ) : null}
            {primaryDivisionId ? (
              <Button asChild tone="candy">
                <Link
                  href={`/console/tournaments/${tournamentId}/divisions/${primaryDivisionId}/registrations`}
                >
                  <UserPlus className="h-4 w-4" strokeWidth={2.25} />
                  Add player
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <PlayersStatRow stats={data.stats} />

      {canManage && divisions.length > 0 ? (
        <PlayersImportPanel tournamentId={tournamentId} divisions={divisions} />
      ) : null}

      <Card className="flex flex-col gap-4 p-4 md:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search players"
            className="max-w-sm"
            aria-label="Search players"
          />
          <PlayerFilterPills
            skill={skill}
            onSkillChange={(next) => {
              setSkill(next);
              setPage(1);
            }}
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No players yet"
            description={
              divisions.length === 0
                ? "Add divisions to this tournament, then import or open registration."
                : "Import a CSV or share the registration link to collect entrants."
            }
            action={
              canManage && primaryDivisionId ? (
                <Button asChild tone="candy">
                  <Link
                    href={`/console/tournaments/${tournamentId}/divisions/${primaryDivisionId}/registrations`}
                  >
                    Open registrations
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <PlayersTable rows={pageRows} onOpen={setOpenRow} />
            <Pagination
              page={page}
              pageCount={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      {openRow ? (
        <RegistrationDetailDialog
          registration={openRow.registration}
          divisionId={openRow.divisionId}
          canManage={canManage}
          membersById={data.membersById}
          participant={detailParticipant}
          open={!!openRow}
          onOpenChange={(open) => {
            if (!open) setOpenRow(null);
          }}
        />
      ) : null}
    </div>
  );
}
