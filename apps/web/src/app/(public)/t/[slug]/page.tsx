import { SurfacePlaceholder } from "@/components/surface-placeholder";

export default async function PublicTournamentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <SurfacePlaceholder surface={`Public microsite · ${slug}`} group="(public)" />;
}
