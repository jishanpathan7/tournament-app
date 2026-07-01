import { Trophy } from "lucide-react";

import { ComingSoon } from "@/components/common/coming-soon";

export const metadata = { title: "Tournaments · Console" };

export default function TournamentsPage() {
  return (
    <ComingSoon
      eyebrow="Console"
      title="Tournaments"
      description="Create and manage tournaments, divisions, draws, and schedules."
      icon={Trophy}
    />
  );
}
