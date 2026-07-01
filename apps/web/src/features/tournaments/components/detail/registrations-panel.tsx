"use client";

import type { ParticipantResponse, RegistrationResponse } from "@tournament/api-client";
import { Check, UserPlus, Users, X } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useApproveRegistration,
  useParticipants,
  useRegistrations,
  useRejectRegistration,
} from "@/features/registrations/use-registrations";
import { PARTICIPANT_KINDS } from "@/features/tournaments/config";
import { toast } from "@/components/ui/sonner";
import { errorMessage } from "@/lib/problem";

const REG_TONE: Record<string, BadgeProps["tone"]> = {
  submitted: "candy",
  approved: "mint",
  waitlisted: "yellow",
  rejected: "pink",
  withdrawn: "muted",
  checked_in: "mint",
};

function RowSkeletons() {
  return (
    <div className="flex flex-col gap-2 py-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-12 border-0" />
      ))}
    </div>
  );
}

function RegistrationRow({
  registration,
  divisionId,
  canManage,
}: {
  registration: RegistrationResponse;
  divisionId: string;
  canManage: boolean;
}) {
  const approve = useApproveRegistration(divisionId);
  const reject = useRejectRegistration(divisionId);
  const pending = approve.isPending || reject.isPending;
  const actionable = canManage && registration.status === "submitted";

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">{registration.skillLevel ?? "Entrant"}</span>
        <span className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.16em]">
          {new Date(registration.createdAt).toLocaleDateString()}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={REG_TONE[registration.status] ?? "muted"}>{registration.status}</Badge>
        {actionable ? (
          <>
            <Button
              tone="mint"
              size="icon-sm"
              aria-label="Approve"
              disabled={pending}
              onClick={() =>
                approve.mutate(registration.id, {
                  onError: (e) => toast.error(errorMessage(e, "Approve failed")),
                })
              }
            >
              <Check className="h-4 w-4" strokeWidth={2.5} />
            </Button>
            <Button
              tone="pink"
              size="icon-sm"
              aria-label="Reject"
              disabled={pending}
              onClick={() =>
                reject.mutate(registration.id, {
                  onError: (e) => toast.error(errorMessage(e, "Reject failed")),
                })
              }
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ParticipantRow({ participant }: { participant: ParticipantResponse }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">{participant.displayName}</span>
        <span className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.16em]">
          {PARTICIPANT_KINDS[participant.kind as keyof typeof PARTICIPANT_KINDS] ??
            participant.kind}
          {participant.seed ? ` · Seed ${participant.seed}` : ""}
        </span>
      </div>
      <Badge tone="mint">{participant.status}</Badge>
    </div>
  );
}

/** Registrations + participants for one division, with approve/reject (permission-gated). */
export function RegistrationsPanel({
  divisionId,
  canManage,
}: {
  divisionId: string;
  canManage: boolean;
}) {
  const registrations = useRegistrations(divisionId, { enabled: canManage });
  const participants = useParticipants(divisionId);

  return (
    <Tabs defaultValue={canManage ? "registrations" : "participants"}>
      <TabsList>
        {canManage ? <TabsTrigger value="registrations">Registrations</TabsTrigger> : null}
        <TabsTrigger value="participants">Participants</TabsTrigger>
      </TabsList>

      {canManage ? (
        <TabsContent value="registrations" className="pt-2">
          {registrations.isLoading ? (
            <RowSkeletons />
          ) : registrations.isError ? (
            <ErrorState error={registrations.error} onRetry={() => registrations.refetch()} />
          ) : (registrations.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={UserPlus}
              title="No registrations yet"
              description="Entries show up here once players sign up."
              className="py-10"
            />
          ) : (
            <div className="divide-border divide-y">
              {registrations.data!.map((r) => (
                <RegistrationRow
                  key={r.id}
                  registration={r}
                  divisionId={divisionId}
                  canManage={canManage}
                />
              ))}
            </div>
          )}
        </TabsContent>
      ) : null}

      <TabsContent value="participants" className="pt-2">
        {participants.isLoading ? (
          <RowSkeletons />
        ) : participants.isError ? (
          <ErrorState error={participants.error} onRetry={() => participants.refetch()} />
        ) : (participants.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Users}
            title="No participants yet"
            description="Approved entrants appear here."
            className="py-10"
          />
        ) : (
          <div className="divide-border divide-y">
            {participants.data!.map((p) => (
              <ParticipantRow key={p.id} participant={p} />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
