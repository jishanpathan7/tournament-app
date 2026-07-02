import { PublicLiveMatches } from "@/features/public/components/public-live-matches";

export default async function PublicLivePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PublicLiveMatches slug={slug} />;
}
