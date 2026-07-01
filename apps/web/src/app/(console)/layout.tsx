import { Suspense } from "react";

import { LoadingPanel } from "@/components/common/loading";
import { AppShell } from "@/components/shell/app-shell";
import { RequireAuth } from "@/features/auth/require-auth";
import { OrgGate } from "@/features/orgs/org-gate";

/**
 * Organizer console: authenticated (RequireAuth) → has an active org (OrgGate) → shell.
 * Suspense wraps the gates because they read search params.
 */
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingPanel label="Loading" className="h-screen" />}>
      <RequireAuth>
        <OrgGate>
          <AppShell>{children}</AppShell>
        </OrgGate>
      </RequireAuth>
    </Suspense>
  );
}
