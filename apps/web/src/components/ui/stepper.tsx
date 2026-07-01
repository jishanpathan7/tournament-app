import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Horizontal stepper (design system §5): numbered nodes, candy = active/done, mint check
 * = complete. Used by the create-tournament wizard. Purely presentational.
 */
export function Stepper({
  steps,
  current,
  onStepClick,
}: {
  steps: string[];
  current: number;
  onStepClick?: (index: number) => void;
}) {
  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const clickable = onStepClick && i <= current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick(i)}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full outline-none",
                clickable && "focus-visible:ring-candy cursor-pointer",
              )}
            >
              <span
                className={cn(
                  "border-ink flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 font-mono text-xs font-bold",
                  done && "bg-mint text-ink",
                  active && "bg-candy text-white",
                  !done && !active && "bg-card text-muted-foreground",
                )}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-2xs hidden font-mono font-semibold uppercase tracking-[0.16em] sm:inline",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </button>
            {i < steps.length - 1 ? (
              <span className={cn("h-0.5 flex-1 rounded-full", done ? "bg-mint" : "bg-border")} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
