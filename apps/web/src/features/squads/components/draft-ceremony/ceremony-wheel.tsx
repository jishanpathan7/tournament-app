"use client";

import gsap from "gsap";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import { getCard } from "@/features/squads/components/draft-ceremony/power-cards";
import type { WheelSlot } from "@/features/squads/components/draft-ceremony/power-slots";

const WHEEL_COLORS = [
  "#4f6bf6", // --candy
  "#34d399", // --mint
  "#fbbf24", // --yellow
  "#f472b6", // --pink
  "#3a4fd8", // --candy-dark
  "#10b981", // --mint-dark
  "#9db0fb", // --candy-ink
  "#db2777", // --pink-dark
];

function segColor(i: number) {
  return WHEEL_COLORS[i % WHEEL_COLORS.length]!;
}

const CX = 300;
const CY = 300;
const R = 276;
const HUB = 48;

function polarToXY(angleDeg: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function segmentPath(start: number, end: number): string {
  const s = polarToXY(start, R);
  const e = polarToXY(end, R);
  const si = polarToXY(start, HUB);
  const ei = polarToXY(end, HUB);
  const large = end - start > 180 ? 1 : 0;
  return [
    `M ${si.x} ${si.y}`,
    `L ${s.x} ${s.y}`,
    `A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y}`,
    `L ${ei.x} ${ei.y}`,
    `A ${HUB} ${HUB} 0 ${large} 0 ${si.x} ${si.y}`,
    "Z",
  ].join(" ");
}

function label(name: string, n: number): string {
  const maxChars = n > 24 ? 10 : n > 16 ? 13 : n > 10 ? 16 : 20;
  const first = name.split(" ")[0]!;
  if (n > 22 && first.length <= maxChars) return first;
  return name.length > maxChars ? name.slice(0, maxChars - 1) + "…" : name;
}

function fontSize(n: number): number {
  if (n > 24) return 9;
  if (n > 18) return 11;
  if (n > 12) return 13;
  if (n > 8) return 15;
  return 17;
}

// ── Audio ─────────────────────────────────────────────────────────────────────

function playTick(ctx: AudioContext, freq = 1100, vol = 0.08) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.025);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.025);
}

function tryPlayTick(ctx: AudioContext | null, freq?: number, vol?: number): AudioContext | null {
  try {
    const c = ctx ?? new AudioContext();
    playTick(c, freq, vol);
    return c;
  } catch {
    return ctx;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface WheelHandle {
  spin(targetIndex: number): Promise<void>;
  intro(): void;
}

interface Props {
  slots: WheelSlot[];
  highlightIndex: number | null;
  reducedMotion?: boolean;
}

/** Label for a slot — player name or the power's short label. */
function slotLabel(slot: WheelSlot, n: number): string {
  if (slot.type === "power") {
    const meta = getCard(slot.power);
    return `${meta.emoji} ${meta.label}`;
  }
  return label(slot.player.displayName, n);
}

export const CeremonyWheel = forwardRef<WheelHandle, Props>(function CeremonyWheel(
  { slots: players, highlightIndex, reducedMotion },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const spinnerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const totalRotationRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const didIntroRef = useRef(false);

  // Mount intro
  useEffect(() => {
    if (reducedMotion || didIntroRef.current || !wrapRef.current) return;
    didIntroRef.current = true;
    gsap.fromTo(
      wrapRef.current,
      { scale: 0.72, opacity: 0, rotateZ: -8 },
      { scale: 1, opacity: 1, rotateZ: 0, duration: 0.85, ease: "back.out(1.3)" },
    );
  }, [reducedMotion]);

  useImperativeHandle(ref, () => ({
    intro() {
      if (reducedMotion || !wrapRef.current) return;
      gsap.fromTo(
        wrapRef.current,
        { scale: 0.72, opacity: 0, rotateZ: -8 },
        { scale: 1, opacity: 1, rotateZ: 0, duration: 0.85, ease: "back.out(1.3)" },
      );
    },

    spin(targetIndex: number): Promise<void> {
      return new Promise((resolve) => {
        if (!spinnerRef.current) {
          resolve();
          return;
        }
        const n = players.length;
        if (n === 0) {
          resolve();
          return;
        }

        if (reducedMotion) {
          // Instant snap for reduced-motion
          const segAngle = 360 / n;
          const targetCenter = targetIndex * segAngle + segAngle / 2;
          const currentAngle = totalRotationRef.current % 360;
          const alignOffset = (((360 - targetCenter - currentAngle) % 360) + 360) % 360;
          totalRotationRef.current += alignOffset;
          gsap.set(spinnerRef.current, { rotation: totalRotationRef.current });
          resolve();
          return;
        }

        const segAngle = 360 / n;
        const targetCenter = targetIndex * segAngle + segAngle / 2;
        const currentAngle = totalRotationRef.current % 360;
        const alignOffset = (((360 - targetCenter - currentAngle) % 360) + 360) % 360;
        const extraSpins = (6 + Math.floor(Math.random() * 4)) * 360;
        const finalRotation = totalRotationRef.current + extraSpins + alignOffset;
        const spinUpTo =
          totalRotationRef.current + (finalRotation - totalRotationRef.current) * 0.15;

        let lastSeg = -1;
        let lastTime = 0;
        let spinSpeed = 0;

        function attachTick(tween: gsap.core.Tween) {
          tween.eventCallback("onUpdate", function () {
            const now = performance.now();
            const cur = gsap.getProperty(spinnerRef.current!, "rotation") as number;
            const seg = Math.floor(((360 - (cur % 360) + 360) % 360) / segAngle) % n;
            const dt = now - lastTime;

            if (seg !== lastSeg && dt > 0) {
              const rpm = (segAngle / dt) * 60_000;
              spinSpeed = rpm;
              const vol = Math.min(0.14, 0.04 + rpm * 0.0006);
              const freq = 900 + Math.min(rpm * 0.8, 600);
              lastSeg = seg;
              lastTime = now;
              audioCtxRef.current = tryPlayTick(audioCtxRef.current, freq, vol);
            }
          });
        }

        // Phase 1: accelerate
        const phase1 = gsap.to(spinnerRef.current, {
          rotation: spinUpTo,
          transformOrigin: "center center",
          duration: 0.85,
          ease: "power3.in",
          onComplete() {
            // Phase 2: full-speed cruise → natural decelerate
            const phase2 = gsap.to(spinnerRef.current!, {
              rotation: finalRotation,
              transformOrigin: "center center",
              duration: 4.8,
              ease: "power4.out",
              onComplete() {
                totalRotationRef.current = finalRotation;
                // Landing lock animation — brief bounce
                gsap.to(spinnerRef.current!, {
                  rotation: finalRotation - 1.2,
                  duration: 0.12,
                  ease: "power2.out",
                  yoyo: true,
                  repeat: 1,
                  onComplete() {
                    // Glow flash
                    if (glowRef.current) {
                      gsap.fromTo(
                        glowRef.current,
                        { opacity: 0.9, scale: 1.06 },
                        { opacity: 0, scale: 1, duration: 0.6, ease: "power2.out" },
                      );
                    }
                    resolve();
                  },
                });
                void spinSpeed;
              },
            });
            attachTick(phase2);
          },
        });
        attachTick(phase1);
        lastTime = performance.now();
      });
    },
  }));

  const n = players.length;
  const segAngle = n > 0 ? 360 / n : 360;
  const fs = fontSize(n);
  const textX = CX + HUB + 12;

  return (
    <div className="relative flex select-none items-center justify-center">
      {/* Pointer */}
      <div
        className="pointer-events-none absolute z-10"
        style={{
          top: -6,
          left: "50%",
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "16px solid transparent",
          borderRight: "16px solid transparent",
          borderTop: "32px solid #FFFDF5",
          filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.7))",
        }}
      />

      {/* Glow flash overlay (landing) */}
      <div
        ref={glowRef}
        className="pointer-events-none absolute inset-0 z-[5] rounded-full opacity-0"
        style={{
          background: "radial-gradient(circle, rgba(255,255,255,0.22) 0%, transparent 70%)",
        }}
      />

      {/* Rotating wheel */}
      <div ref={wrapRef} style={{ willChange: "transform, opacity" }}>
        <div ref={spinnerRef} style={{ willChange: "transform" }}>
          <svg
            width={CX * 2}
            height={CY * 2}
            viewBox={`0 0 ${CX * 2} ${CY * 2}`}
            style={{ display: "block" }}
          >
            <defs>
              <filter id="wheel-drop" x="-8%" y="-8%" width="116%" height="116%">
                <feDropShadow dx="0" dy="8" stdDeviation="16" floodOpacity="0.45" />
              </filter>
              <filter id="wheel-glow" x="-12%" y="-12%" width="124%" height="124%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="txt-shadow" x="-10%" y="-30%" width="120%" height="160%">
                <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.8" />
              </filter>
              <radialGradient id="hub-grad" cx="50%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#9db0fb" />
                <stop offset="100%" stopColor="#3a4fd8" />
              </radialGradient>
            </defs>

            <g filter="url(#wheel-drop)">
              {n === 0 ? (
                <circle cx={CX} cy={CY} r={R} fill="#28324a" />
              ) : (
                players.map((slot, i) => {
                  const start = i * segAngle;
                  const end = start + segAngle;
                  const mid = start + segAngle / 2;
                  const isPower = slot.type === "power";
                  const color = isPower ? getCard(slot.power).color : segColor(i);
                  const isHL = highlightIndex === i;

                  return (
                    <g key={slot.id}>
                      <path
                        d={segmentPath(start, end)}
                        fill={color}
                        stroke={isPower ? "#fffdf5" : "#1e293b"}
                        strokeWidth={isPower ? 3.5 : 2.5}
                        opacity={isHL ? 1 : highlightIndex !== null ? 0.55 : 0.9}
                        filter={isPower ? "url(#wheel-glow)" : undefined}
                        style={{ transition: "opacity 0.3s ease" }}
                      />
                      {(() => {
                        const isFlipped = mid > 90 && mid < 270;
                        const rot = isFlipped ? mid - 90 + 180 : mid - 90;
                        const tx = isFlipped ? CX - HUB - 12 : textX;
                        const anchor = isFlipped ? "end" : "start";
                        return (
                          <g transform={`rotate(${rot}, ${CX}, ${CY})`}>
                            <text
                              x={tx}
                              y={CY}
                              textAnchor={anchor}
                              dominantBaseline="central"
                              fontSize={isPower ? fs + 1 : fs}
                              fontWeight={isPower ? "900" : "700"}
                              fill="white"
                              filter="url(#txt-shadow)"
                              style={{
                                pointerEvents: "none",
                                userSelect: "none",
                                letterSpacing: "0.01em",
                              }}
                            >
                              {slotLabel(slot, n)}
                            </text>
                          </g>
                        );
                      })()}
                    </g>
                  );
                })
              )}

              {/* Outer rim */}
              <circle cx={CX} cy={CY} r={R} fill="none" stroke="#1e293b" strokeWidth={4} />
              {/* Inner ring accent */}
              <circle
                cx={CX}
                cy={CY}
                r={HUB + 2}
                fill="none"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth={1}
              />
              {/* Hub */}
              <circle cx={CX} cy={CY} r={HUB} fill="url(#hub-grad)" />
              <circle cx={CX} cy={CY} r={14} fill="white" opacity={0.92} />
              <circle cx={CX} cy={CY} r={7} fill="#4F6BF6" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
});
