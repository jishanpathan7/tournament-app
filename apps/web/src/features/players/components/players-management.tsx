"use client";

import type { ParticipantResponse } from "@tournament/api-client";
import { UserPlus, Users } from "lucide-react";
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
import type {
  ParticipantStatusFilter,
  PlayerRow,
  PlayerSkillFilter,
} from "@/features/players/players-config";
import { filterPlayerRowsByStatus } from "@/features/players/players-config";
import {
  useFilteredPlayers,
  useTournamentPlayers,
} from "@/features/players/use-tournament-players";
import { RegistrationDetailDialog } from "@/features/registrations/components/registration-detail-dialog";
import { useParticipants } from "@/features/registrations/use-registrations";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { paginate } from "@/lib/paginate";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

const STATUS_FILTERS: { value: ParticipantStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending approval" },
  { value: "checked_in", label: "Checked in" },
];

function ParticipantStatusPills({
  status,
  onStatusChange,
}: {
  status: ParticipantStatusFilter;
  onStatusChange: (status: ParticipantStatusFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {STATUS_FILTERS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onStatusChange(opt.value)}
          className={cn(
            "text-2xs rounded-full border-2 px-3 py-1 font-mono font-semibold uppercase tracking-[0.14em] transition-colors",
            status === opt.value
              ? "border-ink bg-ink text-white"
              : "border-ink/20 hover:border-ink/40",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Tournament-wide participant roster — import, approve, and check-in in one place. */
export function PlayersManagement({ tournamentId }: { tournamentId: string }) {
  const can = useCan();
  const canManage = can(ACTIONS.TOURNAMENT_UPDATE);
  const data = useTournamentPlayers(tournamentId, { enabled: canManage });

  const [search, setSearch] = useState("");
  const [skill, setSkill] = useState<PlayerSkillFilter>("all");
  const [statusFilter, setStatusFilter] = useState<ParticipantStatusFilter>("all");
  const [importOpen, setImportOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [openRow, setOpenRow] = useState<PlayerRow | null>(null);

  const { filtered: searchFiltered } = useFilteredPlayers(data.rows, search, skill);
  const filtered = useMemo(
    () => filterPlayerRowsByStatus(searchFiltered, statusFilter),
    [searchFiltered, statusFilter],
  );
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
      <ErrorState
        error={data.error}
        onRetry={() => data.refetch()}
        title="Couldn't load participants"
      />
    );
  }

  const divisions = data.divisions.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Roster"
          title="Participants"
          description={
            data.stats.pairs
              ? "Players in the roster — pairs and franchise teams are tracked separately once pairing is published."
              : "Everyone in this tournament — import, approve, and check in from one list."
          }
        />
        {canManage && primaryDivisionId ? (
          <div className="flex flex-wrap gap-2">
            <Button tone="paper" size="sm" onClick={() => setImportOpen((v) => !v)}>
              Import CSV
            </Button>
            <Button asChild tone="candy">
              <Link
                href={`/console/tournaments/${tournamentId}/divisions/${primaryDivisionId}/registrations`}
              >
                <UserPlus className="h-4 w-4" strokeWidth={2.25} />
                Add participant
              </Link>
            </Button>
          </div>
        ) : null}
      </div>

      <PlayersStatRow stats={data.stats} />

      {canManage && divisions.length > 0 && importOpen ? (
        <PlayersImportPanel tournamentId={tournamentId} divisions={divisions} />
      ) : null}

      <Card className="flex flex-col gap-4 p-4 md:p-5">
        <div className="flex flex-col gap-4">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search participants"
            className="max-w-sm"
            aria-label="Search participants"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <ParticipantStatusPills
              status={statusFilter}
              onStatusChange={(next) => {
                setStatusFilter(next);
                setPage(1);
              }}
            />
            <PlayerFilterPills
              skill={skill}
              onSkillChange={(next) => {
                setSkill(next);
                setPage(1);
              }}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No participants yet"
            description={
              divisions.length === 0
                ? "Finish creating your tournament, then import players or share the registration link."
                : statusFilter === "pending"
                  ? "No one is waiting for approval."
                  : statusFilter === "checked_in"
                    ? "No one has checked in yet."
                    : "Import a CSV or share the registration link to collect entrants."
            }
            action={
              canManage && primaryDivisionId ? (
                <Button asChild tone="candy">
                  <Link
                    href={`/console/tournaments/${tournamentId}/divisions/${primaryDivisionId}/registrations`}
                  >
                    Open registration
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <PlayersTable
              rows={pageRows}
              onOpen={setOpenRow}
              canManage={canManage}
              participantsByDivision={data.participantsByDivision}
            />
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
