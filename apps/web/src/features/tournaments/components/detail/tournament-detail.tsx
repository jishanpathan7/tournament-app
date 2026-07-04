import { TournamentDashboard } from "@/features/tournaments/dashboard/tournament-dashboard";

/** Thin alias — tournament workspace layout owns chrome; this is the dashboard body. */
export function TournamentDetail({ id }: { id: string }) {
  return <TournamentDashboard tournamentId={id} />;
}
