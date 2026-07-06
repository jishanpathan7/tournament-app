import { DraftCeremonyShell } from "@/features/squads/components/draft-ceremony";

export default async function DraftCeremonyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DraftCeremonyShell tournamentId={id} />;
}
