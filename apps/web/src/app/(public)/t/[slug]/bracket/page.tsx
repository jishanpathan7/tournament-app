import { PublicBracketViewer } from "@/features/public/components/public-bracket-viewer";

export default async function PublicBracketPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PublicBracketViewer slug={slug} />;
}
