"use client";

import type { PublicTournamentView } from "@tournament/api-client";
import { Share2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { LIVE_TAB, PUBLIC_TABS } from "@/features/public/config";
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
  const tabs = tournament.status === "live" ? [...PUBLIC_TABS, LIVE_TAB] : PUBLIC_TABS;

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

  return (
    <nav className="border-ink bg-card/90 sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b-2 px-4 py-3 backdrop-blur-sm sm:px-6">
      <Link href={base} className="shrink-0 font-serif text-lg font-bold tracking-tight">
        {tournament.organization.name}
      </Link>
      <div className="flex flex-1 gap-1 overflow-x-auto">
        {tabs.map((tab) => {
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
        })}
      </div>
      <Button tone="paper" size="sm" onClick={share} className="shrink-0">
        <Share2 className="h-4 w-4" strokeWidth={2.25} />
        Share
      </Button>
    </nav>
  );
}
