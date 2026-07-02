import { CourtManagement } from "@/features/courts/components/court-management";

export const metadata = { title: "Courts · Console" };

export default async function CourtsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CourtManagement tournamentId={id} />;
}
