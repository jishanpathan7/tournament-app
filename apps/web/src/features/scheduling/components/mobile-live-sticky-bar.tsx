"use client";

import Link from "next/link";
import { ChevronRight, LayoutGrid, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export interface CallNextAction {
  courtName: string;
  matchLabel: string;
  isPending: boolean;
  onCall: () => void;
}

/** Sticky mobile actions for event-day ops. Optionally surfaces a "Call next pair" action. */
export function MobileLiveStickyBar({
  tournamentId,
  callNext,
}: {
  tournamentId: string;
  callNext?: CallNextAction;
}) {
  const base = `/console/tournaments/${tournamentId}`;

  return (
    <div className="border-ink bg-card fixed inset-x-0 bottom-16 z-20 flex flex-col gap-2 border-t-2 p-3 md:hidden">
      {callNext && (
        <Button
          tone="candy"
          className="w-full justify-between"
          disabled={callNext.isPending}
          onClick={callNext.onCall}
        >
          <span className="flex items-center gap-2">
            {callNext.isPending ? (
              <Spinner className="h-4 w-4 text-white" />
            ) : (
              <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
            )}
            Call next pair
          </span>
          <span className="max-w-[140px] truncate text-sm font-normal opacity-90">
            → {callNext.courtName}
          </span>
        </Button>
      )}
      <div className="flex gap-2">
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
    </div>
  );
}
