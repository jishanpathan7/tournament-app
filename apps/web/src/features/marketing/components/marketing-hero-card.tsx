"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { dur, ease } from "@/lib/motion";

/** Decorative live tournament card for the marketing hero. */
export function MarketingHeroCard() {
  const cardRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const scoreARef = useRef<HTMLParagraphElement>(null);
  const scoreBRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        barRef.current,
        { width: "0%" },
        { width: "98%", duration: dur.xl, ease: ease.expo, delay: 0.8 },
      );

      const objA = { val: 14 };
      const objB = { val: 12 };

      gsap.to(objA, {
        val: 21,
        duration: 1.2,
        ease: "power2.out",
        delay: 0.5,
        onUpdate() {
          if (scoreARef.current) scoreARef.current.textContent = String(Math.round(objA.val));
        },
      });
      gsap.to(objB, {
        val: 18,
        duration: 1.4,
        ease: "power2.out",
        delay: 0.5,
        onUpdate() {
          if (scoreBRef.current) scoreBRef.current.textContent = String(Math.round(objB.val));
        },
      });

      const pulse = gsap.timeline({ repeat: -1, repeatDelay: 4.5, delay: 2.5 });
      pulse
        .to(scoreARef.current, {
          scale: 1.12,
          color: "#34D399",
          duration: 0.15,
          ease: ease.out,
          yoyo: true,
          repeat: 1,
        })
        .to(scoreARef.current, { scale: 1, color: "inherit", duration: 0.2 }, "+=0.05");
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={cardRef}>
      <Card className="bg-ink text-paper border-ink shadow-sticker-lg overflow-hidden">
        <CardHeader className="border-paper/10 flex-row items-center justify-between space-y-0 border-b pb-4">
          <div>
            <p className="text-paper/60 text-2xs font-mono uppercase tracking-[0.2em]">Live now</p>
            <p className="mt-1 font-serif text-xl font-semibold">Summer Open · MD Final</p>
          </div>
          <Badge tone="mint" className="animate-pulse">
            LIVE
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="border-paper/15 rounded-xl border p-4">
              <p className="text-paper/60 text-xs">Player A</p>
              <p ref={scoreARef} className="mt-1 text-2xl font-bold tabular-nums">
                21
              </p>
              <p className="text-paper/50 text-xs">Game 2</p>
            </div>
            <div className="border-paper/15 rounded-xl border p-4">
              <p className="text-paper/60 text-xs">Player B</p>
              <p ref={scoreBRef} className="mt-1 text-2xl font-bold tabular-nums">
                18
              </p>
              <p className="text-paper/50 text-xs">Game 2</p>
            </div>
          </div>
          <div className="border-paper/15 bg-paper/5 rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <span className="text-paper/70 text-sm">Fairness score</span>
              <span className="text-mint font-mono text-sm font-semibold">98%</span>
            </div>
            <div className="bg-paper/10 mt-2 h-2 overflow-hidden rounded-full">
              <div ref={barRef} className="bg-mint h-full rounded-full" style={{ width: "0%" }} />
            </div>
            <p className="text-paper/50 mt-2 text-xs">
              Smart pairing · rest balanced · seed protected
            </p>
          </div>
          <p className="text-paper/40 text-2xs font-mono uppercase tracking-[0.16em]">
            Court 3 · Updated 12s ago
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
