"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ORG_NAV, isActive } from "@/components/shell/nav-config";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCan } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";

/**
 * Org navigation list. Active item = candy tint + candy text + candy left bar
 * (design system §13). When `collapsed`, labels move into tooltips. Items the role
 * can't access are omitted.
 */
export function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const can = useCan();

  const items = ORG_NAV.filter((item) => !item.requiredAction || can(item.requiredAction));

  return (
    <nav className="flex flex-col gap-1 p-3" aria-label="Primary">
      {items.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        const link = (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
              collapsed && "justify-center px-0",
              active ? "bg-candy-tint text-candy-dark" : "text-foreground hover:bg-muted",
            )}
          >
            {active ? (
              <span
                className="bg-candy absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full"
                aria-hidden
              />
            ) : null}
            <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.25} aria-hidden />
            <span className={cn(collapsed && "sr-only")}>{item.label}</span>
          </Link>
        );

        return collapsed ? (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        ) : (
          link
        );
      })}
    </nav>
  );
}
