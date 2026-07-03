import { ImportWizard } from "@/features/registration-ops/components/import-wizard";

export const metadata = { title: "Import Registrations · Console" };

export default async function ImportPage({
  params,
}: {
  params: Promise<{ id: string; divisionId: string }>;
}) {
  const { id, divisionId } = await params;
  return <ImportWizard tournamentId={id} divisionId={divisionId} />;
}
