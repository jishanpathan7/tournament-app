import { DrawOverview } from "@/features/draws/components/draw-overview";

export const metadata = { title: "Brackets · Console" };

export default async function StageDrawPage({
  params,
}: {
  params: Promise<{ id: string; divisionId: string; stageId: string }>;
}) {
  const { id, divisionId, stageId } = await params;
  return <DrawOverview tournamentId={id} divisionId={divisionId} stageId={stageId} />;
}
