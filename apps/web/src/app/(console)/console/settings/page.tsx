import { Settings } from "lucide-react";

import { OrgSettingsPanel } from "@/features/settings/components/org-settings-panel";

export const metadata = { title: "Settings · Console" };

export default function SettingsPage() {
  return (
    <div className="space-y-8 p-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#1E293B] bg-[#EDE9FE] shadow-[3px_3px_0_#1E293B]">
          <Settings className="h-5 w-5 text-[#8B5CF6]" />
        </div>
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#8B5CF6]">
            Console
          </p>
          <h1 className="font-serif text-2xl font-bold leading-tight tracking-tight text-[#1E293B]">
            Settings
          </h1>
        </div>
      </div>

      {/* ── Content ── */}
      <OrgSettingsPanel />
    </div>
  );
}
