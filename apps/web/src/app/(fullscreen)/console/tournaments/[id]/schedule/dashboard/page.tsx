import { CourtDashboard } from "@/features/scheduling/components/court-dashboard";

export const metadata = { title: "Court Dashboard" };

export default async function CourtDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CourtDashboard tournamentId={id} />;
}
