"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  TOURNAMENT_NAV,
  isTournamentNavActive,
  tournamentNavHref,
} from "@/features/tournaments/components/tournament-nav-config";
import { cn } from "@/lib/utils";

/** Fixed bottom navigation for tournament workspace on small screens. */
export function MobileTournamentNav({
  tournamentId,
  pendingCount,
}: {
  tournamentId: string;
  pendingCount?: number;
}) {
  const pathname = usePathname();

  return (
    <nav
      className="border-ink bg-card fixed inset-x-0 bottom-0 z-30 border-t-2 md:hidden"
      aria-label="Tournament navigation"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
        {TOURNAMENT_NAV.map((item) => {
          const active = isTournamentNavActive(pathname, tournamentId, item);
          const Icon = item.icon;
          const showBadge = item.key === "participants" && (pendingCount ?? 0) > 0;

          return (
            <li key={item.key} className="flex-1">
              <Link
                href={tournamentNavHref(tournamentId, item)}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] font-semibold transition-colors",
                  active ? "text-candy-dark" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                <span className="truncate">{item.label}</span>
                {showBadge ? (
                  <span className="bg-candy absolute right-2 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[9px] font-bold text-white">
                    {(pendingCount ?? 0) > 99 ? "99+" : pendingCount}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
