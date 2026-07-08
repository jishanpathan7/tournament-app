"use client";

import Link from "next/link";
import { LayoutGrid, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Sticky mobile actions for event-day ops. */
export function MobileLiveStickyBar({ tournamentId }: { tournamentId: string }) {
  const base = `/console/tournaments/${tournamentId}`;

  return (
    <div className="border-ink bg-card fixed inset-x-0 bottom-16 z-20 flex gap-2 border-t-2 p-3 md:hidden">
      <Button asChild tone="paper" className="flex-1" size="sm">
        <Link href={`${base}/live`}>
          <LayoutGrid className="h-4 w-4" />
          Courts
        </Link>
      </Button>
      <Button asChild tone="paper" className="flex-1" size="sm">
        <Link href={`${base}/scorekeeper`}>
          <Smartphone className="h-4 w-4" />
          Scorekeeper
        </Link>
      </Button>
    </div>
  );
}
