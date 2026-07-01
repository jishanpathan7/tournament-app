import { Suspense } from "react";

import { LoadingPanel } from "@/components/common/loading";
import { OnboardingHeader } from "@/features/orgs/onboarding-header";

/**
 * Chrome for the pre-console flow (onboarding, org selection, invites, email verify):
 * a slim header + centered content, WITHOUT the app shell or an org requirement. Each
 * page handles its own auth gating (some are reachable while signed out).
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <OnboardingHeader />
      <main className="flex flex-1 items-start justify-center px-4 py-10 md:py-16">
        <div className="w-full max-w-xl">
          <Suspense fallback={<LoadingPanel label="Loading" />}>{children}</Suspense>
        </div>
      </main>
    </div>
  );
}
