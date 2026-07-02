import { PublicParticipantsList } from "@/features/public/components/public-participants-list";

export default async function PublicParticipantsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PublicParticipantsList slug={slug} />;
}
