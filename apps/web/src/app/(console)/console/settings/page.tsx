import { Settings } from "lucide-react";

import { ComingSoon } from "@/components/common/coming-soon";

export const metadata = { title: "Settings · Console" };

export default function SettingsPage() {
  return (
    <ComingSoon
      eyebrow="Console"
      title="Settings"
      description="Organization profile, branding, and feature flags."
      icon={Settings}
    />
  );
}
