import { Badge } from "@/components/ui/badge";
import { confidenceMeta } from "@/features/pairing/config";
import { cn } from "@/lib/utils";

/**
 * Team strength + pairing-confidence visualization. The bar fills by confidence (0..1);
 * its tone bands from mint (balanced) to pink (lopsided). Strength is shown as tabular
 * digits so rows align. A signature detail of the Smart Pairing review board.
 */
export function TeamStrengthBar({
  strength,
  confidence,
}: {
  strength: number;
  confidence: number;
}) {
  const meta = confidenceMeta(confidence);
  const fill: Record<string, string> = {
    mint: "bg-mint",
    candy: "bg-candy",
    yellow: "bg-yellow",
    pink: "bg-pink",
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs text-muted-foreground font-mono uppercase tracking-[0.14em]">
          Strength <span className="text-ink tabular-nums">{strength}</span>
        </span>
        <Badge tone={meta.tone} aria-label={`Pairing confidence ${meta.pct}%`}>
          {meta.label} · {meta.pct}%
        </Badge>
      </div>
      <div
        className="border-ink bg-card h-2.5 w-full overflow-hidden rounded-full border-2"
        role="progressbar"
        aria-valuenow={meta.pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn("h-full rounded-full transition-[width]", fill[meta.tone] ?? "bg-muted")}
          style={{ width: `${meta.pct}%` }}
        />
      </div>
    </div>
  );
}
