"use client";

import { MailWarning } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useResendVerification } from "@/features/auth/use-auth-actions";
import { useSession } from "@/features/auth/use-session";
import { errorMessage } from "@/lib/problem";

/**
 * Non-blocking prompt shown while the signed-in user's email is unverified. The backend
 * doesn't gate onboarding on verification, so this only nudges + offers a resend.
 */
export function VerifyEmailNotice() {
  const { session } = useSession();
  const resend = useResendVerification();
  const [sent, setSent] = useState(false);

  if (!session || session.emailVerified) return null;

  return (
    <div className="border-ink bg-yellow-tint shadow-sticker-xs mb-6 flex items-start gap-3 rounded-2xl border-2 p-4">
      <MailWarning className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
      <div className="flex flex-1 flex-col gap-2">
        <p className="text-sm">
          <span className="font-semibold">Verify your email.</span>{" "}
          <span className="text-muted-foreground">
            We sent a link to {session.email}. You can keep going in the meantime.
          </span>
        </p>
        <div>
          <Button
            tone="paper"
            size="sm"
            disabled={resend.isPending || sent}
            onClick={() =>
              resend.mutate(undefined, {
                onSuccess: () => {
                  setSent(true);
                  toast.success("Verification email sent");
                },
                onError: (e) => toast.error(errorMessage(e, "Couldn't resend")),
              })
            }
          >
            {sent ? "Sent" : "Resend email"}
          </Button>
        </div>
      </div>
    </div>
  );
}
