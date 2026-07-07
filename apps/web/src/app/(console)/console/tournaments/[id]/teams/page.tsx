import { TeamsBoard } from "@/features/squads/components/teams-board";

export const metadata = { title: "Teams · Console" };

export default async function TournamentTeamsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeamsBoard tournamentId={id} />;
}
