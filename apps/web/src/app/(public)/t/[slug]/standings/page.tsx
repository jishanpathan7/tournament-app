import { PublicStandingsViewer } from "@/features/public/components/public-standings-viewer";

export default async function PublicStandingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PublicStandingsViewer slug={slug} />;
}
