import { siteTitle } from "@/lib/site";

import { TournamentInviteAcceptance } from "@/features/tournament-members/components/tournament-invite-acceptance";

export const metadata = { title: siteTitle("Join tournament") };

export default function JoinPage() {
  return <TournamentInviteAcceptance />;
}
