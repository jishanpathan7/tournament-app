import { SchedulePage } from "@/features/scheduling/components/schedule-page";

export const metadata = { title: "Schedule · Console" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SchedulePage tournamentId={id} />;
}
