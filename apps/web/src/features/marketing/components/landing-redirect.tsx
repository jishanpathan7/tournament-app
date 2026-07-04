"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { LoadingPanel } from "@/components/common/loading";
import { useSession } from "@/features/auth/use-session";
import { LandingPage } from "@/features/marketing/components/landing-page";

/** Root page — guests see marketing; signed-in users go to the console. */
export function LandingRedirect() {
  const { isLoading, isAuthenticated } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/console");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) return <LoadingPanel label="Loading" className="min-h-screen" />;
  if (isAuthenticated) return null;

  return <LandingPage />;
}
