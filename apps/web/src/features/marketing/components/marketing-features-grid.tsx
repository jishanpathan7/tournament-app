import {
  BarChart3,
  Globe,
  Layers,
  Radio,
  Shuffle,
  Users,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
  {
    title: "Smart Pairing",
    description: "Seed-aware draws with fairness scoring and rest-day balancing built in.",
    icon: Shuffle,
    tone: "bg-candy/15 text-candy-dark",
  },
  {
    title: "Live Courts",
    description: "Queue management, court assignment, and real-time score entry from any device.",
    icon: Radio,
    tone: "bg-mint/30 text-ink",
  },
  {
    title: "Public Scores",
    description: "Shareable microsites with brackets, fixtures, and standings — no login required.",
    icon: Globe,
    tone: "bg-yellow/30 text-ink",
  },
  {
    title: "Multi-sport Engine",
    description: "Round robin, knockout, groups — sport profiles plug in without schema changes.",
    icon: Layers,
    tone: "bg-pink/30 text-ink",
  },
  {
    title: "Registration Ops",
    description: "Import rosters, manage divisions, and track readiness from one dashboard.",
    icon: Users,
    tone: "bg-candy/15 text-candy-dark",
  },
  {
    title: "Insights",
    description: "Activity feeds, standings snapshots, and export-ready results when the event ends.",
    icon: BarChart3,
    tone: "bg-mint/30 text-ink",
  },
] as const;

export function MarketingFeaturesGrid() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20 md:px-8">
      <div className="max-w-2xl">
        <p className="text-yellow font-mono text-xs font-semibold uppercase tracking-[0.28em]">
          Platform
        </p>
        <h2 className="font-serif mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Everything organizers need,{" "}
          <span className="text-candy italic">nothing they don&apos;t.</span>
        </h2>
        <p className="text-muted-foreground mt-4 text-lg">
          From the first registration to the trophy ceremony — Playlane handles the operational
          complexity so you can focus on the competition.
        </p>
      </div>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ title, description, icon: Icon, tone }) => (
          <Card key={title}>
            <CardHeader>
              <span
                className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}
              >
                <Icon className="h-5 w-5" strokeWidth={2.25} />
              </span>
              <CardTitle className="text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
