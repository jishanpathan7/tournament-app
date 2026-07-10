import { TournamentMembersPanel } from "@/features/tournament-members/components/tournament-members-panel";

export default async function TournamentMembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TournamentMembersPanel tournamentId={id} />;
}
