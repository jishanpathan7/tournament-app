import { TournamentDashboard } from "@/features/tournaments/dashboard/tournament-dashboard";

export const metadata = { title: "Dashboard · Console" };

export default async function TournamentDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TournamentDashboard tournamentId={id} />;
}
