import { PlayersManagement } from "@/features/players/components/players-management";

export const metadata = { title: "Players · Console" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlayersManagement tournamentId={id} />;
}
