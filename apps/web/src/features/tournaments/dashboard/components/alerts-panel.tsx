"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronDown, Info } from "lucide-react";
import { useState } from "react";

import type { DashboardAlert } from "@/features/tournaments/dashboard/config";
import { cn } from "@/lib/utils";

const TONE_STYLE: Record<DashboardAlert["tone"], string> = {
  warning: "border-yellow-500/40 bg-yellow-tint text-yellow-900",
  error: "border-pink/40 bg-pink-tint",
  info: "border-candy/30 bg-candy-tint/50",
  success: "border-mint/40 bg-mint-tint text-mint-dark",
};

function AlertIcon({ tone }: { tone: DashboardAlert["tone"] }) {
  if (tone === "success")
    return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} />;
  if (tone === "info") return <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} />;
  return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} />;
}

function AlertRow({ alert, className }: { alert: DashboardAlert; className?: string }) {
  const content = (
    <>
      <AlertIcon tone={alert.tone} />
      <span>{alert.message}</span>
    </>
  );
  const base = cn(
    "flex items-start gap-2 rounded-xl border-2 px-3 py-2.5 text-sm",
    TONE_STYLE[alert.tone],
    className,
  );
  return (
    <li key={alert.id}>
      {alert.href ? (
        <Link href={alert.href} className={cn(base, "hover:opacity-90")}>
          {content}
        </Link>
      ) : (
        <div className={base}>{content}</div>
      )}
    </li>
  );
}

export function AlertsPanel({ alerts }: { alerts: DashboardAlert[] }) {
  const [secondaryOpen, setSecondaryOpen] = useState(false);

  if (alerts.length === 0) return null;

  // Priority order: error > warning > success > info
  const TONE_PRIORITY: Record<DashboardAlert["tone"], number> = {
    error: 0,
    warning: 1,
    success: 2,
    info: 3,
  };
  const sorted = [...alerts].sort((a, b) => TONE_PRIORITY[a.tone] - TONE_PRIORITY[b.tone]);

  const [primary, ...secondary] = sorted;
  if (!primary) return null;

  return (
    <section className="flex flex-col gap-2" aria-label="Alerts">
      <h2 className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.22em]">
        Alerts
      </h2>
      <ul className="flex flex-col gap-2">
        {/* Primary alert — always visible with "Fix now →" affordance */}
        <AlertRow
          alert={primary.href ? { ...primary, message: `${primary.message}  Fix now →` } : primary}
        />

        {/* Secondary alerts — collapsible */}
        {secondary.length > 0 && (
          <li>
            <button
              type="button"
              onClick={() => setSecondaryOpen((o) => !o)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-1 text-xs font-semibold"
            >
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", secondaryOpen && "rotate-180")}
              />
              {secondaryOpen ? "Hide" : `Also: ${secondary.length} more`}
            </button>
            {secondaryOpen && (
              <ul className="mt-2 flex flex-col gap-2">
                {secondary.map((a) => (
                  <AlertRow key={a.id} alert={a} />
                ))}
              </ul>
            )}
          </li>
        )}
      </ul>
    </section>
  );
}
