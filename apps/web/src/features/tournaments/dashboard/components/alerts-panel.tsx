"use client";

import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";

import type { DashboardAlert } from "@/features/tournaments/dashboard/config";
import { cn } from "@/lib/utils";

const TONE_STYLE: Record<DashboardAlert["tone"], string> = {
  warning: "border-yellow-500/40 bg-yellow-tint text-yellow-900",
  error: "border-pink/40 bg-pink-tint",
  info: "border-candy/30 bg-candy-tint/50",
};

export function AlertsPanel({ alerts }: { alerts: DashboardAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <section className="flex flex-col gap-2" aria-label="Alerts">
      <h2 className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.22em]">
        Alerts
      </h2>
      <ul className="flex flex-col gap-2">
        {alerts.slice(0, 6).map((alert) => {
          const content = (
            <>
              {alert.tone === "info" ? (
                <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} />
              )}
              <span>{alert.message}</span>
            </>
          );
          const className = cn(
            "flex items-start gap-2 rounded-xl border-2 px-3 py-2.5 text-sm",
            TONE_STYLE[alert.tone],
          );
          return (
            <li key={alert.id}>
              {alert.href ? (
                <Link href={alert.href} className={cn(className, "hover:opacity-90")}>
                  {content}
                </Link>
              ) : (
                <div className={className}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
