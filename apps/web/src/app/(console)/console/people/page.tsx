import { Users } from "lucide-react";

import { ComingSoon } from "@/components/common/coming-soon";

export const metadata = { title: "People · Console" };

export default function PeoplePage() {
  return (
    <ComingSoon
      eyebrow="Console"
      title="People"
      description="Organization members, roles, and invitations."
      icon={Users}
    />
  );
}
