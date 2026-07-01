import { TournamentDetail } from "@/features/tournaments/components/detail/tournament-detail";

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TournamentDetail id={id} />;
}
