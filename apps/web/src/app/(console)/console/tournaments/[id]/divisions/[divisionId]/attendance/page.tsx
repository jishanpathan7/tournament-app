import { CheckInConsole } from "@/features/registration-ops/components/checkin-console";

export const metadata = { title: "Check-in · Console" };

export default async function AttendancePage({
  params,
}: {
  params: Promise<{ id: string; divisionId: string }>;
}) {
  const { id, divisionId } = await params;
  return <CheckInConsole tournamentId={id} divisionId={divisionId} />;
}
