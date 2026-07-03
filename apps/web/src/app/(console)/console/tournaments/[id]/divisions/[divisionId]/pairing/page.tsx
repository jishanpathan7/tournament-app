import { PairingBoard } from "@/features/pairing/components/pairing-board";

export const metadata = { title: "Team Pairing · Console" };

export default async function DivisionPairingPage({
  params,
}: {
  params: Promise<{ id: string; divisionId: string }>;
}) {
  const { id, divisionId } = await params;
  return <PairingBoard tournamentId={id} divisionId={divisionId} />;
}
