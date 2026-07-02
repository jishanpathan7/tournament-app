import { PublicParticipantProfile } from "@/features/public/components/public-participant-profile";

export default async function PublicParticipantPage({
  params,
}: {
  params: Promise<{ slug: string; participantId: string }>;
}) {
  const { slug, participantId } = await params;
  return <PublicParticipantProfile slug={slug} participantId={participantId} />;
}
