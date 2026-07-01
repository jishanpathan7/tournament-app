"use client";

import * as React from "react";

import { ErrorBoundary } from "@/components/common/error-boundary";
import { CommandPalette } from "@/components/shell/command-palette";
import { MobileSidebar } from "@/components/shell/mobile-sidebar";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { useSession } from "@/features/auth/use-session";
import { useRealtime } from "@/hooks/use-realtime";
import { orgChannel } from "@/lib/realtime";

/**
 * The console app shell (design system §4/§13): fixed sidebar + sticky topbar + a cream,
 * scrollable, centered content area. Subscribes to the active org's realtime channel so
 * every screen inside gets live cache updates for free. Content is wrapped in an error
 * boundary so a broken panel can't take down the shell.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const channel = session?.activeOrganizationId ? orgChannel(session.activeOrganizationId) : null;
  const realtimeStatus = useRealtime(channel);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar realtimeStatus={realtimeStatus} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-8">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>
      </div>
      <MobileSidebar />
      <CommandPalette />
    </div>
  );
}
