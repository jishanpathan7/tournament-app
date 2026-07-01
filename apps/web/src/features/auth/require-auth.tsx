"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { LoadingPanel } from "@/components/common/loading";
import { useSession } from "@/features/auth/use-session";

/**
 * Client auth gate. While the session resolves, shows a calm loader; if unauthenticated,
 * redirects to /login preserving the intended path **including query string** (so invite
 * tokens survive the round-trip). The API is still the real gate — this avoids flashing
 * protected chrome. Does NOT require an active org (onboarding pages use it too).
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const query = searchParams.toString();
      const next = query ? `${pathname}?${query}` : pathname;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [isLoading, isAuthenticated, pathname, searchParams, router]);

  if (isLoading) return <LoadingPanel label="Loading your workspace" className="h-screen" />;
  if (!isAuthenticated) return null; // redirecting

  return <>{children}</>;
}

/** Inverse gate for auth pages — send already-signed-in users on (honoring `next`). */
export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(searchParams.get("next") || "/console");
    }
  }, [isLoading, isAuthenticated, searchParams, router]);

  if (isAuthenticated) return null;
  return <>{children}</>;
}
