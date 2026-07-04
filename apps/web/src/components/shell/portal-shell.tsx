"use client";

import Link from "next/link";
import { LayoutDashboard } from "lucide-react";

import { ErrorBoundary } from "@/components/common/error-boundary";
import { Brand } from "@/components/shell/brand";
import { NotificationCenter } from "@/components/shell/notification-center";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/use-session";
import { useRealtime } from "@/hooks/use-realtime";
import { orgChannel } from "@/lib/realtime";

/** Lightweight player shell — auth + org context, no console sidebar. */
export function PortalShell({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const channel = session?.activeOrganizationId ? orgChannel(session.activeOrganizationId) : null;
  useRealtime(channel);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-ink bg-card sticky top-0 z-20 border-b-2">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Brand href="/portal" />
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <Button asChild tone="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/console">
                <LayoutDashboard className="h-4 w-4" />
                Organizer
              </Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6 md:py-10">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
