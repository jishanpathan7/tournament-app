"use client";

import gsap from "gsap";
import { forwardRef, useImperativeHandle, useRef } from "react";

import type { UnassignedRegistrationView } from "@/features/squads/types";

// Six vibrant brand-adjacent colours — matching the reference wheel
const WHEEL_COLORS = [
  "#4F6BF6", // Court Cobalt (primary)
  "#34D399", // Mint
  "#F43F5E", // Rose
  "#FBBF24", // Yellow
  "#F472B6", // Pink
  "#FB923C", // Orange
];

function segColor(i: number) {
  return WHEEL_COLORS[i % WHEEL_COLORS.length]!;
}

// Wheel geometry
const CX = 300;
const CY = 300;
const R  = 284;
const HUB = 44;

function polarToXY(angleDeg: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function segmentPath(start: number, end: number): string {
  const s  = polarToXY(start, R);
  const e  = polarToXY(end,   R);
  const si = polarToXY(start, HUB);
  const ei = polarToXY(end,   HUB);
  const large = end - start > 180 ? 1 : 0;
  return [
    `M ${si.x} ${si.y}`, `L ${s.x} ${s.y}`,
    `A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y}`,
    `L ${ei.x} ${ei.y}`,
    `A ${HUB} ${HUB} 0 ${large} 0 ${si.x} ${si.y}`, "Z",
  ].join(" ");
}

// Truncate label to fit the radial space
function label(name: string, n: number): string {
  const maxChars = n > 24 ? 10 : n > 16 ? 13 : n > 10 ? 16 : 20;
  const first = name.split(" ")[0]!;
  // For very small segments show first name only
  if (n > 22 && first.length <= maxChars) return first;
  return name.length > maxChars ? name.slice(0, maxChars - 1) + "…" : name;
}

function fontSize(n: number): number {
  if (n > 24) return 9;
  if (n > 18) return 11;
  if (n > 12) return 13;
  if (n > 8)  return 15;
  return 17;
}

// ── Audio ─────────────────────────────────────────────────────────────────────

function playTick(ctx: AudioContext) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 1100;
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + 0.03);
}


function tryPlayTick(ctx: AudioContext | null): AudioContext | null {
  try {
    const c = ctx ?? new AudioContext();
    playTick(c);
    return c;
  } catch { return ctx; }
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface WheelHandle {
  spin(targetIndex: number): Promise<void>;
}

interface Props {
  players: UnassignedRegistrationView[];
  highlightIndex: number | null;
}

export const CeremonyWheel = forwardRef<WheelHandle, Props>(function CeremonyWheel(
  { players, highlightIndex },
  ref,
) {
  const spinnerRef       = useRef<HTMLDivElement>(null);
  const totalRotationRef = useRef(0);
  const audioCtxRef      = useRef<AudioContext | null>(null);

  useImperativeHandle(ref, () => ({
    spin(targetIndex: number): Promise<void> {
      return new Promise((resolve) => {
        if (!spinnerRef.current) { resolve(); return; }
        const n = players.length;
        if (n === 0)             { resolve(); return; }

        const segAngle     = 360 / n;
        const targetCenter = targetIndex * segAngle + segAngle / 2;
        const currentAngle = totalRotationRef.current % 360;
        const alignOffset  = ((360 - targetCenter - currentAngle) % 360 + 360) % 360;
        const extraSpins   = (5 + Math.floor(Math.random() * 3)) * 360;
        const finalRotation = totalRotationRef.current + extraSpins + alignOffset;

        // Phase 1 covers 18% of total travel — quick spin-up
        const spinUpTo = totalRotationRef.current + (finalRotation - totalRotationRef.current) * 0.18;

        let lastSeg = -1;

        function attachTick(tween: gsap.core.Tween) {
          const origUpdate = tween.vars.onUpdate as (() => void) | undefined;
          tween.vars.onUpdate = function() {
            origUpdate?.();
            const cur = gsap.getProperty(spinnerRef.current!, "rotation") as number;
            const seg = Math.floor(((360 - (cur % 360) + 360) % 360) / segAngle) % n;
            if (seg !== lastSeg) { lastSeg = seg; audioCtxRef.current = tryPlayTick(audioCtxRef.current); }
          };
        }

        // Phase 1: accelerate
        const phase1 = gsap.to(spinnerRef.current, {
          rotation: spinUpTo,
          transformOrigin: "center center",
          duration: 0.9,
          ease: "power2.in",
          onComplete() {
            // Phase 2: cruise → decelerate
            const phase2 = gsap.to(spinnerRef.current!, {
              rotation: finalRotation,
              transformOrigin: "center center",
              duration: 4.2,
              ease: "power4.out",
              onComplete() {
                totalRotationRef.current = finalRotation;
                resolve();
              },
            });
            attachTick(phase2);
          },
        });
        attachTick(phase1);
      });
    },
  }));

  const n        = players.length;
  const segAngle = n > 0 ? 360 / n : 360;
  const fs       = fontSize(n);
  // Text starts just outside the hub and runs outward
  const textX    = CX + HUB + 10;

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Pointer — downward-pointing triangle sitting above the wheel */}
      <div
        className="pointer-events-none absolute z-10"
        style={{
          top: -4,
          left: "50%",
          transform: "translateX(-50%)",
          width: 0, height: 0,
          borderLeft:  "18px solid transparent",
          borderRight: "18px solid transparent",
          borderTop:   "36px solid #FFFDF5",
          filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.5))",
        }}
      />

      {/* Rotating wheel */}
      <div ref={spinnerRef} style={{ willChange: "transform" }}>
        <svg
          width={CX * 2}
          height={CY * 2}
          viewBox={`0 0 ${CX * 2} ${CY * 2}`}
          style={{ display: "block" }}
        >
          <defs>
            <filter id="wheel-drop" x="-6%" y="-6%" width="112%" height="112%">
              <feDropShadow dx="0" dy="6" stdDeviation="12" floodOpacity="0.3" />
            </filter>
            <filter id="txt-shadow" x="-10%" y="-30%" width="120%" height="160%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.7" />
            </filter>
          </defs>

          <g filter="url(#wheel-drop)">
            {n === 0 ? (
              <circle cx={CX} cy={CY} r={R} fill="#28324A" />
            ) : (
              players.map((player, i) => {
                const start = i * segAngle;
                const end   = start + segAngle;
                const mid   = start + segAngle / 2;
                const color = segColor(i);
                const isHL  = highlightIndex === i;

                return (
                  <g key={player.registrationId}>
                    {/* Segment */}
                    <path
                      d={segmentPath(start, end)}
                      fill={color}
                      stroke="#1E293B"
                      strokeWidth={2}
                      opacity={isHL ? 1 : 0.92}
                    />

                    {/*
                      Radial text — correct approach:
                      • Rotate by (mid - 90) so angle-0 (top) aligns with text's natural direction
                      • Bottom-half segments (90°–270°) get an extra 180° flip + textAnchor="end"
                        so they also read outward hub→rim instead of being upside-down
                    */}
                    {(() => {
                      const isFlipped = mid > 90 && mid < 270;
                      const rot    = isFlipped ? mid - 90 + 180 : mid - 90;
                      const tx     = isFlipped ? CX - HUB - 10  : textX;
                      const anchor = isFlipped ? "end"           : "start";
                      return (
                        <g transform={`rotate(${rot}, ${CX}, ${CY})`}>
                          <text
                            x={tx}
                            y={CY}
                            textAnchor={anchor}
                            dominantBaseline="central"
                            fontSize={fs}
                            fontWeight="700"
                            fill="white"
                            filter="url(#txt-shadow)"
                            style={{ pointerEvents: "none", userSelect: "none" }}
                          >
                            {label(player.displayName, n)}
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                );
              })
            )}

            {/* Outer rim */}
            <circle cx={CX} cy={CY} r={R}   fill="none" stroke="#1E293B" strokeWidth={3} />
            {/* Hub */}
            <circle cx={CX} cy={CY} r={HUB} fill="#1E293B" stroke="#3A4760" strokeWidth={3} />
            <circle cx={CX} cy={CY} r={12}  fill="#4F6BF6" />
          </g>
        </svg>
      </div>
    </div>
  );
});
