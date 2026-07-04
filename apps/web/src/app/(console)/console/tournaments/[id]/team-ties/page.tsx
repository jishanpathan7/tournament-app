import { FranchiseTiesPage } from "@/features/franchise-ties/components/franchise-ties-board";

export default async function TeamTiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FranchiseTiesPage tournamentId={id} />;
}
