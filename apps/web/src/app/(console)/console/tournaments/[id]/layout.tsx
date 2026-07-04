import { TournamentWorkspaceShell } from "@/features/tournaments/components/tournament-workspace-shell";

export default async function TournamentWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TournamentWorkspaceShell tournamentId={id}>{children}</TournamentWorkspaceShell>;
}
