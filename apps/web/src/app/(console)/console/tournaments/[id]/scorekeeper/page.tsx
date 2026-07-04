import { MobileScorekeeper } from "@/features/scoring/components/mobile-scorekeeper";

export const metadata = { title: "Scorekeeper · Console" };

export default async function ScorekeeperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MobileScorekeeper tournamentId={id} />;
}
