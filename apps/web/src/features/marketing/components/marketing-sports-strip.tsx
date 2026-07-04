import {
  Dumbbell,
  Feather,
  Gamepad2,
  Medal,
  Swords,
  Trophy,
} from "lucide-react";

const SPORTS = [
  { label: "Badminton", icon: Feather },
  { label: "Cricket", icon: Trophy },
  { label: "Football", icon: Medal },
  { label: "Table Tennis", icon: Dumbbell },
  { label: "Chess", icon: Swords },
  { label: "Esports", icon: Gamepad2 },
] as const;

export function MarketingSportsStrip() {
  return (
    <section id="sports" className="border-ink/10 border-y bg-muted/30 py-8">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <p className="text-muted-foreground text-2xs mb-4 font-mono font-semibold uppercase tracking-[0.24em]">
          One engine · every sport
        </p>
        <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SPORTS.map(({ label, icon: Icon }) => (
            <span
              key={label}
              className="border-ink bg-card shadow-sticker-xs inline-flex shrink-0 items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-medium"
            >
              <Icon className="h-4 w-4" strokeWidth={2.25} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
