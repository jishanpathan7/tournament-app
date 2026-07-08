"use client";

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  buildPlayerRows,
  derivePlayerStats,
  deriveRosterStats,
  filterPlayerRows,
  type PlayerSkillFilter,
  type PlayerRow,
  type PlayerStats,
} from "@/features/players/players-config";
import * as registrationsApi from "@/features/registrations/registrations-api";
import * as opsApi from "@/features/registration-ops/registration-ops-api";
import { useOrgMembers } from "@/features/orgs/use-orgs";
import { useDivisions } from "@/features/tournaments/use-tournaments";
import { queryKeys } from "@/lib/query-keys";

export function useTournamentPlayers(tournamentId: string, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const divisions = useDivisions(tournamentId);
  const members = useOrgMembers({ enabled });

  const divisionIds = useMemo(() => (divisions.data ?? []).map((d) => d.id), [divisions.data]);

  const registrationQueries = useQueries({
    queries: divisionIds.map((divisionId) => ({
      queryKey: queryKeys.divisions.registrations(divisionId),
      queryFn: () => registrationsApi.listRegistrations(divisionId),
      enabled: enabled && divisionIds.length > 0,
    })),
  });

  const attendanceQueries = useQueries({
    queries: divisionIds.map((divisionId) => ({
      queryKey: queryKeys.attendance.division(divisionId),
      queryFn: () => opsApi.listAttendance(divisionId),
      enabled: enabled && divisionIds.length > 0,
    })),
  });

  const participantQueries = useQueries({
    queries: divisionIds.map((divisionId) => ({
      queryKey: queryKeys.divisions.participants(divisionId),
      queryFn: () => registrationsApi.listParticipants(divisionId),
      enabled: enabled && divisionIds.length > 0,
    })),
  });

  const registrationsByDivision = useMemo(() => {
    const map = new Map<string, Awaited<ReturnType<typeof registrationsApi.listRegistrations>>>();
    divisionIds.forEach((id, i) => {
      const data = registrationQueries[i]?.data;
      if (data) map.set(id, data);
    });
    return map;
  }, [divisionIds, registrationQueries]);

  const attendanceByDivision = useMemo(() => {
    const map = new Map<string, Awaited<ReturnType<typeof opsApi.listAttendance>>>();
    divisionIds.forEach((id, i) => {
      const data = attendanceQueries[i]?.data;
      if (data) map.set(id, data);
    });
    return map;
  }, [divisionIds, attendanceQueries]);

  const participantsByDivision = useMemo(() => {
    const map = new Map<string, Awaited<ReturnType<typeof registrationsApi.listParticipants>>>();
    divisionIds.forEach((id, i) => {
      const data = participantQueries[i]?.data;
      if (data) map.set(id, data);
    });
    return map;
  }, [divisionIds, participantQueries]);

  const membersById = useMemo(
    () => new Map((members.data ?? []).map((m) => [m.userId, m])),
    [members.data],
  );

  const rows = useMemo(() => {
    if (!divisions.data) return [];
    return buildPlayerRows(
      divisions.data,
      registrationsByDivision,
      attendanceByDivision,
      membersById,
    );
  }, [divisions.data, registrationsByDivision, attendanceByDivision, membersById]);

  const stats = useMemo(
    () => deriveRosterStats(rows, participantsByDivision),
    [rows, participantsByDivision],
  );

  const isLoading =
    divisions.isLoading ||
    registrationQueries.some((q) => q.isLoading) ||
    attendanceQueries.some((q) => q.isLoading) ||
    participantQueries.some((q) => q.isLoading);

  const isError =
    divisions.isError ||
    registrationQueries.some((q) => q.isError) ||
    attendanceQueries.some((q) => q.isError) ||
    participantQueries.some((q) => q.isError);

  const error =
    divisions.error ??
    registrationQueries.find((q) => q.error)?.error ??
    attendanceQueries.find((q) => q.error)?.error ??
    participantQueries.find((q) => q.error)?.error;

  const refetch = () => {
    void divisions.refetch();
    for (const q of registrationQueries) void q.refetch();
    for (const q of attendanceQueries) void q.refetch();
    for (const q of participantQueries) void q.refetch();
  };

  return {
    divisions,
    rows,
    stats,
    membersById,
    isLoading,
    isError,
    error,
    refetch,
  };
}

export function useFilteredPlayers(
  rows: PlayerRow[],
  search: string,
  skill: PlayerSkillFilter,
): { filtered: PlayerRow[]; stats: PlayerStats } {
  const filtered = useMemo(() => filterPlayerRows(rows, search, skill), [rows, search, skill]);
  const stats = useMemo(() => derivePlayerStats(filtered), [filtered]);
  return { filtered, stats };
}
