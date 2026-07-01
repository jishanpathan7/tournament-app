"use client";

import { Menu } from "lucide-react";

import { Breadcrumb } from "@/components/shell/breadcrumb";
import { GlobalSearch } from "@/components/shell/global-search";
import { NotificationCenter } from "@/components/shell/notification-center";
import { OrgSwitcher } from "@/components/shell/org-switcher";
import { RealtimeIndicator } from "@/components/shell/realtime-indicator";
import { UserMenu } from "@/components/shell/user-menu";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { RealtimeStatus } from "@/hooks/use-realtime";
import { useUiStore } from "@/stores/ui-store";

/**
 * Sticky topbar (design system §13): 2px ink bottom, paper/90 + blur. Left = mobile menu
 * + org switcher + breadcrumb; center = command search; right = realtime, notifications,
 * user menu.
 */
export function Topbar({ realtimeStatus }: { realtimeStatus: RealtimeStatus }) {
  const openMobileNav = useUiStore((s) => s.setMobileNavOpen);

  return (
    <header className="border-ink bg-paper/90 sticky top-0 z-30 flex h-16 items-center gap-3 border-b-2 px-4 backdrop-blur-md md:px-6">
      <Button
        tone="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open navigation"
        onClick={() => openMobileNav(true)}
      >
        <Menu className="h-5 w-5" strokeWidth={2.25} />
      </Button>

      <OrgSwitcher />
      <Separator orientation="vertical" className="hidden h-6 md:block" />
      <Breadcrumb />

      <div className="mx-auto hidden flex-1 justify-center px-4 sm:flex">
        <GlobalSearch />
      </div>

      <div className="ml-auto flex items-center gap-2 sm:ml-0">
        <RealtimeIndicator status={realtimeStatus} />
        <NotificationCenter />
        <UserMenu />
      </div>
    </header>
  );
}
