import { InviteAcceptance } from "@/features/orgs/invite-acceptance";
import { siteTitle } from "@/lib/site";

export const metadata = { title: siteTitle("Accept invitation") };

export default function InvitePage() {
  return <InviteAcceptance />;
}
