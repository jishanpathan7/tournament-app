import { PublicCourtsView } from "@/features/public/components/public-courts-view";

export default async function PublicCourtsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicCourtsView slug={slug} />;
}
