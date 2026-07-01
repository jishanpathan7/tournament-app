"use client";

import { Brand } from "@/components/shell/brand";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useUiStore } from "@/stores/ui-store";

/**
 * Mobile nav drawer (vaul) — the sidebar's <md form: slide-in from the left with an
 * ink/40 backdrop (design system §11). Open state lives in the UI store so the topbar
 * menu button can trigger it.
 */
export function MobileSidebar() {
  const open = useUiStore((s) => s.mobileNavOpen);
  const setOpen = useUiStore((s) => s.setMobileNavOpen);

  return (
    <Sheet open={open} onOpenChange={setOpen} direction="left">
      <SheetContent side="left">
        <div className="border-ink flex h-16 items-center border-b-2 px-4">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
