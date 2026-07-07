"use client";

import type { OrgRole } from "@tournament/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import * as orgsApi from "@/features/orgs/orgs-api";
import { useOrgMembers } from "@/features/orgs/use-orgs";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import { errorMessage } from "@/lib/problem";

const ROLE_OPTIONS: { value: OrgRole; label: string }[] = [
  { value: "scorekeeper", label: "Scorekeeper (court scoring)" },
  { value: "organizer", label: "Organizer" },
  { value: "viewer", label: "Viewer" },
  { value: "admin", label: "Admin" },
];

/** Invite scorekeepers and manage org roles — backs the People console page. */
export function PeopleManagement() {
  const canInvite = useCan()(ACTIONS.MEMBER_INVITE);
  const members = useOrgMembers();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("scorekeeper");

  const invites = useQuery({
    queryKey: queryKeys.orgs.invites(),
    queryFn: orgsApi.listInvites,
    enabled: canInvite,
  });

  const invite = useMutation({
    mutationFn: () => orgsApi.createInvite({ email: email.trim(), role }),
    onSuccess: () => {
      toast.success("Invitation sent");
      setEmail("");
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.invites() });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Console"
        title="Staff"
        description="Organization members, roles, and invitations — invite scorekeepers for court-side scoring."
      />

      {canInvite ? (
        <section className="border-ink bg-card shadow-sticker rounded-2xl border-2 p-6">
          <h2 className="font-serif text-lg font-semibold">Invite member</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Scorekeepers can enter match results from the mobile scorekeeper view.
          </p>
          <form
            className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (!email.trim()) return;
              invite.mutate();
            }}
          >
            <Field label="Email" htmlFor="invite-email" className="flex-1">
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="umpire@example.com"
                required
              />
            </Field>
            <Field label="Role" htmlFor="invite-role" className="sm:w-56">
              <Select value={role} onValueChange={(v) => setRole(v as OrgRole)}>
                <SelectTrigger id="invite-role" aria-label="Role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button type="submit" disabled={invite.isPending}>
              <UserPlus className="h-4 w-4" />
              Send invite
            </Button>
          </form>
        </section>
      ) : null}

      <section>
        <h2 className="font-serif text-lg font-semibold">Members</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {(members.data ?? []).map((m) => (
            <li
              key={m.userId}
              className="border-ink flex items-center justify-between rounded-xl border-2 px-4 py-3"
            >
              <div>
                <p className="font-medium">{m.name}</p>
                <p className="text-muted-foreground text-sm">{m.email}</p>
              </div>
              <Badge tone="muted">{m.role}</Badge>
            </li>
          ))}
        </ul>
      </section>

      {canInvite && (invites.data?.length ?? 0) > 0 ? (
        <section>
          <h2 className="font-serif text-lg font-semibold">Pending invites</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {invites.data!.map((inv) => (
              <li
                key={inv.id}
                className="border-ink flex items-center justify-between rounded-xl border-2 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{inv.email}</p>
                  <p className="text-muted-foreground text-sm">{inv.role}</p>
                </div>
                <Badge tone="yellow">{inv.status}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
