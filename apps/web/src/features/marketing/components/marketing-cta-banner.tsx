"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import gsap from "gsap";

import { Button } from "@/components/ui/button";
import { dur, ease, registerScrollTrigger, stagger } from "@/lib/motion";
registerScrollTrigger();

export function MarketingCtaBanner() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".cta-content > *",
        { opacity: 0, y: 32 },
        {
          opacity: 1,
          y: 0,
          duration: dur.md,
          ease: ease.out,
          stagger: stagger.md,
          scrollTrigger: { trigger: el, start: "top 82%", once: true },
        },
      );
      el.querySelectorAll<HTMLElement>(".cta-btn").forEach((btn) => {
        const setX = gsap.quickTo(btn, "x", { duration: 0.4, ease: ease.out });
        const setY = gsap.quickTo(btn, "y", { duration: 0.4, ease: ease.out });
        btn.addEventListener("mousemove", (e) => {
          const rect = btn.getBoundingClientRect();
          setX((e.clientX - rect.left - rect.width / 2) * 0.22);
          setY((e.clientY - rect.top - rect.height / 2) * 0.22);
        });
        btn.addEventListener("mouseleave", () => {
          setX(0);
          setY(0);
        });
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="live-demo" className="bg-ink text-paper py-20">
      <div className="mx-auto max-w-6xl px-4 text-center md:px-8">
        <div className="cta-content flex flex-col items-center gap-4">
          <h2 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">
            Your next tournament, <span className="text-candy italic">handled.</span>
          </h2>
          <p className="text-paper/70 mx-auto max-w-xl text-lg">
            Start free — no credit card. Or browse live public scores right now.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Button tone="candy" size="lg" asChild className="cta-btn will-change-transform">
              <Link href="/register">
                Create your event
                <ArrowRight className="h-5 w-5" strokeWidth={2.25} />
              </Link>
            </Button>
            <Button
              tone="paper"
              size="lg"
              asChild
              className="cta-btn border-paper/20 bg-paper/10 text-paper hover:bg-paper/20 will-change-transform"
            >
              <Link href="/search">Browse live scores</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
