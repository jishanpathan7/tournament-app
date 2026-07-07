"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { dur, ease, registerScrollTrigger, stagger } from "@/lib/motion";
registerScrollTrigger();

const STEPS = [
  {
    step: "01",
    title: "Create & import",
    description: "Set up your tournament, divisions, and import your roster in minutes.",
  },
  {
    step: "02",
    title: "Pair & seed",
    description: "Generate fair draws with smart pairing — review, tweak, and publish.",
  },
  {
    step: "03",
    title: "Run live",
    description: "Assign courts, enter scores, and keep players and fans updated in real time.",
  },
  {
    step: "04",
    title: "Publish results",
    description: "Standings, brackets, and exports — shareable the moment the final point lands.",
  },
] as const;

export function MarketingSteps() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".steps-heading",
        { opacity: 0, y: 28 },
        {
          opacity: 1,
          y: 0,
          duration: dur.md,
          ease: ease.out,
          scrollTrigger: { trigger: ".steps-heading", start: "top 88%", once: true },
        },
      );
      gsap.fromTo(
        ".step-item",
        { opacity: 0, y: 36 },
        {
          opacity: 1,
          y: 0,
          duration: dur.md,
          ease: ease.out,
          stagger: stagger.md,
          scrollTrigger: { trigger: ".step-item", start: "top 88%", once: true },
        },
      );
      el.querySelectorAll<HTMLElement>(".step-number").forEach((num, i) => {
        const target = i + 1;
        const obj = { val: 0 };
        ScrollTrigger.create({
          trigger: num,
          start: "top 90%",
          once: true,
          onEnter() {
            gsap.to(obj, {
              val: target,
              duration: 0.6,
              ease: "power2.out",
              onUpdate() {
                num.textContent = String(Math.round(obj.val)).padStart(2, "0");
              },
            });
          },
        });
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="how-it-works" className="bg-muted/30 py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="steps-heading max-w-2xl">
          <p className="text-yellow font-mono text-xs font-semibold uppercase tracking-[0.28em]">
            How it works
          </p>
          <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight md:text-4xl">
            Four steps to a <span className="text-candy italic">flawless event.</span>
          </h2>
        </div>
        <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ step, title, description }) => (
            <li key={step} className="step-item relative">
              <span className="step-number text-candy font-mono text-sm font-bold">{step}</span>
              <h3 className="mt-2 text-lg font-semibold">{title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
