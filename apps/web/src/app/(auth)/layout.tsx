import { Suspense } from "react";

import { RedirectIfAuthenticated } from "@/features/auth/require-auth";
import { AuthHeroPanel } from "@/features/marketing/components/auth-hero-panel";

/** Split-screen auth shell — dark hero left, form right. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <RedirectIfAuthenticated>
        <div className="flex min-h-screen flex-col md:flex-row">
          <AuthHeroPanel />
          {children}
        </div>
      </RedirectIfAuthenticated>
    </Suspense>
  );
}
