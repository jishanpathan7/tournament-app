"use client";

import type { RegistrationResponse } from "@tournament/api-client";
import { Check, Clock, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { ACTIONABLE_STATUSES } from "@/features/registrations/config";
import {
  useApproveRegistration,
  useRejectRegistration,
  useWaitlistRegistration,
  useWithdrawRegistration,
} from "@/features/registrations/use-registrations";
import { useSession } from "@/features/auth/use-session";
import { errorMessage } from "@/lib/problem";

/**
 * Approve / waitlist / reject / withdraw for one registration. Withdraw is only ever
 * shown to the submitter — the backend rejects it from anyone else (403), so the button
 * is hidden rather than offered and failing.
 */
export function RegistrationRowActions({
  registration,
  divisionId,
  canManage,
  size = "icon-sm",
}: {
  registration: RegistrationResponse;
  divisionId: string;
  canManage: boolean;
  size?: "icon-sm" | "icon";
}) {
  const { session } = useSession();
  const approve = useApproveRegistration(divisionId);
  const waitlist = useWaitlistRegistration(divisionId);
  const reject = useRejectRegistration(divisionId);
  const withdraw = useWithdrawRegistration(divisionId);

  const pending = approve.isPending || waitlist.isPending || reject.isPending || withdraw.isPending;
  const canDecide = canManage && ACTIONABLE_STATUSES.has(registration.status);
  const canWithdraw =
    session?.id === registration.submittedBy && ACTIONABLE_STATUSES.has(registration.status);

  if (!canDecide && !canWithdraw) return null;

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {canDecide ? (
        <>
          <Button
            tone="mint"
            size={size}
            aria-label="Approve"
            disabled={pending}
            onClick={() =>
              approve.mutate(registration.id, {
                onError: (e) => toast.error(errorMessage(e, "Approve failed")),
              })
            }
          >
            {approve.isPending ? <Spinner /> : <Check className="h-4 w-4" strokeWidth={2.5} />}
          </Button>
          {registration.status !== "waitlisted" ? (
            <Button
              tone="yellow"
              size={size}
              aria-label="Waitlist"
              disabled={pending}
              onClick={() =>
                waitlist.mutate(registration.id, {
                  onError: (e) => toast.error(errorMessage(e, "Couldn't waitlist")),
                })
              }
            >
              {waitlist.isPending ? <Spinner /> : <Clock className="h-4 w-4" strokeWidth={2.5} />}
            </Button>
          ) : null}
          <Button
            tone="pink"
            size={size}
            aria-label="Reject"
            disabled={pending}
            onClick={() =>
              reject.mutate(registration.id, {
                onError: (e) => toast.error(errorMessage(e, "Reject failed")),
              })
            }
          >
            {reject.isPending ? <Spinner /> : <X className="h-4 w-4" strokeWidth={2.5} />}
          </Button>
        </>
      ) : null}
      {canWithdraw ? (
        <Button
          tone="paper"
          size="sm"
          disabled={pending}
          onClick={() =>
            withdraw.mutate(registration.id, {
              onError: (e) => toast.error(errorMessage(e, "Withdraw failed")),
            })
          }
        >
          {withdraw.isPending ? <Spinner /> : null}
          Withdraw
        </Button>
      ) : null}
    </div>
  );
}
