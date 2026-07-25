"use client";

import type { ParticipantResponse, RegistrationResponse } from "@tournament/api-client";
import { ArrowLeft, Download, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { TableSkeleton } from "@/components/common/loading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BulkActionBar } from "@/features/registrations/components/bulk-action-bar";
import { CapacitySummaryBar } from "@/features/registrations/components/capacity-summary";
import { ParticipantsTable } from "@/features/registrations/components/participants-table";
import { RegistrationDetailDialog } from "@/features/registrations/components/registration-detail-dialog";
import { RegistrationFiltersBar } from "@/features/registrations/components/registration-filters-bar";
import { RegistrationTable } from "@/features/registrations/components/registration-table";
import { deriveCapacity } from "@/features/registrations/capacity";
import { competitorsForDraw } from "@/features/registrations/franchise-roster";
import { downloadCsv, registrationsToCsv } from "@/features/registrations/config";
import {
  DEFAULT_REGISTRATION_FILTERS,
  applyRegistrationFilters,
} from "@/features/registrations/filter";
import {
  useParticipants,
  useRegistrations,
  useBulkApproveRegistrations,
} from "@/features/registrations/use-registrations";
import { useOrgMembers } from "@/features/orgs/use-orgs";
import { useDivisions } from "@/features/tournaments/use-tournaments";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { Pagination } from "@/components/ui/pagination";
import { paginate } from "@/lib/paginate";

const PAGE_SIZE = 20;

export function RegistrationManagement({
  tournamentId,
  divisionId,
}: {
  tournamentId: string;
  divisionId: string;
}) {
  const can = useCan();
  const canManage = can(ACTIONS.TOURNAMENT_UPDATE);

  const divisions = useDivisions(tournamentId);
  const division = divisions.data?.find((d) => d.id === divisionId) ?? null;

  const registrations = useRegistrations(divisionId, { enabled: canManage });
  const participants = useParticipants(divisionId);
  const members = useOrgMembers({ enabled: canManage });

  const bulkApprove = useBulkApproveRegistrations(divisionId);

  const [filters, setFilters] = useState(DEFAULT_REGISTRATION_FILTERS);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openRegistration, setOpenRegistration] = useState<RegistrationResponse | null>(null);

  const membersById = useMemo(
    () => new Map((members.data ?? []).map((m) => [m.userId, m])),
    [members.data],
  );
  const participantsById = useMemo(
    () => new Map((participants.data ?? []).map((p) => [p.id, p])),
    [participants.data],
  );
  const participantsByRegistrationId = useMemo(() => {
    const map = new Map<string, ParticipantResponse>();
    for (const r of registrations.data ?? []) {
      if (r.participantId) {
        const p = participantsById.get(r.participantId);
        if (p) map.set(r.id, p);
      }
    }
    return map;
  }, [registrations.data, participantsById]);

  const filtered = useMemo(
    () => applyRegistrationFilters(registrations.data ?? [], filters, membersById),
    [registrations.data, filters, membersById],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = paginate(filtered, currentPage, PAGE_SIZE);

  const capacity = useMemo(
    () =>
      deriveCapacity(division?.capacity ?? null, registrations.data ?? [], participants.data ?? []),
    [division, registrations.data, participants.data],
  );

  const drawCompetitors = useMemo(
    () => competitorsForDraw(participants.data ?? []),
    [participants.data],
  );
  const showCompetitorsOnly = drawCompetitors.length > 0 && capacity.pairs > 0;

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelectAll = () =>
    setSelected((prev) =>
      prev.size === visible.length ? new Set() : new Set(visible.map((r) => r.id)),
    );

  const exportCsv = (rows: RegistrationResponse[] = registrations.data ?? []) => {
    const csv = registrationsToCsv(rows, membersById, participantsById);
    downloadCsv(`registrations-${divisionId}.csv`, csv);
  };

  return (
    <div className="flex flex-col gap-6">
      <Button asChild tone="ghost" size="sm" className="text-muted-foreground -ml-2 self-start">
        <Link href={`/console/tournaments/${tournamentId}`}>
          <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
          Back to tournament
        </Link>
      </Button>

      <PageHeader
        eyebrow="Registration management"
        title={division?.name ?? "Registrations"}
        description="Review entrants, manage approvals, and keep capacity under control."
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild tone="paper" size="sm">
                <Link href={`/console/tournaments/${tournamentId}/divisions/${divisionId}/import`}>
                  <UserPlus className="h-4 w-4" strokeWidth={2.25} />
                  Import players
                </Link>
              </Button>
              <Button tone="paper" size="sm" onClick={() => exportCsv()}>
                <Download className="h-4 w-4" strokeWidth={2.25} />
                Export CSV
              </Button>
            </div>
          ) : undefined
        }
      />

      {registrations.isLoading || participants.isLoading ? (
        <Skeleton className="h-28 rounded-2xl" />
      ) : (
        <CapacitySummaryBar summary={capacity} />
      )}

      <Tabs defaultValue={canManage ? "registrations" : "participants"}>
        <TabsList>
          {canManage ? <TabsTrigger value="registrations">Registrations</TabsTrigger> : null}
          <TabsTrigger value="participants">
            {showCompetitorsOnly ? "Competitors" : "Participants"}
          </TabsTrigger>
        </TabsList>

        {canManage ? (
          <TabsContent value="registrations" className="flex flex-col gap-4 pt-4">
            <RegistrationFiltersBar
              filters={filters}
              onChange={(next) => {
                setFilters(next);
                setPage(1);
              }}
            />

            {(() => {
              const allPendingIds = (registrations.data ?? [])
                .filter((r) => r.status === "submitted")
                .map((r) => r.id);
              return selected.size === 0 && allPendingIds.length > 0 ? (
                <div className="border-candy bg-candy-tint flex items-center justify-between gap-4 rounded-2xl border-2 px-4 py-3">
                  <p className="text-sm font-semibold">
                    {allPendingIds.length} pending registration
                    {allPendingIds.length !== 1 ? "s" : ""}
                  </p>
                  <Button
                    tone="candy"
                    size="sm"
                    loading={bulkApprove.isPending}
                    disabled={bulkApprove.isPending}
                    onClick={() =>
                      bulkApprove.mutate(undefined, {
                        onSuccess: (r) =>
                          toast.success(
                            `Approved ${r.approved} registration${r.approved !== 1 ? "s" : ""}${r.waitlisted ? ` · ${r.waitlisted} waitlisted` : ""}`,
                          ),
                        onError: () => toast.error("Couldn't approve all — try again"),
                      })
                    }
                  >
                    {bulkApprove.isPending ? `Approving ${allPendingIds.length}…` : "Approve all"}
                  </Button>
                </div>
              ) : null;
            })()}

            {selected.size > 0 ? (
              <BulkActionBar
                divisionId={divisionId}
                selectedIds={[...selected]}
                onClear={() => setSelected(new Set())}
                onExport={() =>
                  exportCsv((registrations.data ?? []).filter((r) => selected.has(r.id)))
                }
              />
            ) : null}

            {registrations.isLoading ? (
              <TableSkeleton rows={6} />
            ) : registrations.isError ? (
              <ErrorState
                error={registrations.error}
                onRetry={() => registrations.refetch()}
                title="Couldn't load registrations"
              />
            ) : (registrations.data?.length ?? 0) === 0 ? (
              <EmptyState
                icon={UserPlus}
                title="No registrations yet"
                description="Entries show up here once players sign up."
                className="py-14"
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={UserPlus}
                title="No registrations match"
                description="Try a different search or clear the filters."
                action={
                  <Button
                    tone="paper"
                    size="sm"
                    onClick={() => setFilters(DEFAULT_REGISTRATION_FILTERS)}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <>
                <RegistrationTable
                  registrations={visible}
                  divisionId={divisionId}
                  canManage={canManage}
                  membersById={membersById}
                  selected={selected}
                  onToggleSelect={toggleSelect}
                  onToggleSelectAll={toggleSelectAll}
                  onOpen={setOpenRegistration}
                />
                <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} />
              </>
            )}
          </TabsContent>
        ) : null}

        <TabsContent value="participants" className="pt-4">
          {participants.isLoading ? (
            <TableSkeleton rows={6} />
          ) : participants.isError ? (
            <ErrorState error={participants.error} onRetry={() => participants.refetch()} />
          ) : (participants.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Users}
              title="No participants yet"
              description="Approved entrants appear here."
              className="py-14"
            />
          ) : drawCompetitors.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No competitors yet"
              description="Publish squad pairings to create doubles teams for the draw."
              className="py-14"
            />
          ) : (
            <>
              {showCompetitorsOnly ? (
                <p className="text-muted-foreground mb-4 text-sm">
                  Pairs and franchise teams entered into the draw. Player registrations are on the
                  Registrations tab.
                </p>
              ) : null}
              <ParticipantsTable
                participants={drawCompetitors}
                divisionId={divisionId}
                canManage={canManage}
              />
            </>
          )}
        </TabsContent>
      </Tabs>

      <RegistrationDetailDialog
        registration={openRegistration}
        divisionId={divisionId}
        canManage={canManage}
        membersById={membersById}
        participant={
          openRegistration ? (participantsByRegistrationId.get(openRegistration.id) ?? null) : null
        }
        open={!!openRegistration}
        onOpenChange={(open) => !open && setOpenRegistration(null)}
      />
    </div>
  );
}
