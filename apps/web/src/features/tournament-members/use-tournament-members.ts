import type { TournamentRole } from "@tournament/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { queryKeys } from "@/lib/query-keys";

import * as api from "./tournament-members-api";

export function useTournamentMembers(tournamentId: string) {
  return useQuery({
    queryKey: queryKeys.tournamentMembers.list(tournamentId),
    queryFn: () => api.listMembers(tournamentId),
  });
}

export function useInviteMember(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { email: string; tournamentRole: TournamentRole }) =>
      api.inviteMember(tournamentId, {
        email: vars.email,
        tournamentRole: vars.tournamentRole,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.tournamentMembers.list(tournamentId) });
      toast.success("Invite sent");
    },
    onError: () => toast.error("Failed to send invite"),
  });
}

export function useUpdateMemberRole(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userId: string; tournamentRole: TournamentRole }) =>
      api.updateMemberRole(tournamentId, vars.userId, { tournamentRole: vars.tournamentRole }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.tournamentMembers.list(tournamentId) });
      toast.success("Role updated");
    },
    onError: () => toast.error("Failed to update role"),
  });
}

export function useRemoveMember(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.removeMember(tournamentId, userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.tournamentMembers.list(tournamentId) });
      toast.success("Member removed");
    },
    onError: () => toast.error("Failed to remove member"),
  });
}

export function useRevokeInvite(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => api.revokeInvite(tournamentId, inviteId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.tournamentMembers.list(tournamentId) });
      toast.success("Invite revoked");
    },
    onError: () => toast.error("Failed to revoke invite"),
  });
}

export function useAcceptTournamentInvite() {
  return useMutation({
    mutationFn: (token: string) => api.acceptTournamentInvite(token),
    onError: () => toast.error("Failed to accept invitation"),
  });
}

export function useGenerateInviteLink(tournamentId: string) {
  return useMutation({
    mutationFn: (tournamentRole: TournamentRole) =>
      api.generateInviteLink(tournamentId, { tournamentRole }),
    onError: () => toast.error("Failed to generate invite link"),
  });
}

export function useResendInvite(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => api.resendInvite(tournamentId, inviteId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.tournamentMembers.list(tournamentId) });
      toast.success("Invite resent");
    },
    onError: () => toast.error("Failed to resend invite"),
  });
}
