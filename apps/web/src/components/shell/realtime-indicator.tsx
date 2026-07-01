"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { RealtimeStatus } from "@/hooks/use-realtime";
import { cn } from "@/lib/utils";

const MAP: Record<Exclude<RealtimeStatus, "idle">, { dot: string; label: string }> = {
  connecting: { dot: "bg-yellow", label: "Connecting…" },
  open: { dot: "bg-mint animate-pulse", label: "Live — realtime connected" },
  error: { dot: "bg-pink", label: "Reconnecting…" },
};

/** Ambient realtime-connection dot (design system §10 — quiet reconnect, never blocks). */
export function RealtimeIndicator({ status }: { status: RealtimeStatus }) {
  if (status === "idle") return null;
  const s = MAP[status];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="border-border flex h-9 items-center gap-1.5 rounded-full border-2 px-2.5"
          aria-label={s.label}
        >
          <span className={cn("h-2 w-2 rounded-full", s.dot)} aria-hidden />
          <span className="text-muted-foreground text-2xs hidden font-mono font-semibold uppercase tracking-[0.16em] lg:inline">
            Live
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{s.label}</TooltipContent>
    </Tooltip>
  );
}
