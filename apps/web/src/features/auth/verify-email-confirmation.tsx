"use client";

import { MailCheck, MailX } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";

import { EmptyState } from "@/components/common/empty-state";
import { LoadingPanel } from "@/components/common/loading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirmEmail } from "@/features/auth/use-auth-actions";
import { useSession } from "@/features/auth/use-session";

/** Confirms an email-verification token from `/verify-email?token=…`. Public. */
export function VerifyEmailConfirmation() {
  const params = useSearchParams();
  const token = params.get("token");
  const { isAuthenticated } = useSession();
  const confirm = useConfirmEmail();
  const ran = React.useRef(false);

  React.useEffect(() => {
    if (token && !ran.current) {
      ran.current = true;
      confirm.mutate(token);
    }
  }, [token, confirm]);

  const cta = isAuthenticated ? (
    <Button asChild tone="candy">
      <Link href="/console">Go to dashboard</Link>
    </Button>
  ) : (
    <Button asChild tone="candy">
      <Link href="/login">Sign in</Link>
    </Button>
  );

  if (!token || confirm.isError) {
    return (
      <Card>
        <EmptyState
          icon={MailX}
          eyebrow="Verification"
          title="This link is invalid or expired"
          description="Request a fresh verification email from your account, then try again."
          action={cta}
        />
      </Card>
    );
  }

  if (confirm.isSuccess) {
    return (
      <Card>
        <EmptyState
          icon={MailCheck}
          eyebrow="Verification"
          title="Email verified"
          description="Your email address is confirmed. You're all set."
          action={cta}
        />
      </Card>
    );
  }

  return <LoadingPanel label="Verifying your email" className="py-24" />;
}
