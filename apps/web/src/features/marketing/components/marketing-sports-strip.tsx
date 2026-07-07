"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { Dumbbell, Feather, Gamepad2, Medal, Swords, Trophy } from "lucide-react";

const SPORTS = [
  { label: "Badminton", icon: Feather },
  { label: "Cricket", icon: Trophy },
  { label: "Football", icon: Medal },
  { label: "Table Tennis", icon: Dumbbell },
  { label: "Chess", icon: Swords },
  { label: "Esports", icon: Gamepad2 },
] as const;

// Duplicate for seamless loop
const ITEMS = [...SPORTS, ...SPORTS];

export function MarketingSportsStrip() {
  const trackRef = useRef<HTMLDivElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const totalWidth = track.scrollWidth / 2;
    const ctx = gsap.context(() => {
      tweenRef.current = gsap.to(track, {
        x: -totalWidth,
        duration: 18,
        ease: "none",
        repeat: -1,
        modifiers: {
          x: gsap.utils.unitize((x) => parseFloat(x) % totalWidth),
        },
      });
    });

    const pause = () => tweenRef.current?.pause();
    const resume = () => tweenRef.current?.resume();
    track.parentElement?.addEventListener("mouseenter", pause);
    track.parentElement?.addEventListener("mouseleave", resume);

    return () => {
      ctx.revert();
      track.parentElement?.removeEventListener("mouseenter", pause);
      track.parentElement?.removeEventListener("mouseleave", resume);
    };
  }, []);

  return (
    <section id="sports" className="border-ink/10 bg-muted/30 overflow-hidden border-y py-8">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <p className="text-muted-foreground text-2xs mb-4 font-mono font-semibold uppercase tracking-[0.24em]">
          One engine · every sport
        </p>
      </div>
      <div className="relative overflow-hidden">
        <div ref={trackRef} className="flex w-max gap-3">
          {ITEMS.map(({ label, icon: Icon }, i) => (
            <span
              key={`${label}-${i}`}
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
