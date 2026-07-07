import { LayoutDashboard, type LucideIcon, Settings, Trophy } from "lucide-react";

import { ACTIONS, type Action } from "@/lib/permissions";

/**
 * Console org-nav model (design system §13). Each item declares the permission it needs;
 * the sidebar hides items the role can't use. The tournament-workspace stepper-nav is a
 * separate, tournament-scoped concern layered in when inside a tournament (future).
 */
export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Permission required to see the item; omit for always-visible. */
  requiredAction?: Action;
  /** Match child routes too (e.g. /console/tournaments/123). */
  matchPrefix?: boolean;
}

export const ORG_NAV: NavItem[] = [
  { label: "Dashboard", href: "/console", icon: LayoutDashboard },
  {
    label: "Tournaments",
    href: "/console/tournaments",
    icon: Trophy,
    matchPrefix: true,
  },
  {
    label: "Settings",
    href: "/console/settings",
    icon: Settings,
    requiredAction: ACTIONS.ORG_READ,
    matchPrefix: true,
  },
];

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.matchPrefix) return pathname === item.href || pathname.startsWith(`${item.href}/`);
  return pathname === item.href;
}
