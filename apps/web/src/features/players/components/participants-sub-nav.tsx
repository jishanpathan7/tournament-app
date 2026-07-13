"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useDivisions } from "@/features/tournaments/use-tournaments";

const TABS = [
  { label: "Players", suffix: "/players" },
  { label: "Registrations", suffix: "/registrations" },
  { label: "Attendance", suffix: "/attendance" },
] as const;

export function ParticipantsSubNav({ tournamentId }: { tournamentId: string }) {
  const pathname = usePathname();
  const divisions = useDivisions(tournamentId);
  const firstDivisionId = divisions.data?.[0]?.id;

  const base = `/console/tournaments/${tournamentId}`;

  const hrefFor = (suffix: string) => {
    if (suffix === "/players") return `${base}/players`;
    if (!firstDivisionId) return "#";
    return `${base}/divisions/${firstDivisionId}${suffix}`;
  };

  const isActive = (suffix: string) => {
    if (suffix === "/players") return pathname.endsWith("/players");
    return pathname.includes(suffix);
  };

  return (
    <div className="border-border flex gap-1 border-b pb-0">
      {TABS.map(({ label, suffix }) => {
        const active = isActive(suffix);
        const href = hrefFor(suffix);
        const disabled = suffix !== "/players" && !firstDivisionId;

        return (
          <Link
            key={suffix}
            href={href}
            aria-disabled={disabled}
            className={cn(
              "px-3 py-2 text-sm font-semibold transition-colors",
              active
                ? "border-ink text-foreground border-b-2"
                : "text-muted-foreground hover:text-foreground",
              disabled && "pointer-events-none opacity-40",
            )}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
