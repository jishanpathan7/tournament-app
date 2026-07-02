import { PublicFixturesList } from "@/features/public/components/public-fixtures-list";

export default async function PublicFixturesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PublicFixturesList slug={slug} />;
}
