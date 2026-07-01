"use client";

import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { LoadingPanel } from "@/components/common/loading";
import { useSession } from "@/features/auth/use-session";

/**
 * Client auth gate for the console. While the session resolves, shows a calm loader; if
 * unauthenticated, redirects to /login preserving the intended path. The API is still the
 * real gate (RLS + authz) — this just avoids flashing protected chrome.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  if (isLoading) return <LoadingPanel label="Loading your workspace" className="h-screen" />;
  if (!isAuthenticated) return null; // redirecting

  return <>{children}</>;
}

/** Inverse gate for auth pages — send already-signed-in users to the console. */
export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useSession();
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/console");
  }, [isLoading, isAuthenticated, router]);

  if (isAuthenticated) return null;
  return <>{children}</>;
}
