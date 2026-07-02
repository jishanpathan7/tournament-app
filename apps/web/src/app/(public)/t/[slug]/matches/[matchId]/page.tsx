import { PublicLiveMatchView } from "@/features/public/components/public-live-match-view";

export default async function PublicMatchPage({
  params,
}: {
  params: Promise<{ slug: string; matchId: string }>;
}) {
  const { slug, matchId } = await params;
  return <PublicLiveMatchView slug={slug} matchId={matchId} />;
}
