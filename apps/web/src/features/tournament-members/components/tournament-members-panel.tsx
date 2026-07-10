"use client";

import type { TournamentMemberResponse, TournamentRole } from "@tournament/api-client";
import { Clock, MoreHorizontal, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import {
  useRemoveMember,
  useResendInvite,
  useRevokeInvite,
  useTournamentMembers,
  useUpdateMemberRole,
} from "../use-tournament-members";
import { InviteMemberDialog } from "./invite-member-dialog";

const ROLE_LABELS: Record<TournamentRole, string> = {
  tournament_admin: "Tournament Admin",
  organizer: "Organizer",
  court_manager: "Court Manager",
  checkin_staff: "Check-in Staff",
  scorekeeper: "Scorekeeper",
  viewer: "Viewer",
};

const ROLE_OPTIONS: TournamentRole[] = [
  "tournament_admin",
  "organizer",
  "court_manager",
  "checkin_staff",
  "scorekeeper",
  "viewer",
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function MemberRow({
  member,
  tournamentId,
}: {
  member: TournamentMemberResponse;
  tournamentId: string;
}) {
  const updateRole = useUpdateMemberRole(tournamentId);
  const remove = useRemoveMember(tournamentId);

  return (
    <div className="flex items-center gap-3 py-3">
      {/* Avatar — presence indicator slot: replace outer div with relative + dot when realtime added */}
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarFallback className="text-xs font-semibold">{initials(member.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{member.name}</p>
        {/* Activity attribution slot: replace second line with last_action when event log is wired */}
        <p className="text-muted-foreground truncate text-xs">{member.email}</p>
      </div>
      <Select
        value={member.tournamentRole}
        onValueChange={(v) =>
          updateRole.mutate({ userId: member.userId, tournamentRole: v as TournamentRole })
        }
        disabled={updateRole.isPending}
      >
        <SelectTrigger className="w-40 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLE_OPTIONS.map((r) => (
            <SelectItem key={r} value={r} className="text-xs">
              {ROLE_LABELS[r]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button tone="ghost" size="icon" className="h-8 w-8 shrink-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Member options</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => remove.mutate(member.userId)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function PendingInviteRow({
  invite,
  tournamentId,
}: {
  invite: { id: string; email: string; tournamentRole: TournamentRole; expiresAt: string };
  tournamentId: string;
}) {
  const revoke = useRevokeInvite(tournamentId);
  const resend = useResendInvite(tournamentId);

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
        <Clock className="text-muted-foreground h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{invite.email}</p>
        <p className="text-muted-foreground truncate text-xs">
          Pending invite · {ROLE_LABELS[invite.tournamentRole]}
        </p>
      </div>
      <Badge tone="muted" className="shrink-0 text-xs">
        Pending
      </Badge>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button tone="ghost" size="icon" className="h-8 w-8 shrink-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Invite options</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => resend.mutate(invite.id)} disabled={resend.isPending}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Resend
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => revoke.mutate(invite.id)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Revoke
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function TournamentMembersPanel({ tournamentId }: { tournamentId: string }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const { data, isPending } = useTournamentMembers(tournamentId);

  const members = data?.members ?? [];
  const pendingInvites = data?.pendingInvites ?? [];
  const total = members.length + pendingInvites.length;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Staff</h2>
          <p className="text-muted-foreground text-sm">
            People with access to manage this tournament
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add staff
        </Button>
      </div>

      <div className="rounded-lg border">
        <div className="divide-y">
          {isPending ? (
            <>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-8 w-36 rounded-md" />
                </div>
              ))}
            </>
          ) : total === 0 ? (
            <div className="text-muted-foreground px-4 py-10 text-center text-sm">
              No staff yet. Add people to help run this tournament.
            </div>
          ) : (
            <>
              {members.map((m) => (
                <div key={m.id} className="px-4">
                  <MemberRow member={m} tournamentId={tournamentId} />
                </div>
              ))}
              {pendingInvites.map((inv) => (
                <div key={inv.id} className="px-4">
                  <PendingInviteRow
                    invite={{
                      id: inv.id,
                      email: inv.email,
                      tournamentRole: inv.tournamentRole,
                      expiresAt: inv.expiresAt,
                    }}
                    tournamentId={tournamentId}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <InviteMemberDialog
        tournamentId={tournamentId}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
    </div>
  );
}
