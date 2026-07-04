import { PublicCheckInView } from "@/features/registration-ops/components/public-checkin-view";

export default async function PublicCheckInPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicCheckInView token={token} />;
}
