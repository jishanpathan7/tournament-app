import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** Decorative live tournament card for the marketing hero. */
export function MarketingHeroCard() {
  return (
    <Card className="bg-ink text-paper border-ink shadow-sticker-lg overflow-hidden">
      <CardHeader className="border-paper/10 flex-row items-center justify-between space-y-0 border-b pb-4">
        <div>
          <p className="text-paper/60 text-2xs font-mono uppercase tracking-[0.2em]">
            Live now
          </p>
          <p className="font-serif mt-1 text-xl font-semibold">Summer Open · MD Final</p>
        </div>
        <Badge tone="mint" className="animate-pulse">
          LIVE
        </Badge>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="border-paper/15 rounded-xl border p-4">
            <p className="text-paper/60 text-xs">Player A</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">21</p>
            <p className="text-paper/50 text-xs">Game 2</p>
          </div>
          <div className="border-paper/15 rounded-xl border p-4">
            <p className="text-paper/60 text-xs">Player B</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">18</p>
            <p className="text-paper/50 text-xs">Game 2</p>
          </div>
        </div>
        <div className="border-paper/15 bg-paper/5 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <span className="text-paper/70 text-sm">Fairness score</span>
            <span className="text-mint font-mono text-sm font-semibold">98%</span>
          </div>
          <div className="bg-paper/10 mt-2 h-2 overflow-hidden rounded-full">
            <div className="bg-mint h-full w-[98%] rounded-full" />
          </div>
          <p className="text-paper/50 mt-2 text-xs">Smart pairing · rest balanced · seed protected</p>
        </div>
        <p className="text-paper/40 text-2xs font-mono uppercase tracking-[0.16em]">
          Court 3 · Updated 12s ago
        </p>
      </CardContent>
    </Card>
  );
}
