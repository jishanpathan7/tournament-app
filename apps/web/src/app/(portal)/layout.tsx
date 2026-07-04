import { Suspense } from "react";

import { LoadingPanel } from "@/components/common/loading";
import { PortalShell } from "@/components/shell/portal-shell";
import { RequireAuth } from "@/features/auth/require-auth";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingPanel label="Loading" className="h-screen" />}>
      <RequireAuth>
        <PortalShell>{children}</PortalShell>
      </RequireAuth>
    </Suspense>
  );
}
