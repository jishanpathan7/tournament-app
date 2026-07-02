import { Suspense } from "react";

import { LoadingPanel } from "@/components/common/loading";
import { RequireAuth } from "@/features/auth/require-auth";
import { OrgGate } from "@/features/orgs/org-gate";

/**
 * Chrome-free authenticated shell — same auth/org gates as the console (`RequireAuth` →
 * `OrgGate`), but deliberately WITHOUT `AppShell`: pages under this group (e.g. the
 * court dashboard) are meant to fill the entire screen on a TV/venue display, not sit
 * inside the organizer sidebar/topbar.
 */
export default function FullscreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingPanel label="Loading" className="h-screen" />}>
      <RequireAuth>
        <OrgGate>{children}</OrgGate>
      </RequireAuth>
    </Suspense>
  );
}
