import { PublicPlayerStats } from "@/features/public/components/public-player-stats";

export default async function PublicStatsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PublicPlayerStats slug={slug} />;
}
