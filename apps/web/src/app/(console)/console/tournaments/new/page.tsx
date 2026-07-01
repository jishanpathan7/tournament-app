"use client";

import { Lock } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { LoadingPanel } from "@/components/common/loading";
import { Button } from "@/components/ui/button";
import { CreateTournamentWizard } from "@/features/tournaments/components/wizard/create-tournament-wizard";
import { useSession } from "@/features/auth/use-session";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";

export default function NewTournamentPage() {
  const { isLoading } = useSession();
  const can = useCan();

  if (isLoading) return <LoadingPanel label="Loading" />;

  if (!can(ACTIONS.TOURNAMENT_CREATE)) {
    return (
      <EmptyState
        icon={Lock}
        eyebrow="Not permitted"
        title="You can't create tournaments"
        description="Ask an organization owner or admin for the organizer role."
        action={
          <Button asChild tone="paper" size="sm">
            <Link href="/console/tournaments">Back to tournaments</Link>
          </Button>
        }
      />
    );
  }

  return <CreateTournamentWizard />;
}
