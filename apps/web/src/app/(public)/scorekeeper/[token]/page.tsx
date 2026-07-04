import { PublicScorekeeperView } from "@/features/scoring/components/public-scorekeeper-view";

export default async function PublicScorekeeperPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicScorekeeperView token={token} />;
}
