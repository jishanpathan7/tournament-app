import { RegistrationManagement } from "@/features/registrations/components/registration-management";

export const metadata = { title: "Registrations · Console" };

export default async function DivisionRegistrationsPage({
  params,
}: {
  params: Promise<{ id: string; divisionId: string }>;
}) {
  const { id, divisionId } = await params;
  return <RegistrationManagement tournamentId={id} divisionId={divisionId} />;
}
