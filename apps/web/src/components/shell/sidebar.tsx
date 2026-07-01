"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Brand } from "@/components/shell/brand";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

/**
 * Desktop sidebar — white, 2px ink right border, 240px → 68px collapse (persisted).
 * Hidden below md, where the mobile drawer takes over (design system §4/§13).
 */
export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "border-ink bg-card ease-candy hidden shrink-0 flex-col border-r-2 transition-[width] duration-200 md:flex",
        collapsed ? "w-[68px]" : "w-60",
      )}
    >
      <div
        className={cn(
          "border-ink flex h-16 items-center border-b-2 px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <Brand compact={collapsed} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <SidebarNav collapsed={collapsed} />
      </div>

      <div className="border-border border-t p-3">
        <Button
          tone="ghost"
          size={collapsed ? "icon" : "sm"}
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn("text-muted-foreground w-full", !collapsed && "justify-start")}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={2.25} />
          ) : (
            <>
              <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={2.25} />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
