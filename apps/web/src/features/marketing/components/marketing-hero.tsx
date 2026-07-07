"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import gsap from "gsap";

import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/site";
import { dur, ease, stagger } from "@/lib/motion";
import { MarketingHeroCard } from "./marketing-hero-card";

export function MarketingHero() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: ease.out } });

      tl.fromTo(".hero-eyebrow", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: dur.sm });
      tl.fromTo(
        ".hero-word",
        { opacity: 0, y: "110%", rotateX: -20 },
        { opacity: 1, y: "0%", rotateX: 0, duration: dur.md, stagger: stagger.xs },
        "-=0.1",
      );
      tl.fromTo(
        ".hero-body",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: dur.sm },
        "-=0.3",
      );
      tl.fromTo(
        ".hero-cta",
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: dur.sm, stagger: stagger.sm },
        "-=0.2",
      );
      tl.fromTo(".hero-social", { opacity: 0 }, { opacity: 1, duration: dur.sm }, "-=0.1");
      tl.fromTo(
        ".hero-card",
        { opacity: 0, x: 48, scale: 0.97 },
        { opacity: 1, x: 0, scale: 1, duration: dur.lg, ease: ease.expo },
        0.15,
      );
    }, el);

    return () => ctx.revert();
  }, []);

  const [before, after] = SITE.tagline.split("champion");

  return (
    <section
      ref={sectionRef}
      className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center md:px-8 md:py-24"
    >
      <div>
        <p className="hero-eyebrow text-yellow font-mono text-xs font-semibold uppercase tracking-[0.28em]">
          Competition OS
        </p>
        <h1 className="mt-4 overflow-hidden font-serif text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl lg:text-[3.25rem]">
          {/* Split heading into word spans for staggered reveal */}
          <span style={{ display: "block", overflow: "hidden", paddingBottom: "0.1em" }}>
            {before
              ?.trim()
              .split(" ")
              .map((word, i) => (
                <span
                  key={i}
                  className="hero-word"
                  style={{ display: "inline-block", marginRight: "0.28em" }}
                >
                  {word}
                </span>
              ))}
            <span
              className="hero-word text-candy italic"
              style={{ display: "inline-block", marginRight: "0.28em" }}
            >
              champion
            </span>
            {(after ?? ".")
              .trim()
              .split(" ")
              .filter(Boolean)
              .map((word, i) => (
                <span
                  key={i}
                  className="hero-word"
                  style={{ display: "inline-block", marginRight: "0.28em" }}
                >
                  {word}
                </span>
              ))}
          </span>
        </h1>
        <p className="hero-body text-muted-foreground mt-5 max-w-lg text-lg leading-relaxed">
          {SITE.description} Pair players, run live courts, publish standings — all from one modern
          workspace built for organizers who care about fairness.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button tone="candy" size="lg" asChild className="hero-cta">
            <Link href="/register">
              Get started free
              <ArrowRight className="h-5 w-5" strokeWidth={2.25} />
            </Link>
          </Button>
          <Button tone="paper" size="lg" asChild className="hero-cta">
            <Link href="#live-demo">See live demo</Link>
          </Button>
        </div>
        <div className="hero-social text-muted-foreground mt-10 flex flex-wrap items-center gap-4 text-sm">
          <span className="inline-flex items-center gap-2">
            <Users className="h-4 w-4" strokeWidth={2.25} />
            Built for clubs, leagues &amp; corporate events
          </span>
          <span className="hidden sm:inline">·</span>
          <span>Multi-sport · Sport-agnostic engine</span>
        </div>
      </div>
      <div className="hero-card">
        <MarketingHeroCard />
      </div>
    </section>
  );
}
