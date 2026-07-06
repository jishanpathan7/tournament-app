import { DrawsIndex } from "@/features/draws/components/draws-index";

export const metadata = { title: "Draws · Console" };

export default async function TournamentDrawsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DrawsIndex tournamentId={id} />;
}
