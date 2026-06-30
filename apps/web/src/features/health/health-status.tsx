"use client";

import { useHealth } from "./use-health";

const TONE = {
  connected: { dot: "bg-mint", label: "Connected", chip: "bg-mint-tint" },
  checking: { dot: "bg-yellow", label: "Checking…", chip: "bg-yellow-tint" },
  unreachable: { dot: "bg-pink", label: "Unreachable", chip: "bg-pink-tint" },
} as const;

export function HealthStatus() {
  const { data, isLoading, isError } = useHealth();
  const state = isLoading ? "checking" : isError ? "unreachable" : "connected";
  const tone = TONE[state];

  return (
    <section className="border-ink bg-card shadow-sticker-md rounded-2xl border-2 p-6">
      <div className="flex items-center justify-between">
        <p className="text-2xs text-muted-foreground font-mono uppercase tracking-[0.22em]">
          Backend status
        </p>
        <span
          className={`border-ink text-2xs shadow-sticker-xs inline-flex items-center gap-2 rounded-full border-2 px-3 py-1 font-mono font-bold uppercase tracking-[0.12em] ${tone.chip}`}
        >
          <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
          {tone.label}
        </span>
      </div>
      {data ? (
        <dl className="mt-4 grid grid-cols-3 gap-4 font-mono text-sm">
          <div>
            <dt className="text-2xs text-muted-foreground uppercase tracking-[0.18em]">Service</dt>
            <dd className="mt-1 font-semibold">{data.service}</dd>
          </div>
          <div>
            <dt className="text-2xs text-muted-foreground uppercase tracking-[0.18em]">Version</dt>
            <dd className="mt-1 font-semibold">{data.version}</dd>
          </div>
          <div>
            <dt className="text-2xs text-muted-foreground uppercase tracking-[0.18em]">Env</dt>
            <dd className="mt-1 font-semibold">{data.environment}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-muted-foreground mt-4 text-sm">
          {state === "unreachable"
            ? "Start the API: cd apps/api && uvicorn app.main:app --reload"
            : "Contacting the API…"}
        </p>
      )}
    </section>
  );
}
