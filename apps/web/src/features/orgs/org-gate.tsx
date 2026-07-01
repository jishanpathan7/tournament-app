"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { LoadingPanel } from "@/components/common/loading";
import { useSession } from "@/features/auth/use-session";
import { useSwitchOrg } from "@/features/orgs/use-orgs";

/**
 * Ensures the console only renders with an active org (so org-scoped queries never 403).
 * Runs after RequireAuth. Resolution when no org is active:
 *   - 0 orgs        → /onboarding
 *   - exactly 1 org → auto-enter it (switch)
 *   - 2+ orgs       → /select-organization
 * `login` already auto-selects a default, so this mainly catches fresh signups.
 */
export function OrgGate({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useSession();
  const router = useRouter();
  const switchOrg = useSwitchOrg();
  const autoSwitched = React.useRef(false);

  const activeId = session?.activeOrganizationId ?? null;

  React.useEffect(() => {
    if (isLoading || !session || activeId) return;
    const orgs = session.organizations;
    if (orgs.length === 0) {
      router.replace("/onboarding");
    } else if (orgs.length === 1) {
      if (!autoSwitched.current) {
        autoSwitched.current = true;
        switchOrg.mutate(orgs[0]!.id);
      }
    } else {
      router.replace("/select-organization");
    }
  }, [isLoading, session, activeId, router, switchOrg]);

  if (isLoading) return <LoadingPanel label="Loading your workspace" className="h-screen" />;
  if (session && !activeId) {
    return <LoadingPanel label="Setting up your workspace" className="h-screen" />;
  }
  return <>{children}</>;
}
