"use client";

import { useQueryClient } from "@tanstack/react-query";
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

import { useAcceptTournamentInvite } from "../use-tournament-members";

export function TournamentInviteAcceptance() {
  const params = useSearchParams();
  const token = params.get("token");
  const { session, isLoading } = useSession();
  const router = useRouter();
  const accept = useAcceptTournamentInvite();
  const queryClient = useQueryClient();
  const ran = React.useRef(false);

  React.useEffect(() => {
    if (!token || isLoading) return;
    if (!session) {
      router.replace(`/login?next=${encodeURIComponent(`/join?token=${token}`)}`);
      return;
    }
    if (!ran.current) {
      ran.current = true;
      accept.mutate(token, {
        onSuccess: (data) => {
          // Backend re-minted the access cookie with the invited org as active.
          // Clear stale session/tenant caches so the new cookie is picked up.
          queryClient.clear();
          router.replace(`/console/tournaments/${data.tournamentId}`);
        },
      });
    }
  }, [token, isLoading, session, router, accept, queryClient]);

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

  return <LoadingPanel label="Joining tournament" className="py-24" />;
}
