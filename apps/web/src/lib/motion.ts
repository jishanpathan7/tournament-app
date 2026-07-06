"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/** Call once per client component tree that uses ScrollTrigger. */
export function registerScrollTrigger() {
  gsap.registerPlugin(ScrollTrigger);
}

/** Default easing tokens for the Playlane motion system. */
export const ease = {
  out: "power3.out",
  in: "power3.in",
  inOut: "power3.inOut",
  bounce: "back.out(1.4)",
  expo: "expo.out",
} as const;

/** Duration tokens (seconds). */
export const dur = {
  xs: 0.25,
  sm: 0.4,
  md: 0.6,
  lg: 0.9,
  xl: 1.2,
} as const;

/** Stagger token. */
export const stagger = {
  xs: 0.04,
  sm: 0.07,
  md: 0.1,
  lg: 0.15,
} as const;

/**
 * Build a standard ScrollTrigger config for section reveals.
 * Applies a fade+translateY entrance when the element enters the viewport.
 */
export function revealFrom(
  targets: gsap.TweenTarget,
  vars: gsap.TweenVars = {},
  triggerEl?: Element | null,
) {
  return gsap.fromTo(
    targets,
    { opacity: 0, y: 32 },
    {
      opacity: 1,
      y: 0,
      duration: dur.md,
      ease: ease.out,
      scrollTrigger: {
        trigger: triggerEl ?? (targets as Element),
        start: "top 85%",
        once: true,
      },
      ...vars,
    },
  );
}
