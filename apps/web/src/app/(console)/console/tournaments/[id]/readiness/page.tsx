import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { ReadinessDashboard } from "@/features/registration-ops/components/readiness-dashboard";

export const metadata = { title: "Readiness · Console" };

export default async function ReadinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="flex flex-col gap-6">
      <Button asChild tone="ghost" size="sm" className="text-muted-foreground -ml-2 self-start">
        <Link href={`/console/tournaments/${id}`}>
          <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
          Back to tournament
        </Link>
      </Button>
      <PageHeader
        eyebrow="Event day"
        title="Readiness Dashboard"
        description="Check which divisions are ready to draw or start. Auto-refreshes every 30 s."
      />
      <ReadinessDashboard tournamentId={id} />
    </div>
  );
}
