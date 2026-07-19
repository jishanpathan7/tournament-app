"use client";

import gsap from "gsap";
import { ArrowLeft, ChevronRight, RotateCcw, Settings2, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import ReactConfetti from "react-confetti";
import { useCallback, useEffect, useRef, useState } from "react";

import { dur, ease, stagger } from "@/lib/motion";
import {
  CeremonyWheel,
  type WheelHandle,
} from "@/features/squads/components/draft-ceremony/ceremony-wheel";
import {
  SPEED_MULTIPLIER,
  type CeremonySettings,
  type CeremonySpeed,
} from "@/features/squads/components/draft-ceremony/ceremony-settings";
import { getCard } from "@/features/squads/components/draft-ceremony/power-cards";
import type { PowerEvent as EnginePowerEvent } from "@/features/squads/components/draft-ceremony/power-cards/types";
import {
  buildWheelSlots,
  isPlayerSlot,
  skillKeyOf,
  SKILL_KEYS,
  type Meme,
  type PowerKind,
  type WheelSlot,
} from "@/features/squads/components/draft-ceremony/power-slots";
import { skillLabel, useCeremony } from "@/features/squads/components/draft-ceremony/use-ceremony";
import type {
  SquadMemberView,
  SquadView,
  UnassignedRegistrationView,
} from "@/features/squads/types";

/** Scale an animation duration (seconds) by the ceremony playback speed. */
function scaled(seconds: number, speed: CeremonySpeed) {
  return seconds * SPEED_MULTIPLIER[speed];
}

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** A power moment to announce (card drawn, or a played meme). */
interface PowerEvent {
  kind: PowerKind;
  /** Line under the title, e.g. "Team A drew 🔄 Jo Tera Hai Wo Mera". */
  detail: string;
  /** Present when a Meme Drop card is played. */
  meme?: Meme;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VICTORY_SOUND_URL = "/sounds/victory-fanfare.mp3";
const BG = "#1e293b"; // --foreground (dark surface)
const BG_SIDEBAR = "#28324a"; // --ink-2 (raised panel on dark)

// Only design-token colors — candy / mint / yellow / pink + their variants
const SQUAD_ACCENTS = [
  "#4f6bf6", // --candy
  "#34d399", // --mint
  "#fbbf24", // --yellow
  "#f472b6", // --pink
  "#3a4fd8", // --candy-dark
  "#10b981", // --mint-dark
  "#9db0fb", // --candy-ink
  "#db2777", // --pink-dark
];
const CONFETTI_COLORS = ["#4f6bf6", "#34d399", "#fbbf24", "#f472b6", "#9db0fb", "#fffdf5"];

function squadAccent(i: number) {
  return SQUAD_ACCENTS[i % SQUAD_ACCENTS.length]!;
}

function playFanfare() {
  try {
    const a = new Audio(VICTORY_SOUND_URL);
    a.volume = 0.65;
    a.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ── Ghost pill for fly-to-team ────────────────────────────────────────────────

interface GhostFlyProps {
  name: string;
  color: string;
  fromRect: DOMRect;
  toRect: DOMRect;
  onDone: () => void;
}

function GhostFly({ name, color, fromRect, toRect, onDone }: GhostFlyProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (prefersReducedMotion()) {
      onDone();
      return;
    }

    // Position at source
    gsap.set(el, {
      position: "fixed",
      top: fromRect.top + fromRect.height / 2,
      left: fromRect.left + fromRect.width / 2,
      xPercent: -50,
      yPercent: -50,
      opacity: 1,
      scale: 1.1,
    });

    gsap.to(el, {
      top: toRect.top + toRect.height / 2,
      left: toRect.left + toRect.width / 2,
      scale: 0.75,
      opacity: 0,
      duration: dur.lg,
      ease: ease.expo,
      onComplete: onDone,
    });
  }, [fromRect, toRect, onDone]);

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed z-[70] rounded-full px-4 py-1.5 text-sm font-bold text-white shadow-2xl"
      style={{ backgroundColor: color, whiteSpace: "nowrap" }}
    >
      {name}
    </div>
  );
}

// ── Confetti ──────────────────────────────────────────────────────────────────

function WinnerBurst({ burstKey }: { burstKey: number }) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (burstKey === 0) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), 3200);
    return () => clearTimeout(t);
  }, [burstKey]);
  if (!active) return null;
  return (
    <ReactConfetti
      key={burstKey}
      className="pointer-events-none fixed inset-0 z-[55]"
      colors={CONFETTI_COLORS}
      numberOfPieces={160}
      recycle={false}
      gravity={0.28}
      initialVelocityY={20}
    />
  );
}

// ── Reveal overlay (tiered player profile card) ───────────────────────────────

interface RevealInfo {
  playerName: string;
  skillLevel: string | null;
  divisionName: string | null;
  squadName: string;
  squadColor: string;
  wheelRect: DOMRect | null;
}

/** Per-tier presentation — only applied when Fun Mode + tiered reveals are on. */
interface TierStyle {
  eyebrow: string;
  accent: string;
  entrance: string;
  glow: number;
}

function tierStyle(skillLevel: string | null, tiered: boolean): TierStyle {
  if (!tiered) {
    return { eyebrow: "Now joining", accent: "#9db0fb", entrance: "back.out(1.6)", glow: 0.2 };
  }
  switch (skillLevel) {
    case "advanced":
      return { eyebrow: "⚡ Elite Pick", accent: "#fbbf24", entrance: "back.out(2.2)", glow: 0.4 };
    case "intermediate":
      return { eyebrow: "Now joining", accent: "#34d399", entrance: "back.out(1.7)", glow: 0.28 };
    case "beginner":
      return {
        eyebrow: "Welcome aboard",
        accent: "#f472b6",
        entrance: "back.out(1.4)",
        glow: 0.24,
      };
    default:
      return { eyebrow: "Now joining", accent: "#9db0fb", entrance: "back.out(1.5)", glow: 0.22 };
  }
}

function RevealOverlay({
  info,
  tiered,
  speed,
  onDone,
}: {
  info: RevealInfo;
  tiered: boolean;
  speed: CeremonySpeed;
  onDone: (cardRect: DOMRect | null) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const tier = tierStyle(info.skillLevel, tiered);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    if (prefersReducedMotion()) {
      const t = setTimeout(() => onDone(null), 600);
      return () => clearTimeout(t);
    }

    const tl = gsap.timeline();

    // Entrance: scale up from wheel position with the tier's ease.
    tl.fromTo(
      el,
      { scale: 0.25, opacity: 0, y: 40 },
      { scale: 1, opacity: 1, y: 0, duration: scaled(dur.md, speed), ease: tier.entrance },
    )
      .to(el, { duration: scaled(1.8, speed) }) // hold
      .to(el, {
        scale: 0.8,
        opacity: 0,
        y: -24,
        duration: scaled(dur.sm, speed),
        ease: ease.in,
        onComplete() {
          // Fire fly-to-team with card position
          const cardRect = el.getBoundingClientRect();
          onDone(cardRect);
        },
      });

    return () => {
      tl.kill();
    };
  }, [onDone, speed, tier.entrance]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center">
      <div
        ref={cardRef}
        className="flex flex-col items-center gap-4 rounded-3xl px-16 py-12 text-center shadow-2xl backdrop-blur-md"
        style={{
          background: `linear-gradient(135deg, ${info.squadColor}22 0%, rgba(30,41,59,0.95) 100%)`,
          border: `2px solid ${tier.accent}66`,
          boxShadow: `0 0 80px ${tier.accent}${Math.round(tier.glow * 100)}, 0 20px 60px rgba(0,0,0,0.6)`,
        }}
      >
        <p
          className="font-mono text-sm font-bold uppercase tracking-[0.25em]"
          style={{ color: tier.accent }}
        >
          {tier.eyebrow}
        </p>
        <p className="text-6xl font-black text-white drop-shadow-lg">{info.playerName}</p>
        <div className="flex items-center gap-2">
          {info.skillLevel && (
            <span
              className="rounded-full px-3 py-1 text-sm font-bold"
              style={{ background: `${tier.accent}22`, color: tier.accent }}
            >
              {skillLabel(info.skillLevel)}
            </span>
          )}
          {info.divisionName && (
            <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white/60">
              {info.divisionName}
            </span>
          )}
        </div>
        <div
          className="mt-1 flex items-center gap-2 rounded-full px-6 py-2.5 text-base font-black text-white shadow-lg"
          style={{ backgroundColor: info.squadColor }}
        >
          <span>→ {info.squadName}</span>
        </div>
      </div>
    </div>
  );
}

// ── Squad roster sidebar ──────────────────────────────────────────────────────

interface RosterProps {
  squads: SquadView[];
  assignments: { registrationId: string; displayName: string; squadId: string }[];
  columnRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  flashSquadId: string | null;
}

function SquadRoster({ squads, assignments, columnRefs, flashSquadId }: RosterProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {squads.map((squad, i) => {
        const mine = assignments.filter((a) => a.squadId === squad.id);
        const total = squad.memberCount + mine.length;
        const color = squadAccent(i);
        const isComplete =
          total >= squad.memberCount + mine.length && mine.length > 0 && flashSquadId === squad.id;
        return (
          <div
            key={squad.id}
            ref={(el) => {
              if (el) columnRefs.current.set(squad.id, el);
            }}
            className="border-white/8 rounded-xl border p-3 transition-colors"
            style={{
              background: isComplete ? `${color}18` : "rgba(255,255,255,0.04)",
              borderColor: flashSquadId === squad.id ? `${color}55` : "rgba(255,255,255,0.08)",
            }}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-sm font-bold text-white">{squad.name}</span>
              <span className="ml-auto font-mono text-xs text-white/40">{total}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {squad.members.map((m) => (
                <span
                  key={m.registrationId}
                  className="bg-white/8 rounded-md px-2 py-0.5 text-xs text-white/55"
                >
                  {m.displayName}
                </span>
              ))}
              {mine.map((a) => (
                <NewMemberPill key={a.registrationId} name={a.displayName} color={color} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NewMemberPill({ name, color }: { name: string; color: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ref.current,
        { scale: 0.4, opacity: 0 },
        { scale: 1, opacity: 1, duration: dur.sm, ease: "back.out(2)" },
      );
    }, ref);
    return () => ctx.revert();
  }, []);
  return (
    <span
      ref={ref}
      className="rounded-md px-2 py-0.5 text-xs font-semibold text-white"
      style={{ backgroundColor: `${color}55` }}
    >
      {name}
    </span>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ total, remaining }: { total: number; remaining: number }) {
  const barRef = useRef<HTMLDivElement>(null);
  const pct = total > 0 ? ((total - remaining) / total) * 100 : 0;

  useEffect(() => {
    if (!barRef.current) return;
    gsap.to(barRef.current, {
      width: `${pct}%`,
      duration: dur.md,
      ease: ease.expo,
    });
  }, [pct]);

  return (
    <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/10">
      <div ref={barRef} className="h-full rounded-full bg-white/50" style={{ width: "0%" }} />
    </div>
  );
}

// ── Squad banner ──────────────────────────────────────────────────────────────

function SquadBanner({ squad, squadIndex }: { squad: SquadView | undefined; squadIndex: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const prevSquadId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!ref.current || !squad || prefersReducedMotion()) return;
    if (squad.id === prevSquadId.current) return;
    prevSquadId.current = squad.id;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ref.current,
        { x: -28, opacity: 0 },
        { x: 0, opacity: 1, duration: dur.sm, ease: ease.out },
      );
    }, ref);
    return () => ctx.revert();
  }, [squad]);

  if (!squad) return null;
  const color = squadAccent(squadIndex);

  return (
    <div
      ref={ref}
      className="flex items-center gap-2.5 rounded-full px-5 py-2 text-sm font-black text-white"
      style={{
        backgroundColor: `${color}22`,
        border: `1.5px solid ${color}55`,
        boxShadow: `0 0 24px ${color}22`,
      }}
    >
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
      />
      <span className="text-xs font-normal text-white/60">Now picking for</span>
      <span style={{ color }}>{squad.name}</span>
    </div>
  );
}

// ── Skill tabs ────────────────────────────────────────────────────────────────

function SkillTabs({
  skillGroups,
  resolvedSkill,
  onChangeSkill,
}: {
  skillGroups: (string | null)[];
  resolvedSkill: string | null;
  onChangeSkill: (s: string | null) => void;
}) {
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const inkRef = useRef<HTMLDivElement>(null);

  function moveInk(btn: HTMLButtonElement) {
    if (!inkRef.current || prefersReducedMotion()) return;
    const { offsetLeft, offsetWidth, offsetHeight } = btn;
    gsap.to(inkRef.current, {
      left: offsetLeft,
      width: offsetWidth,
      height: offsetHeight,
      duration: dur.xs,
      ease: ease.out,
    });
  }

  useEffect(() => {
    if (activeRef.current) moveInk(activeRef.current);
  });

  if (skillGroups.length <= 1) return null;

  return (
    <div className="relative flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
      <div
        ref={inkRef}
        className="pointer-events-none absolute rounded-full bg-white/15"
        style={{ top: 4 }}
      />
      {skillGroups.map((s) => {
        const active = resolvedSkill === s;
        return (
          <button
            key={s ?? "__null__"}
            ref={active ? activeRef : undefined}
            onClick={() => onChangeSkill(s)}
            className="relative z-10 rounded-full px-4 py-1.5 text-xs font-bold transition-colors"
            style={{ color: active ? "white" : "rgba(255,255,255,0.4)" }}
          >
            {skillLabel(s)}
          </button>
        );
      })}
    </div>
  );
}

// ── Spin button ───────────────────────────────────────────────────────────────

function SpinButton({
  phase,
  disabled,
  lastPlayer,
  onClick,
}: {
  phase: "idle" | "spinning" | "revealing";
  disabled: boolean;
  lastPlayer?: boolean;
  onClick: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const pulseRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    if (!btnRef.current || prefersReducedMotion()) return;
    if (phase === "idle" && !disabled) {
      pulseRef.current = gsap.to(btnRef.current, {
        boxShadow: "0 0 0 14px rgba(79,107,246,0)",
        duration: 1.4,
        ease: "power2.out",
        repeat: -1,
        yoyo: false,
      });
    } else {
      pulseRef.current?.kill();
      gsap.set(btnRef.current, { boxShadow: "none" });
    }
    return () => {
      pulseRef.current?.kill();
    };
  }, [phase, disabled]);

  const label =
    phase === "spinning"
      ? lastPlayer
        ? "Assigning…"
        : "Spinning…"
      : phase === "revealing"
        ? "Assigned!"
        : lastPlayer
          ? "✓  Assign last player"
          : "🎯  Spin";

  return (
    <button
      ref={btnRef}
      onClick={onClick}
      disabled={disabled}
      className="relative flex h-14 w-52 items-center justify-center rounded-full text-lg font-black text-white shadow-xl transition-all disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        background: disabled
          ? "rgba(255,255,255,0.12)"
          : "linear-gradient(135deg, #4f6bf6 0%, #9db0fb 100%)",
        boxShadow: disabled ? "none" : "0 8px 32px rgba(79,107,246,0.4)",
      }}
    >
      {label}
    </button>
  );
}

// ── Intro screen ──────────────────────────────────────────────────────────────

function IntroScreen({
  squads,
  totalUnassigned,
  onStart,
}: {
  squads: SquadView[];
  totalUnassigned: number;
  onStart: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".intro-item",
        { y: 36, opacity: 0 },
        { y: 0, opacity: 1, duration: dur.md, ease: ease.out, stagger: stagger.md },
      );
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
      {/* Ambient spotlight */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(79,107,246,0.12) 0%, transparent 70%)",
        }}
      />

      <div ref={containerRef} className="relative z-10 flex flex-col items-center gap-7">
        <div
          className="intro-item flex h-24 w-24 items-center justify-center rounded-3xl text-5xl shadow-2xl"
          style={{ background: "rgba(79,107,246,0.2)", border: "1px solid rgba(79,107,246,0.4)" }}
        >
          🎯
        </div>
        <div className="intro-item">
          <h1 className="font-serif text-6xl font-black tracking-tight text-white">
            Draft Ceremony
          </h1>
          <p className="mt-3 text-lg text-white/50">
            {totalUnassigned} players · {squads.length} teams
          </p>
        </div>

        <div className="intro-item flex flex-wrap justify-center gap-2">
          {squads.map((s, i) => (
            <span
              key={s.id}
              className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-white"
              style={{
                backgroundColor: `${squadAccent(i)}22`,
                border: `1px solid ${squadAccent(i)}44`,
              }}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: squadAccent(i) }} />
              {s.name}
            </span>
          ))}
        </div>

        <button
          onClick={onStart}
          className="intro-item mt-2 flex h-14 items-center gap-3 rounded-full px-10 text-lg font-black text-white shadow-2xl transition-transform hover:scale-[1.03] active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #4f6bf6 0%, #9db0fb 100%)",
            boxShadow: "0 12px 40px rgba(79,107,246,0.45)",
          }}
        >
          Begin Draft
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

// ── Completion screen ─────────────────────────────────────────────────────────

function CompletionScreen({
  tournamentId,
  squads,
  sessionAssignments,
}: {
  tournamentId: string;
  squads: SquadView[];
  sessionAssignments: { registrationId: string; displayName: string; squadId: string }[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      if (!prefersReducedMotion()) {
        gsap.fromTo(
          ".complete-item",
          { y: 40, opacity: 0, scale: 0.92 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: dur.md,
            ease: "back.out(1.3)",
            stagger: stagger.md,
          },
        );
        // Sequential team card reveals
        gsap.fromTo(
          ".team-result-card",
          { opacity: 0, y: 24, scale: 0.94 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: dur.md,
            ease: ease.out,
            stagger: stagger.lg,
            delay: 0.4,
          },
        );
      }
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <>
      <ReactConfetti
        className="pointer-events-none fixed inset-0 z-[55]"
        colors={CONFETTI_COLORS}
        numberOfPieces={200}
        recycle={false}
        gravity={0.16}
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-8 overflow-y-auto px-6 py-10">
        <div ref={containerRef} className="flex w-full max-w-2xl flex-col items-center gap-6">
          <div
            className="complete-item flex h-24 w-24 items-center justify-center rounded-3xl text-5xl shadow-2xl"
            style={{
              background: "rgba(251,191,36,0.15)",
              border: "1px solid rgba(251,191,36,0.35)",
            }}
          >
            🏆
          </div>

          <div className="complete-item text-center">
            <h1 className="font-serif text-5xl font-black tracking-tight text-white">
              Draft Complete!
            </h1>
            <p className="mt-2 text-white/50">All players assigned to their teams</p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2">
            {squads.map((squad, i) => {
              const newOnes = sessionAssignments.filter((a) => a.squadId === squad.id);
              const total = squad.memberCount + newOnes.length;
              const color = squadAccent(i);
              return (
                <div
                  key={squad.id}
                  className="team-result-card rounded-2xl p-4"
                  style={{
                    background: `${color}0f`,
                    border: `1px solid ${color}30`,
                  }}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-bold text-white">{squad.name}</span>
                    <span className="ml-auto font-mono text-sm text-white/40">{total} players</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {squad.members.map((m) => (
                      <span
                        key={m.registrationId}
                        className="bg-white/8 rounded-md px-2 py-0.5 text-xs text-white/55"
                      >
                        {m.displayName}
                      </span>
                    ))}
                    {newOnes.map((a) => (
                      <span
                        key={a.registrationId}
                        className="rounded-md px-2 py-0.5 text-xs font-semibold text-white"
                        style={{ backgroundColor: `${color}44` }}
                      >
                        {a.displayName}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="complete-item flex gap-3">
            <Link
              href={`/console/tournaments/${tournamentId}/teams`}
              className="flex h-10 items-center rounded-full border border-white/20 px-6 text-sm font-bold text-white/60 transition-colors hover:text-white"
            >
              Back to Teams
            </Link>
            <Link
              href={`/console/tournaments/${tournamentId}/draws`}
              className="flex h-10 items-center gap-2 rounded-full px-6 text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #4f6bf6 0%, #9db0fb 100%)" }}
            >
              <Trophy className="h-4 w-4" />
              Continue to Draws
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Team power-card inventory ─────────────────────────────────────────────────

function TeamCardsPanel({
  squads,
  teamCards,
  swapFromId,
  onCardClick,
  onTargetTeam,
}: {
  squads: SquadView[];
  teamCards: Record<string, PowerKind[]>;
  swapFromId: string | null;
  onCardClick: (squadId: string, kind: PowerKind) => void;
  onTargetTeam: (squadId: string) => void;
}) {
  const anyCards = squads.some((s) => (teamCards[s.id] ?? []).length > 0);
  if (!anyCards && !swapFromId) return null;

  return (
    <div className="mb-4 flex flex-col gap-1.5">
      <p className="text-2xs mb-1 font-mono font-bold uppercase tracking-widest text-[#fbbf24]/70">
        Power Cards
      </p>
      {squads.map((s, i) => {
        const hand = teamCards[s.id] ?? [];
        const color = squadAccent(i);
        const targetable = !!swapFromId && swapFromId !== s.id;
        return (
          <div
            key={s.id}
            onClick={() => targetable && onTargetTeam(s.id)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors"
            style={{
              background: targetable ? "rgba(219,39,119,0.18)" : "rgba(255,255,255,0.03)",
              border: targetable ? "1px solid #db2777" : "1px solid transparent",
              cursor: targetable ? "pointer" : "default",
            }}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span className="truncate text-xs font-semibold text-white/70">{s.name}</span>
            <div className="ml-auto flex items-center gap-1">
              {hand.length === 0 ? (
                <span className="text-2xs text-white/20">no cards</span>
              ) : (
                hand.map((k, idx) => {
                  const mode = getCard(k).mode;
                  // Instant (Meme) + targeted (Swap) play from the inventory; self
                  // (First Ball Trial) plays from its own on-turn button; passive
                  // (Immunity) is not clickable.
                  const playable = mode === "instant" || mode === "targeted";
                  const armed = swapFromId === s.id && mode === "targeted";
                  return (
                    <button
                      key={`${k}-${idx}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (playable) onCardClick(s.id, k);
                      }}
                      title={`${getCard(k).label}${playable ? " — click to play" : " (passive)"}`}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-sm transition-transform hover:scale-110"
                      style={{
                        background: `${getCard(k).color}22`,
                        border: armed ? `1.5px solid ${getCard(k).color}` : "1px solid transparent",
                        cursor: playable ? "pointer" : "default",
                      }}
                    >
                      {getCard(k).emoji}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
      {swapFromId && (
        <p className="text-2xs mt-1 font-semibold text-[#f472b6]">← Pick a team to raid</p>
      )}
    </div>
  );
}

// ── Main ceremony screen ──────────────────────────────────────────────────────

type SpinPhase = "idle" | "spinning" | "revealing";

function MainScreen({
  squads,
  pool,
  skillGroups,
  resolvedSkill,
  totalRemaining,
  totalPlayers,
  isAssigning,
  history,
  currentSquad,
  settings,
  powersEnabled,
  teamCards,
  onAwardCard,
  onPlayCard,
  justCompletedSquadId,
  onClearCompleted,
  isWildcardActive,
  onAssign,
  onUndo,
  onChangeSkill,
}: {
  squads: SquadView[];
  pool: UnassignedRegistrationView[];
  skillGroups: (string | null)[];
  resolvedSkill: string | null;
  totalRemaining: number;
  totalPlayers: number;
  isAssigning: boolean;
  history: { registrationId: string; displayName: string; squadId: string }[];
  currentSquad: SquadView | undefined;
  settings: CeremonySettings;
  powersEnabled: boolean;
  teamCards: Record<string, PowerKind[]>;
  onAwardCard: (squadId: string, cardId: PowerKind) => EnginePowerEvent[];
  onPlayCard: (
    cardId: PowerKind,
    squadId: string,
    targetSquadId?: string,
  ) => Promise<EnginePowerEvent[]>;
  justCompletedSquadId: string | null;
  onClearCompleted: () => void;
  isWildcardActive: boolean;
  onAssign: (
    player: UnassignedRegistrationView,
    squadId?: string,
  ) => Promise<
    import("@/features/squads/components/draft-ceremony/use-ceremony").Assignment | null
  >;
  onUndo: () => void;
  onChangeSkill: (skill: string | null) => void;
}) {
  const wheelRef = useRef<WheelHandle>(null);
  const wheelWrapRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const [spinPhase, setSpinPhase] = useState<SpinPhase>("idle");
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [revealInfo, setRevealInfo] = useState<RevealInfo | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  const [flashSquadId, setFlashSquadId] = useState<string | null>(null);
  const [countdownActive, setCountdownActive] = useState(false);
  // Active power being resolved on the wheel (drives the PowerOverlay).
  const [powerEvent, setPowerEvent] = useState<PowerEvent | null>(null);
  // Team currently playing a Swap card — armed to pick a target team.
  const [swapFromId, setSwapFromId] = useState<string | null>(null);
  const [ghostFly, setGhostFly] = useState<{
    name: string;
    color: string;
    fromRect: DOMRect;
    toRect: DOMRect;
  } | null>(null);

  const currentSquadIdx = squads.findIndex((s) => s.id === currentSquad?.id);
  const canSpin =
    spinPhase === "idle" && pool.length > 0 && !isAssigning && !countdownActive && !powerEvent;
  const poolEmpty = pool.length === 0 && totalRemaining > 0;

  // Organizer sets exactly how many power slots each skill-level wheel gets.
  const powerCount = powersEnabled
    ? (settings.powerSlotsBySkill[skillKeyOf(resolvedSkill)] ?? 0)
    : 0;

  // The wheel slots are built ONCE per skill group and then held FIXED: power slots
  // stay put across spins, and only the picked player (and a landed power) are
  // removed. This is what makes powers land reliably and stop reshuffling every
  // spin. We rebuild only when the skill group changes or when data first arrives.
  const [wheelSlots, setWheelSlots] = useState<WheelSlot[]>([]);
  const builtForSkillRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const needsRebuild = builtForSkillRef.current !== resolvedSkill || wheelSlots.length === 0;
    if (!needsRebuild || pool.length === 0) return;
    setWheelSlots(buildWheelSlots(pool, powerCount));
    builtForSkillRef.current = resolvedSkill;
    // Guarded by the ref + length check so `pool` identity churn does NOT rebuild
    // (which would reshuffle the powers). Player removal is done in runSpin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSkill, pool, powerCount]);

  // Organizer shortcut: Space bar spins (so the ceremony can be driven hands-free
  // from across the room). Ignored while typing in an input.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.code === "Space" && canSpin) {
        e.preventDefault();
        handleSpin();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // handleSpin closes over current render values; re-bind when spinnability changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSpin, isWildcardActive, settings.funMode, settings.onTheClock, currentSquad?.id]);

  /** Entry point for the Spin button — gate behind the 3·2·1 countdown. */
  function handleSpin() {
    if (!canSpin || !currentSquad) return;
    // Last player left → no spin/countdown; runSpin auto-assigns them.
    const lastPlayer = pool.length <= 1;
    // Wildcard Finish: the last picks fire rapidly, no countdown, for a crescendo.
    if (settings.funMode && settings.onTheClock && !isWildcardActive && !lastPlayer) {
      setCountdownActive(true); // countdown's onDone triggers runSpin
    } else {
      void runSpin();
    }
  }

  /**
   * One turn. The wheel may land on a rare power slot first — if so, the power
   * resolves (a few seconds) and the wheel auto-re-spins to a real player. The
   * team still receives exactly one player, so balance is never affected. The
   * player is only committed at the end.
   */
  async function runSpin() {
    if (!wheelRef.current || !currentSquad) return;
    const slots = wheelSlots;
    const playerIdxs = slots.reduce<number[]>((acc, s, i) => {
      if (isPlayerSlot(s)) acc.push(i);
      return acc;
    }, []);
    if (playerIdxs.length === 0) {
      setSpinPhase("idle");
      return;
    }

    setSpinPhase("spinning");
    setHighlightIndex(null);

    let target: number;
    let landedPowerId: string | null = null;

    if (playerIdxs.length === 1) {
      // Last player left on the wheel — no point spinning; we already know they go
      // to the team on the clock. Assign directly (skip the wheel + any powers).
      target = playerIdxs[0]!;
    } else {
      // First spin: land anywhere (players + powers).
      target = Math.floor(Math.random() * slots.length);
      await wheelRef.current.spin(target);

      const landed = slots[target];
      if (landed && landed.type === "power") {
        // Landing AWARDS the card to the team on the clock — it does not fire now.
        landedPowerId = landed.id;
        setHighlightIndex(target);
        onAwardCard(currentSquad.id, landed.power);
        const meta = getCard(landed.power);
        setPowerEvent({
          kind: landed.power,
          detail: `${currentSquad.name} drew ${meta.emoji} ${meta.label}`,
        });
        await wait(scaled(1.7, settings.speed) * 1000);
        setPowerEvent(null);

        // Auto re-spin to a real player — the team's pick is unaffected.
        setHighlightIndex(null);
        target = playerIdxs[Math.floor(Math.random() * playerIdxs.length)]!;
        await wheelRef.current.spin(target);
      }
    }

    const playerSlot = slots[target];
    if (!playerSlot || playerSlot.type !== "player") {
      setSpinPhase("idle");
      return;
    }
    const player = playerSlot.player;

    const result = await onAssign(player);
    if (!result) {
      setSpinPhase("idle");
      return;
    }

    // Keep the wheel FIXED: drop only the picked player and the power that was just
    // collected. Everything else stays exactly where it is.
    setWheelSlots((prev) =>
      prev.filter((s) => {
        if (s.type === "player" && s.id === player.registrationId) return false;
        if (landedPowerId && s.type === "power" && s.id === landedPowerId) return false;
        return true;
      }),
    );

    setBurstKey((k) => k + 1);
    playFanfare();
    setHighlightIndex(target);

    // Capture wheel center rect for reveal/fly
    const wheelRect = wheelWrapRef.current?.getBoundingClientRect() ?? null;

    setRevealInfo({
      playerName: result.displayName,
      skillLevel: result.skillLevel,
      divisionName: player.divisionName,
      squadName: result.squadName,
      squadColor: squadAccent(squads.findIndex((s) => s.id === result.squadId)),
      wheelRect,
    });
    setSpinPhase("revealing");

    // Flash team column
    setFlashSquadId(result.squadId);
    setTimeout(() => setFlashSquadId(null), 2000);
  }

  function handleRevealDone(cardRect: DOMRect | null) {
    // Launch fly-to-team ghost
    if (cardRect && revealInfo) {
      const squadId = squads.find((s) => s.name === revealInfo.squadName)?.id;
      const targetEl = squadId ? columnRefs.current.get(squadId) : null;
      if (targetEl && !prefersReducedMotion()) {
        const toRect = targetEl.getBoundingClientRect();
        setGhostFly({
          name: revealInfo.playerName,
          color: revealInfo.squadColor,
          fromRect: cardRect,
          toRect,
        });
      }
    }
    setRevealInfo(null);
    setHighlightIndex(null);
    setSpinPhase("idle");
  }

  const handleGhostDone = useCallback(() => setGhostFly(null), []);

  /**
   * Map engine domain events to the on-screen power overlay, hold, then clear.
   * The presentation reacts to events; it never re-derives card rules.
   */
  async function showPowerEvents(events: EnginePowerEvent[]) {
    const played = events.find((e) => e.type === "CardPlayed");
    const swapDone = events.find((e) => e.type === "SwapCompleted");
    const blocked = events.find((e) => e.type === "SwapBlocked");

    let display: PowerEvent | null = null;
    if (played) {
      display = { kind: played.cardId, detail: played.detail, meme: played.meme };
    } else if (swapDone) {
      display = { kind: swapDone.cardId, detail: `${swapDone.aName}  ⇄  ${swapDone.bName}` };
    } else if (blocked) {
      display = {
        kind: blocked.cardId,
        detail:
          blocked.reason === "immunity"
            ? `🛡️ Blocked by ${blocked.toSquad}'s Dabur Immunity!`
            : "No eligible players to swap",
      };
    }
    if (!display) return;

    setPowerEvent(display);
    await wait(scaled(1.9, settings.speed) * 1000);
    setPowerEvent(null);
  }

  // Play a card from a team's hand — dispatched by the card's mode (no card ids
  // hardcoded here). Instant plays immediately; targeted arms target-picking.
  async function onCardClick(squadId: string, kind: PowerKind) {
    const mode = getCard(kind).mode;
    if (mode === "targeted") {
      setSwapFromId((prev) => (prev === squadId ? null : squadId));
      return;
    }
    if (mode === "instant") {
      const events = await onPlayCard(kind, squadId);
      await showPowerEvents(events);
    }
    // self plays from its own on-turn button; passive is not clickable.
  }

  // Execute the armed swap onto the chosen target team, via the engine.
  async function onTargetTeam(targetId: string) {
    const from = swapFromId;
    setSwapFromId(null);
    if (!from || from === targetId) return;

    setPowerEvent({ kind: "swap", detail: "Finding a fair swap…" });
    const events = await onPlayCard("swap", from, targetId);
    await showPowerEvents(events);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Progress + skill tabs header */}
      <div className="border-white/8 flex items-center gap-4 border-b px-6 py-3">
        <SkillTabs
          skillGroups={skillGroups}
          resolvedSkill={resolvedSkill}
          onChangeSkill={(s) => {
            onChangeSkill(s);
            setSpinPhase("idle");
            setHighlightIndex(null);
          }}
        />
        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono text-xs text-white/35">{totalRemaining} remaining</span>
          <div className="w-28">
            <ProgressBar total={totalPlayers} remaining={totalRemaining} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Wheel area */}
        <div className="relative flex flex-1 flex-col items-center justify-center gap-5 p-6">
          {/* Ambient glow behind wheel */}
          <div
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              background: `radial-gradient(ellipse 55% 55% at 50% 50%, rgba(79,107,246,0.07) 0%, transparent 70%)`,
            }}
          />

          {settings.funMode && isWildcardActive && spinPhase !== "revealing" && (
            <div className="flex items-center gap-2 rounded-full border border-[#fbbf24]/50 bg-[#fbbf24]/15 px-5 py-2 text-sm font-black uppercase tracking-wider text-[#fbbf24]">
              <Sparkles className="h-4 w-4" />
              Wildcard Finish
            </div>
          )}

          {currentSquad && spinPhase !== "revealing" && (
            <SquadBanner squad={currentSquad} squadIndex={currentSquadIdx} />
          )}

          <WinnerBurst burstKey={burstKey} />

          {poolEmpty ? (
            <div className="text-center">
              <p className="text-lg font-bold text-white">
                All {skillLabel(resolvedSkill)} players assigned
              </p>
              <p className="mt-1 text-sm text-white/40">Switch skill group or you&apos;re done!</p>
            </div>
          ) : (
            <>
              <div ref={wheelWrapRef} className="relative z-10">
                <CeremonyWheel
                  ref={wheelRef}
                  slots={wheelSlots}
                  highlightIndex={highlightIndex}
                  reducedMotion={prefersReducedMotion()}
                />
              </div>

              <div className="relative z-10 flex flex-col items-center gap-2">
                <SpinButton
                  phase={spinPhase}
                  disabled={!canSpin}
                  lastPlayer={pool.length === 1}
                  onClick={handleSpin}
                />

                {/* Power slots present on the wheel — tease the room. */}
                {powersEnabled && powerCount > 0 && spinPhase === "idle" && (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[#fbbf24]">
                    <Sparkles className="h-3.5 w-3.5" />
                    {powerCount} power {powerCount === 1 ? "slot" : "slots"} on this wheel
                  </span>
                )}

                {/* Self-mode cards (e.g. First Ball Trial) play on this team's own
                    spin — rendered generically from any held card whose mode is
                    "self", then the wheel re-spins. No card id is hardcoded. */}
                {currentSquad &&
                  spinPhase === "idle" &&
                  (teamCards[currentSquad.id] ?? [])
                    .filter((id) => getCard(id).mode === "self")
                    .map((id) => {
                      const card = getCard(id);
                      return (
                        <button
                          key={id}
                          onClick={() => {
                            void onPlayCard(id, currentSquad.id).then(() => runSpin());
                          }}
                          className="flex items-center gap-1.5 rounded-full border border-[#4f6bf6]/50 bg-[#4f6bf6]/15 px-4 py-1.5 text-xs font-black text-[#9db0fb] transition-transform hover:scale-105"
                        >
                          {card.emoji} Use {card.label} (re-spin)
                        </button>
                      );
                    })}

                {canSpin && (
                  <span className="text-2xs font-mono uppercase tracking-widest text-white/25">
                    Press Space to spin
                  </span>
                )}

                {history.length > 0 && spinPhase === "idle" && (
                  <button
                    onClick={onUndo}
                    className="flex items-center gap-1.5 text-xs text-white/30 transition-colors hover:text-white/60"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Undo last pick
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Team roster sidebar */}
        <aside
          className="border-white/8 hidden w-72 shrink-0 overflow-y-auto border-l p-4 lg:block"
          style={{ background: BG_SIDEBAR }}
        >
          {settings.funMode && settings.powerSlots && (
            <TeamCardsPanel
              squads={squads}
              teamCards={teamCards}
              swapFromId={swapFromId}
              onCardClick={onCardClick}
              onTargetTeam={onTargetTeam}
            />
          )}
          <p className="text-2xs mb-3 font-mono font-bold uppercase tracking-widest text-white/30">
            Teams
          </p>
          <SquadRoster
            squads={squads}
            assignments={history}
            columnRefs={columnRefs}
            flashSquadId={flashSquadId}
          />
        </aside>
      </div>

      {/* Overlays */}
      {countdownActive && (
        <CountdownOverlay
          speed={settings.speed}
          onDone={() => {
            setCountdownActive(false);
            void runSpin();
          }}
        />
      )}
      {powerEvent && <PowerOverlay event={powerEvent} />}
      {revealInfo && (
        <RevealOverlay
          info={revealInfo}
          tiered={settings.funMode && settings.tieredReveals}
          speed={settings.speed}
          onDone={handleRevealDone}
        />
      )}
      {settings.funMode &&
        justCompletedSquadId &&
        spinPhase === "idle" &&
        !revealInfo &&
        (() => {
          const idx = squads.findIndex((s) => s.id === justCompletedSquadId);
          const squad = squads[idx];
          if (!squad) return null;
          return (
            <TeamCompleteOverlay
              squad={squad}
              squadIndex={idx}
              sessionMembers={history}
              speed={settings.speed}
              onDone={onClearCompleted}
            />
          );
        })()}
      {ghostFly && (
        <GhostFly
          name={ghostFly.name}
          color={ghostFly.color}
          fromRect={ghostFly.fromRect}
          toRect={ghostFly.toRect}
          onDone={handleGhostDone}
        />
      )}
    </div>
  );
}

// ── Fun Mode settings panel ───────────────────────────────────────────────────

const SPEED_LABELS: Record<CeremonySpeed, string> = {
  relaxed: "Relaxed",
  normal: "Normal",
  fast: "Fast",
};

function SettingToggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/5 disabled:opacity-40"
    >
      <span
        className="relative h-5 w-9 shrink-0 rounded-full transition-colors"
        style={{ background: checked ? "#4f6bf6" : "rgba(255,255,255,0.15)" }}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
          style={{ left: checked ? "1.125rem" : "0.125rem" }}
        />
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-semibold text-white">{label}</span>
        {hint && <span className="text-xs text-white/40">{hint}</span>}
      </span>
    </button>
  );
}

function SettingsPanel({
  settings,
  onUpdate,
  onClose,
}: {
  settings: CeremonySettings;
  onUpdate: (patch: Partial<CeremonySettings>) => void;
  onClose: () => void;
}) {
  const fun = settings.funMode;
  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-white/10 bg-[#28324a] p-3 shadow-2xl">
      <div className="mb-2 flex items-center gap-2 px-2 pt-1">
        <Sparkles className="h-4 w-4 text-[#fbbf24]" />
        <span className="text-sm font-bold text-white">Fun Draft Mode</span>
        <button
          onClick={onClose}
          className="ml-auto text-xs text-white/40 transition-colors hover:text-white"
        >
          Done
        </button>
      </div>

      <SettingToggle
        label="Fun Mode"
        hint="Off = standard Balanced Draft"
        checked={fun}
        onChange={(v) => onUpdate({ funMode: v })}
      />

      <div className="bg-white/8 my-2 h-px" />

      <SettingToggle
        label="Team introductions"
        hint="Captain walk-in before the draft"
        checked={settings.teamIntroductions}
        disabled={!fun}
        onChange={(v) => onUpdate({ teamIntroductions: v })}
      />
      <SettingToggle
        label="On the clock"
        hint="3·2·1 countdown before each spin"
        checked={settings.onTheClock}
        disabled={!fun}
        onChange={(v) => onUpdate({ onTheClock: v })}
      />
      <SettingToggle
        label="Tiered reveals"
        hint="Different animation per skill tier"
        checked={settings.tieredReveals}
        disabled={!fun}
        onChange={(v) => onUpdate({ tieredReveals: v })}
      />
      <SettingToggle
        label="Power slots"
        hint="Rare surprise powers on the wheel"
        checked={settings.powerSlots}
        disabled={!fun}
        onChange={(v) => onUpdate({ powerSlots: v })}
      />

      {/* Power slots per skill-level wheel — organizer sets exact counts. */}
      {fun && settings.powerSlots && (
        <div className="ml-4 border-l border-white/10 pl-2">
          <p className="px-3 pb-1 pt-2 text-xs font-semibold text-white/50">
            Power slots per wheel
          </p>
          {SKILL_KEYS.map((sk) => (
            <div key={sk} className="flex items-center gap-3 px-3 py-1.5">
              <span className="text-sm font-semibold capitalize text-white">
                {sk === "unknown" ? "No level" : sk}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() =>
                    onUpdate({
                      powerSlotsBySkill: {
                        ...settings.powerSlotsBySkill,
                        [sk]: Math.max(0, (settings.powerSlotsBySkill[sk] ?? 0) - 1),
                      },
                    })
                  }
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                >
                  −
                </button>
                <span className="w-4 text-center font-mono text-sm font-bold text-white">
                  {settings.powerSlotsBySkill[sk] ?? 0}
                </span>
                <button
                  onClick={() =>
                    onUpdate({
                      powerSlotsBySkill: {
                        ...settings.powerSlotsBySkill,
                        [sk]: Math.min(10, (settings.powerSlotsBySkill[sk] ?? 0) + 1),
                      },
                    })
                  }
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                >
                  +
                </button>
              </div>
            </div>
          ))}
          <p className="px-3 pb-1 pt-1 text-xs text-white/35">
            Cards: 🎯 First Ball Trial · 😂 Meme Drop · 🛡️ Dabur Immunity · 🔄 Jo Tera Hai Wo Mera
          </p>
        </div>
      )}

      <SettingToggle
        label="Wildcard finish"
        hint="Final 3 picks revealed together"
        checked={settings.wildcardFinish}
        disabled={!fun}
        onChange={(v) => onUpdate({ wildcardFinish: v })}
      />

      <div className="bg-white/8 my-2 h-px" />

      <div className="px-2 py-1">
        <p className="mb-2 text-xs font-semibold text-white/50">Animation speed</p>
        <div className="flex gap-1 rounded-full border border-white/10 bg-white/5 p-1">
          {(Object.keys(SPEED_LABELS) as CeremonySpeed[]).map((s) => (
            <button
              key={s}
              onClick={() => onUpdate({ speed: s })}
              className="flex-1 rounded-full px-3 py-1.5 text-xs font-bold transition-colors"
              style={{
                background: settings.speed === s ? "rgba(255,255,255,0.15)" : "transparent",
                color: settings.speed === s ? "white" : "rgba(255,255,255,0.4)",
              }}
            >
              {SPEED_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Team introductions (Fun Mode walk-in) ─────────────────────────────────────

function IntrosScreen({
  squads,
  captainBySquad,
  speed,
  onDone,
}: {
  squads: SquadView[];
  captainBySquad: Map<string, SquadMemberView | null>;
  speed: CeremonySpeed;
  onDone: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".intro-team",
        { y: 48, opacity: 0, scale: 0.9 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: scaled(dur.md, speed),
          ease: "back.out(1.4)",
          stagger: scaled(stagger.lg, speed),
        },
      );
    }, containerRef);
    return () => ctx.revert();
  }, [speed]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-10 text-center">
      <div>
        <p className="font-mono text-sm font-bold uppercase tracking-[0.3em] text-[#fbbf24]">
          Introducing
        </p>
        <h1 className="mt-3 font-serif text-6xl font-black tracking-tight text-white">The Teams</h1>
      </div>

      <div
        ref={containerRef}
        className="grid w-full max-w-4xl grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4"
      >
        {squads.map((squad, i) => {
          const color = squadAccent(i);
          const captain = captainBySquad.get(squad.id);
          return (
            <div
              key={squad.id}
              className="intro-team flex flex-col items-center gap-3 rounded-3xl p-6"
              style={{
                background: `linear-gradient(160deg, ${color}22 0%, rgba(255,255,255,0.03) 100%)`,
                border: `1.5px solid ${color}44`,
              }}
            >
              <span
                className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-black text-white"
                style={{ backgroundColor: color }}
              >
                {squad.name.charAt(0).toUpperCase()}
              </span>
              <span className="text-lg font-black text-white">{squad.name}</span>
              <span className="text-sm text-white/50">
                {captain ? (
                  <>
                    <span className="text-white/30">Captain</span> {captain.displayName}
                  </>
                ) : (
                  "Awaiting captain"
                )}
              </span>
            </div>
          );
        })}
      </div>

      <button
        onClick={onDone}
        className="flex h-14 items-center gap-3 rounded-full px-10 text-lg font-black text-white shadow-2xl transition-transform hover:scale-[1.03] active:scale-[0.98]"
        style={{
          background: "linear-gradient(135deg, #4f6bf6 0%, #9db0fb 100%)",
          boxShadow: "0 12px 40px rgba(79,107,246,0.45)",
        }}
      >
        Start the Draft
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

// ── Countdown overlay (3·2·1 before spin) ─────────────────────────────────────

function CountdownOverlay({ speed, onDone }: { speed: CeremonySpeed; onDone: () => void }) {
  const [n, setN] = useState(3);
  const numRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      onDone();
      return;
    }
    const step = Math.max(300, scaled(650, speed)); // ms per number
    const t1 = setTimeout(() => setN(2), step);
    const t2 = setTimeout(() => setN(1), step * 2);
    const t3 = setTimeout(() => onDone(), step * 3);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [speed, onDone]);

  useEffect(() => {
    if (!numRef.current || prefersReducedMotion()) return;
    gsap.fromTo(
      numRef.current,
      { scale: 0.4, opacity: 0 },
      { scale: 1, opacity: 1, duration: scaled(0.28, speed), ease: "back.out(2)" },
    );
  }, [n, speed]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[58] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        ref={numRef}
        className="font-serif text-[14rem] font-black leading-none text-white drop-shadow-2xl"
      >
        {n}
      </div>
    </div>
  );
}

// ── Team completion celebration ───────────────────────────────────────────────

function TeamCompleteOverlay({
  squad,
  squadIndex,
  sessionMembers,
  speed,
  onDone,
}: {
  squad: SquadView;
  squadIndex: number;
  sessionMembers: { registrationId: string; displayName: string; squadId: string }[];
  speed: CeremonySpeed;
  onDone: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const color = squadAccent(squadIndex);
  const drafted = sessionMembers.filter((a) => a.squadId === squad.id);

  useEffect(() => {
    const hold = Math.max(1600, scaled(2400, speed));
    const el = cardRef.current;
    if (el && !prefersReducedMotion()) {
      gsap.fromTo(
        el,
        { scale: 0.7, opacity: 0, y: 30 },
        { scale: 1, opacity: 1, y: 0, duration: scaled(dur.md, speed), ease: "back.out(1.5)" },
      );
    }
    const t = setTimeout(onDone, hold);
    return () => clearTimeout(t);
  }, [speed, onDone]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[62] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <ReactConfetti
        className="pointer-events-none fixed inset-0"
        colors={[color, "#fffdf5", CONFETTI_COLORS[0]!]}
        numberOfPieces={180}
        recycle={false}
        gravity={0.22}
      />
      <div
        ref={cardRef}
        className="flex flex-col items-center gap-5 rounded-[2rem] px-16 py-12 text-center"
        style={{
          background: `linear-gradient(160deg, ${color}33 0%, rgba(30,41,59,0.97) 100%)`,
          border: `2px solid ${color}66`,
          boxShadow: `0 0 90px ${color}44, 0 24px 70px rgba(0,0,0,0.65)`,
        }}
      >
        <p className="font-mono text-sm font-bold uppercase tracking-[0.3em]" style={{ color }}>
          Team Complete
        </p>
        <p className="text-6xl font-black text-white drop-shadow-lg">{squad.name}</p>
        <div className="flex max-w-xl flex-wrap justify-center gap-2">
          {squad.members.map((m) => (
            <span
              key={m.registrationId}
              className="rounded-lg bg-white/10 px-3 py-1 text-sm font-semibold text-white/70"
            >
              {m.displayName}
            </span>
          ))}
          {drafted.map((a) => (
            <span
              key={a.registrationId}
              className="rounded-lg px-3 py-1 text-sm font-bold text-white"
              style={{ backgroundColor: `${color}66` }}
            >
              {a.displayName}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Power slot resolve overlay ────────────────────────────────────────────────

function PowerOverlay({ event }: { event: PowerEvent }) {
  const ref = useRef<HTMLDivElement>(null);
  const meta = getCard(event.kind);

  useEffect(() => {
    if (!ref.current || prefersReducedMotion()) return;
    gsap.fromTo(
      ref.current,
      { scale: 0.4, opacity: 0, rotate: -6 },
      { scale: 1, opacity: 1, rotate: 0, duration: 0.4, ease: "back.out(2)" },
    );
  }, [event]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[59] flex items-center justify-center bg-black/45 backdrop-blur-sm">
      <div
        ref={ref}
        className="flex flex-col items-center gap-4 rounded-[2rem] px-16 py-12 text-center"
        style={{
          background: `linear-gradient(160deg, ${meta.color}33 0%, rgba(30,41,59,0.97) 100%)`,
          border: `2px solid ${meta.color}88`,
          boxShadow: `0 0 90px ${meta.color}55, 0 24px 70px rgba(0,0,0,0.6)`,
        }}
      >
        <span className="text-8xl drop-shadow-lg">{meta.emoji}</span>
        <p
          className="font-mono text-sm font-black uppercase tracking-[0.28em]"
          style={{ color: meta.color }}
        >
          Power Card
        </p>
        <p className="text-5xl font-black text-white">{meta.title}</p>
        {event.meme && (
          <p className="text-xl font-bold text-white/80">
            {event.meme.emoji} {event.meme.caption}
          </p>
        )}
        <p className="text-xl font-bold text-white/85">{event.detail}</p>
      </div>
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────

export function DraftCeremonyShell({ tournamentId }: { tournamentId: string }) {
  const ceremony = useCeremony(tournamentId);
  const shellRef = useRef<HTMLDivElement>(null);
  const prevPhase = useRef<string>("intro");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Phase transition: cross-fade between screens
  useEffect(() => {
    if (!shellRef.current || prefersReducedMotion()) return;
    if (ceremony.phase !== prevPhase.current) {
      prevPhase.current = ceremony.phase;
      gsap.fromTo(
        shellRef.current,
        { opacity: 0 },
        { opacity: 1, duration: dur.sm, ease: ease.out },
      );
    }
  }, [ceremony.phase]);

  // Total players count (unassigned at start + already assigned)
  const totalPlayers =
    ceremony.squads.reduce((s, sq) => s + sq.memberCount, 0) +
    ceremony.totalRemaining +
    ceremony.history.length;

  if (ceremony.isLoading) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: BG }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-white/70" />
          <p className="font-mono text-xs uppercase tracking-widest text-white/40">Loading…</p>
        </div>
      </div>
    );
  }

  if (ceremony.isError) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: BG }}
      >
        <p className="text-white/50">Failed to load ceremony data.</p>
      </div>
    );
  }

  return (
    <div ref={shellRef} className="fixed inset-0 z-50 flex flex-col" style={{ background: BG }}>
      {/* Nav bar */}
      <nav className="border-white/8 flex items-center gap-3 border-b px-4 py-3">
        <Link
          href={`/console/tournaments/${tournamentId}/teams`}
          className="flex items-center gap-1.5 text-sm text-white/40 transition-colors hover:text-white/80"
        >
          <ArrowLeft className="h-4 w-4" />
          Teams
        </Link>
        <span className="text-white/15">/</span>
        <span className="font-mono text-sm font-semibold text-white/60">Draft Ceremony</span>
        {ceremony.settings.funMode && (
          <span className="flex items-center gap-1 rounded-full bg-[#fbbf24]/15 px-2 py-0.5 text-xs font-bold text-[#fbbf24]">
            <Sparkles className="h-3 w-3" />
            Fun Mode
          </span>
        )}
        {ceremony.phase === "main" && (
          <>
            <span className="text-white/15">·</span>
            <span className="font-mono text-xs text-white/30">
              {ceremony.history.length} picked
            </span>
          </>
        )}

        {/* Settings (organizer only — hidden mid-ceremony overlays) */}
        <div className="relative ml-auto">
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="flex h-9 items-center gap-1.5 rounded-full border border-white/10 px-3 text-xs font-bold text-white/50 transition-colors hover:text-white"
          >
            <Settings2 className="h-4 w-4" />
            Setup
          </button>
          {settingsOpen && (
            <SettingsPanel
              settings={ceremony.settings}
              onUpdate={ceremony.updateSettings}
              onClose={() => setSettingsOpen(false)}
            />
          )}
        </div>
      </nav>

      {ceremony.phase === "intro" && (
        <IntroScreen
          squads={ceremony.squads}
          totalUnassigned={ceremony.totalRemaining}
          onStart={ceremony.start}
        />
      )}

      {ceremony.phase === "intros" && (
        <IntrosScreen
          squads={ceremony.squads}
          captainBySquad={ceremony.captainBySquad}
          speed={ceremony.settings.speed}
          onDone={ceremony.beginDraft}
        />
      )}

      {ceremony.phase === "main" && (
        <MainScreen
          squads={ceremony.squads}
          pool={ceremony.pool}
          skillGroups={ceremony.skillGroups}
          resolvedSkill={ceremony.resolvedSkill}
          totalRemaining={ceremony.totalRemaining}
          totalPlayers={totalPlayers}
          isAssigning={ceremony.isAssigning}
          history={ceremony.history}
          currentSquad={ceremony.currentSquad}
          settings={ceremony.settings}
          powersEnabled={ceremony.powersEnabled}
          teamCards={ceremony.teamCards}
          onAwardCard={ceremony.awardCard}
          onPlayCard={ceremony.playCard}
          justCompletedSquadId={ceremony.justCompletedSquadId}
          onClearCompleted={ceremony.clearJustCompleted}
          isWildcardActive={ceremony.isWildcardActive}
          onAssign={ceremony.assign}
          onUndo={ceremony.undo}
          onChangeSkill={ceremony.changeSkill}
        />
      )}

      {ceremony.phase === "complete" && (
        <CompletionScreen
          tournamentId={tournamentId}
          squads={ceremony.squads}
          sessionAssignments={ceremony.history}
        />
      )}
    </div>
  );
}
