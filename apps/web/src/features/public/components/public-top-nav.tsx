"use client";

import type { PublicTournamentView } from "@tournament/api-client";
import { Share2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { COURTS_TAB, LIVE_TAB, PUBLIC_TABS, STATS_TAB } from "@/features/public/config";
import { cn } from "@/lib/utils";

function LiveDot() {
  return (
    <span
      className="bg-pink inline-block h-2 w-2 shrink-0 animate-pulse rounded-full"
      aria-hidden
    />
  );
}

/** Sticky top nav shared by every page under `/t/[slug]` — org wordmark, tab strip
 * (Live only once the tournament itself is live), and a share button. Mobile: tabs
 * become a horizontally-scrollable pill row (design system §13). */
export function PublicTopNav({
  slug,
  tournament,
}: {
  slug: string;
  tournament: PublicTournamentView;
}) {
  const pathname = usePathname();
  const base = `/t/${slug}`;
  const tabs =
    tournament.status === "live"
      ? [...PUBLIC_TABS, STATS_TAB, LIVE_TAB, COURTS_TAB]
      : [...PUBLIC_TABS, STATS_TAB];

  const tabHref = (key: string) => (key === "overview" ? base : `${base}/${key}`);

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({ title: tournament.name, url });
        return;
      } catch {
        // user cancelled the native share sheet — fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  const tabLinks = tabs.map((tab) => {
    const href = tabHref(tab.key);
    const active = pathname === href;
    return (
      <Link
        key={tab.key}
        href={href}
        className={cn(
          "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
          active ? "bg-ink text-white" : "text-muted-foreground hover:bg-muted",
        )}
      >
        {tab.label}
        {tab.key === "live" ? <LiveDot /> : null}
      </Link>
    );
  });

  return (
    <nav className="border-ink bg-card/90 sticky top-0 z-10 border-b-2 backdrop-blur-sm">
      {/* Mobile: two-row layout — org name + share on top, tabs below */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-2.5">
          <Link
            href={base}
            className="min-w-0 truncate font-serif text-base font-bold tracking-tight"
          >
            {tournament.organization.name}
          </Link>
          <Button tone="paper" size="sm" onClick={share} className="shrink-0">
            <Share2 className="h-4 w-4" strokeWidth={2.25} />
            Share
          </Button>
        </div>
        <div className="flex gap-1 overflow-x-auto px-3 pb-2.5">{tabLinks}</div>
      </div>
      {/* Desktop: single-row layout */}
      <div className="hidden items-center gap-4 px-6 py-3 sm:flex">
        <Link href={base} className="shrink-0 font-serif text-lg font-bold tracking-tight">
          {tournament.organization.name}
        </Link>
        <div className="flex flex-1 gap-1 overflow-x-auto">{tabLinks}</div>
        <Button tone="paper" size="sm" onClick={share} className="shrink-0">
          <Share2 className="h-4 w-4" strokeWidth={2.25} />
          Share
        </Button>
      </div>
    </nav>
  );
}
