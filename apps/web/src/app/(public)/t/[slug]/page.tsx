import { PublicOverview } from "@/features/public/components/public-overview";

export default async function PublicTournamentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PublicOverview slug={slug} />;
}
