"use client";

import { usePathname } from "next/navigation";

const SEGMENT_LABELS: Record<string, string> = {
  console: "Dashboard",
  tournaments: "Tournaments",
  people: "People",
  settings: "Settings",
  profile: "Profile",
};

function label(segment: string): string {
  return SEGMENT_LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

/**
 * Lightweight breadcrumb derived from the console path (design system §13: Org / Section).
 * Screens with richer context (a tournament name) can render their own; this is the
 * always-present default.
 */
export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean); // e.g. ["console","tournaments"]
  const crumb = segments.length <= 1 ? "Dashboard" : label(segments[segments.length - 1]!);

  return (
    <span className="text-muted-foreground text-2xs hidden font-mono font-semibold uppercase tracking-[0.22em] md:inline">
      {crumb}
    </span>
  );
}
