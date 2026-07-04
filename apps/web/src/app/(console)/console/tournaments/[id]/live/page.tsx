import { LiveDashboard } from "@/features/scheduling/components/live-dashboard";

export const metadata = { title: "Live Dashboard · Console" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveDashboard tournamentId={id} />;
}
