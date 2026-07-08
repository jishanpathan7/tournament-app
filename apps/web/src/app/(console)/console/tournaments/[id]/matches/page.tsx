import { MatchCenter } from "@/features/matches/components/match-center";

export const metadata = { title: "Matches · Console" };

export default async function MatchCenterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MatchCenter tournamentId={id} />;
}
