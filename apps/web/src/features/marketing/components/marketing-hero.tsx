import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/site";

import { MarketingHeroCard } from "./marketing-hero-card";

export function MarketingHero() {
  return (
    <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center md:px-8 md:py-24">
      <div>
        <p className="text-yellow font-mono text-xs font-semibold uppercase tracking-[0.28em]">
          Competition OS
        </p>
        <h1 className="font-serif mt-4 text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl lg:text-[3.25rem]">
          {SITE.tagline.split("champion")[0]}
          <span className="text-candy italic">champion</span>
          {SITE.tagline.split("champion")[1] ?? "."}
        </h1>
        <p className="text-muted-foreground mt-5 max-w-lg text-lg leading-relaxed">
          {SITE.description} Pair players, run live courts, publish standings — all from one
          modern workspace built for organizers who care about fairness.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button tone="candy" size="lg" asChild>
            <Link href="/register">
              Get started free
              <ArrowRight className="h-5 w-5" strokeWidth={2.25} />
            </Link>
          </Button>
          <Button tone="paper" size="lg" asChild>
            <Link href="#live-demo">See live demo</Link>
          </Button>
        </div>
        <div className="text-muted-foreground mt-10 flex flex-wrap items-center gap-4 text-sm">
          <span className="inline-flex items-center gap-2">
            <Users className="h-4 w-4" strokeWidth={2.25} />
            Built for clubs, leagues &amp; corporate events
          </span>
          <span className="hidden sm:inline">·</span>
          <span>Multi-sport · Sport-agnostic engine</span>
        </div>
      </div>
      <MarketingHeroCard />
    </section>
  );
}
