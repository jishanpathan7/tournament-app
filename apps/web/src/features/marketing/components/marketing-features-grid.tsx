"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { BarChart3, Globe, Layers, Radio, Shuffle, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dur, ease, registerScrollTrigger, stagger } from "@/lib/motion";
registerScrollTrigger();

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
    description:
      "Activity feeds, standings snapshots, and export-ready results when the event ends.",
    icon: BarChart3,
    tone: "bg-mint/30 text-ink",
  },
] as const;

export function MarketingFeaturesGrid() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".features-heading",
        { opacity: 0, y: 28 },
        {
          opacity: 1,
          y: 0,
          duration: dur.md,
          ease: ease.out,
          scrollTrigger: { trigger: ".features-heading", start: "top 88%", once: true },
        },
      );
      gsap.fromTo(
        ".feature-card",
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: dur.md,
          ease: ease.out,
          stagger: stagger.sm,
          scrollTrigger: { trigger: ".feature-card", start: "top 88%", once: true },
        },
      );
      el.querySelectorAll<HTMLElement>(".feature-card").forEach((card) => {
        const setY = gsap.quickTo(card, "y", { duration: 0.3, ease: ease.out });
        card.addEventListener("mouseenter", () => setY(-6));
        card.addEventListener("mouseleave", () => setY(0));
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="features" className="mx-auto max-w-6xl px-4 py-20 md:px-8">
      <div className="features-heading max-w-2xl">
        <p className="text-yellow font-mono text-xs font-semibold uppercase tracking-[0.28em]">
          Platform
        </p>
        <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight md:text-4xl">
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
          <Card
            key={title}
            className="feature-card transition-shadow duration-300 will-change-transform"
          >
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
