import { ParticipantsSubNav } from "@/features/players/components/participants-sub-nav";
import { PlayersManagement } from "@/features/players/components/players-management";

export const metadata = { title: "Players · Console" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="flex flex-col gap-6">
      <ParticipantsSubNav tournamentId={id} />
      <PlayersManagement tournamentId={id} />
    </div>
  );
}
