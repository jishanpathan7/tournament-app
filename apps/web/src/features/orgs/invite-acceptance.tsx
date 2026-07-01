"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingPanel } from "@/components/common/loading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/features/auth/use-session";
import { useAcceptInvite } from "@/features/orgs/use-orgs";

/**
 * Accept an org invitation from `/invite?token=…`. If signed out, bounce to /login with
 * the invite preserved in `next` (so it resumes after auth — for new users too). Once
 * signed in, auto-accept and enter the joined org's dashboard.
 */
export function InviteAcceptance() {
  const params = useSearchParams();
  const token = params.get("token");
  const { session, isLoading } = useSession();
  const router = useRouter();
  const accept = useAcceptInvite();
  const ran = React.useRef(false);

  React.useEffect(() => {
    if (!token || isLoading) return;
    if (!session) {
      router.replace(`/login?next=${encodeURIComponent(`/invite?token=${token}`)}`);
      return;
    }
    if (!ran.current) {
      ran.current = true;
      accept.mutate(token, { onSuccess: () => router.replace("/console") });
    }
  }, [token, isLoading, session, router, accept]);

  if (!token) {
    return (
      <Card>
        <EmptyState
          icon={MailCheck}
          eyebrow="Invitation"
          title="This invite link is invalid"
          description="It's missing its token. Ask your organizer to resend the invitation."
          action={
            <Button asChild tone="paper" size="sm">
              <Link href="/console">Go to dashboard</Link>
            </Button>
          }
        />
      </Card>
    );
  }

  if (accept.isError) {
    return (
      <Card>
        <ErrorState error={accept.error} title="Couldn't accept invitation" onRetry={undefined} />
        <div className="flex justify-center pb-6">
          <Button asChild tone="paper" size="sm">
            <Link href="/console">Go to dashboard</Link>
          </Button>
        </div>
      </Card>
    );
  }

  return <LoadingPanel label="Joining organization" className="py-24" />;
}
