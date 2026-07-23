"use client";

import gsap from "gsap";
import { ArrowLeft, ChevronRight, RotateCcw, Settings2, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import ReactConfetti from "react-confetti";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { dur, ease, stagger } from "@/lib/motion";
import {
  CeremonyWheel,
  type WheelHandle,
} from "@/features/squads/components/draft-ceremony/ceremony-wheel";
import {
  DEFAULT_CARD_SLOTS,
  SPEED_MULTIPLIER,
  type CeremonySettings,
  type CeremonySpeed,
} from "@/features/squads/components/draft-ceremony/ceremony-settings";
import {
  allCards,
  getCard,
  isChoiceCard,
  isRerollCard,
} from "@/features/squads/components/draft-ceremony/power-cards";
import type {
  CardPreview,
  PowerEvent as EnginePowerEvent,
} from "@/features/squads/components/draft-ceremony/power-cards/types";
import {
  legalSwaps,
  sameSkill,
} from "@/features/squads/components/draft-ceremony/power-cards/cards/jo-tera-hai-wo-mera";
import {
  buildDeckForWheel,
  buildWheelSlots,
  isPlayerSlot,
  SKILL_KEYS,
  SKILL_LABELS,
  skillKeyOf,
  wheelDeckCapacity,
  type PowerKind,
  type SkillKey,
  type WheelSlot,
} from "@/features/squads/components/draft-ceremony/power-slots";
import {
  skillLabel,
  useCeremony,
  type ActivityEntry,
} from "@/features/squads/components/draft-ceremony/use-ceremony";
import type {
  SquadMemberView,
  SquadView,
  UnassignedRegistrationView,
} from "@/features/squads/types";
import { cn } from "@/lib/utils";

/** Scale an animation duration (seconds) by the ceremony playback speed. */
function scaled(seconds: number, speed: CeremonySpeed) {
  return seconds * SPEED_MULTIPLIER[speed];
}

/** A power moment to announce. */
interface PowerEvent {
  kind: PowerKind;
  /** Line under the title, e.g. "Team A drew 🔄 Jo Tera Hai Wo Mera". */
  detail: string;
  /** Optional reassurance line, e.g. "Bonus card — no pick lost". */
  note?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * How long a power overlay stays up, in seconds.
 *
 * Winning a card is the first time anyone reads it, so it holds far longer than a
 * normal beat — captains are taking in a name, an icon and a rule at once. Results
 * of a card already known get less.
 *
 * `MIN_HOLD_MS` is a floor the speed setting cannot go below: playback speed is
 * about animation, not about how fast people read.
 */
const CARD_REVEAL_HOLD = 6;
const CARD_RESULT_HOLD = 4;
const MIN_HOLD_MS = 5000;

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

/**
 * Short monogram for a team. Teams were distinguished purely by accent colour,
 * which is no help to a colourblind viewer squinting at a projector — the mark
 * gives a second, non-colour cue.
 */
function teamMark(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

/** Colour chip carrying the team monogram. */
function TeamMark({
  name,
  color,
  size = "sm",
}: {
  name: string;
  color: string;
  size?: "sm" | "md";
}) {
  const dim = size === "md" ? "h-5 w-5 text-[9px]" : "h-4 w-4 text-[8px]";
  return (
    <span
      aria-hidden
      className={`${dim} flex shrink-0 items-center justify-center rounded font-black leading-none text-white`}
      style={{ backgroundColor: color }}
    >
      {teamMark(name)}
    </span>
  );
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
  /** Id, not just name — names can be renamed mid-ceremony and may not be unique. */
  squadId: string;
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

export function RevealOverlay({
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

  // The parent re-renders several times while a reveal is on screen (the team
  // flash clears after 2s, the ghost-fly state lands, timers fire). `onDone` is
  // rebuilt on each of those renders, so listing it as a dependency tore down
  // the timeline and played the whole card entrance again — the name appeared to
  // pop two or three times. Read the latest callback through a ref instead, and
  // let the animation run exactly once per reveal.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    if (prefersReducedMotion()) {
      const t = setTimeout(() => onDoneRef.current(null), 600);
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
          onDoneRef.current(cardRect);
        },
      });

    return () => {
      tl.kill();
    };
    // Deliberately mount-only: one reveal, one animation. The parent gives this
    // component a key per pick, so a new player remounts it rather than
    // restarting an in-flight timeline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div
        ref={cardRef}
        className="flex max-w-[min(92vw,68rem)] flex-col items-center gap-4 rounded-3xl px-8 py-10 text-center shadow-2xl backdrop-blur-md sm:px-16 sm:py-12"
        style={{
          background: `linear-gradient(135deg, ${info.squadColor}22 0%, rgba(30,41,59,0.95) 100%)`,
          border: `2px solid ${tier.accent}66`,
          boxShadow: `0 0 80px ${tier.accent}${Math.round(tier.glow * 100)}, 0 20px 60px rgba(0,0,0,0.6)`,
        }}
      >
        <p
          className="font-mono text-sm font-bold uppercase tracking-[0.25em] lg:text-base"
          style={{ color: tier.accent }}
        >
          {tier.eyebrow}
        </p>
        <p className="max-w-full break-words text-[clamp(2.5rem,7vw,6.5rem)] font-black leading-tight text-white drop-shadow-lg">
          {info.playerName}
        </p>
        <div className="flex items-center gap-2">
          {info.skillLevel && (
            <span
              className="rounded-full px-3 py-1 text-sm font-bold lg:text-base"
              style={{ background: `${tier.accent}22`, color: tier.accent }}
            >
              {skillLabel(info.skillLevel)}
            </span>
          )}
          {info.divisionName && (
            <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white/60 lg:text-base">
              {info.divisionName}
            </span>
          )}
        </div>
        <div
          className="mt-1 flex max-w-full items-center gap-2 rounded-full px-6 py-2.5 text-base font-black text-white shadow-lg lg:px-8 lg:py-3 lg:text-xl"
          style={{ backgroundColor: info.squadColor }}
        >
          <span className="truncate">→ {info.squadName}</span>
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
  teamCards: Record<string, PowerKind[]>;
}

function SquadRoster({ squads, assignments, columnRefs, flashSquadId, teamCards }: RosterProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {squads.map((squad, i) => {
        // Once the board refetches (or a session is restored) a drafted player is
        // already in squad.members — only show session pills for ones that aren't,
        // otherwise they render twice.
        const onBoard = new Set(squad.members.map((m) => m.registrationId));
        const mine = assignments.filter(
          (a) => a.squadId === squad.id && !onBoard.has(a.registrationId),
        );
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
              <TeamMark name={squad.name} color={color} />
              <span className="text-sm font-bold text-white">{squad.name}</span>
              {/* Passive cards (the shield) are a standing property of the team —
                  show them ON the team so protection is visible BEFORE a raid,
                  not discovered when a swap mysteriously fails. Driven by mode. */}
              {(teamCards[squad.id] ?? [])
                .filter((id) => getCard(id).mode === "passive")
                .map((id, idx) => {
                  const card = getCard(id);
                  return (
                    <span
                      key={`${id}-${idx}`}
                      title={`${card.label} — ${card.hint}`}
                      className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs"
                      style={{
                        background: `${card.color}30`,
                        border: `1px solid ${card.color}88`,
                      }}
                    >
                      {card.emoji}
                    </span>
                  );
                })}
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
      className="flex max-w-full items-center gap-2.5 rounded-full px-5 py-2 text-sm font-black text-white lg:px-7 lg:py-2.5 lg:text-xl"
      style={{
        backgroundColor: `${color}22`,
        border: `1.5px solid ${color}55`,
        boxShadow: `0 0 24px ${color}22`,
      }}
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full lg:h-3 lg:w-3"
        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
      />
      <span className="shrink-0 text-xs font-normal text-white/60 lg:text-base">
        Now picking for
      </span>
      <span className="truncate" style={{ color }}>
        {squad.name}
      </span>
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
      className="relative flex h-14 w-52 items-center justify-center rounded-full text-lg font-black text-white shadow-xl transition-all disabled:cursor-not-allowed disabled:opacity-50 lg:h-16 lg:w-64 lg:text-xl"
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
          <h1 className="font-serif text-[clamp(3rem,6vw,6rem)] font-black tracking-tight text-white">
            Draft Ceremony
          </h1>
          <p className="mt-3 text-lg text-white/50 lg:text-2xl">
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
        <div
          ref={containerRef}
          className="flex w-full max-w-2xl flex-col items-center gap-6 xl:max-w-4xl"
        >
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
            <h1 className="font-serif text-[clamp(2.75rem,5vw,5rem)] font-black tracking-tight text-white">
              Draft Complete!
            </h1>
            <p className="mt-2 text-white/50 lg:text-xl">All players assigned to their teams</p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2">
            {squads.map((squad, i) => {
              const onBoard = new Set(squad.members.map((m) => m.registrationId));
              const newOnes = sessionAssignments.filter(
                (a) => a.squadId === squad.id && !onBoard.has(a.registrationId),
              );
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
                    <TeamMark name={squad.name} color={color} size="md" />
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

// ── Activity timeline ─────────────────────────────────────────────────────────

/**
 * One line of timeline copy, derived from the event + card metadata.
 *
 * Events snapshot squad NAMES at the moment they happened, but they also carry
 * ids — resolve the name live wherever an id exists, so a team renamed
 * mid-ceremony reads by its current name throughout the log.
 */
function describeEvent(
  event: EnginePowerEvent,
  squadName: (id: string, fallback: string) => string,
): { emoji: string; text: string } | null {
  switch (event.type) {
    case "CardAwarded":
      return {
        emoji: getCard(event.cardId).emoji,
        text: `${squadName(event.squadId, event.squadName)} drew ${getCard(event.cardId).label}`,
      };
    case "CardPlayed":
      return { emoji: getCard(event.cardId).emoji, text: event.detail };
    case "SwapCompleted":
      return {
        emoji: getCard(event.cardId).emoji,
        text: `${event.aName} ⇄ ${event.bName} · ${squadName(event.a.squadId, event.fromSquad)} ↔ ${squadName(event.b.squadId, event.toSquad)}`,
      };
    case "SwapBlocked":
      return {
        emoji: "🛡️",
        text:
          event.reason === "immunity"
            ? `Raid on ${event.toSquad} blocked`
            : `No eligible players on ${event.toSquad}`,
      };
    default:
      return null;
  }
}

/**
 * Running log of every power moment. Makes the draft auditable in the room —
 * and is where a disputed swap gets reversed, since only the most recent
 * reversible play can be undone (arbitrary history would be ambiguous).
 */
function ActivityTimeline({
  activity,
  squads,
  undoableId,
  onUndo,
  isUndoing,
}: {
  activity: ActivityEntry[];
  squads: SquadView[];
  undoableId: string | null;
  onUndo: () => void;
  isUndoing: boolean;
}) {
  if (activity.length === 0) return null;
  const newestFirst = [...activity].reverse();
  const squadName = (id: string, fallback: string) =>
    squads.find((s) => s.id === id)?.name ?? fallback;

  return (
    <div className="mb-4">
      <p className="text-2xs mb-2 font-mono font-bold uppercase tracking-widest text-white/30">
        Activity
      </p>
      <div className="flex max-h-52 flex-col gap-1 overflow-y-auto">
        {newestFirst.map((entry) => {
          const described = describeEvent(entry.event, squadName);
          if (!described) return null;
          const canUndo = entry.id === undoableId;
          return (
            <div
              key={entry.id}
              className="flex items-start gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5"
              style={{ opacity: entry.undone ? 0.4 : 1 }}
            >
              <span className="text-sm leading-tight">{described.emoji}</span>
              <span
                className="flex-1 text-xs leading-snug text-white/70"
                style={{ textDecoration: entry.undone ? "line-through" : undefined }}
              >
                {described.text}
              </span>
              {canUndo && (
                <button
                  onClick={onUndo}
                  disabled={isUndoing}
                  className="text-2xs shrink-0 rounded-md border border-white/20 px-1.5 py-0.5 font-bold text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                  {isUndoing ? "…" : "Undo"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Team power-card inventory (TV rail) ──────────────────────────────────────

/**
 * Always-visible power-card rail. Deliberately NOT in the collapsible sidebar:
 * the draft is projected to a room, so ownership has to be legible at a distance
 * and usable on a tablet. Renders entirely from registry metadata + `card.mode`,
 * so a newly registered card appears here with no change to this component.
 */
function TeamCardsRail({
  squads,
  teamCards,
  spentCards,
  armed,
  onCardClick,
  onTargetTeam,
  layout,
}: {
  squads: SquadView[];
  teamCards: Record<string, PowerKind[]>;
  spentCards: Record<string, PowerKind[]>;
  armed: { squadId: string; cardId: PowerKind } | null;
  onCardClick: (squadId: string, kind: PowerKind) => void;
  onTargetTeam: (squadId: string) => void;
  /**
   * "column" is the projector layout: a left rail beside the wheel, stacked and
   * fully visible. "footer" is the narrow-screen fallback — cards are *played*
   * from here, so they can never simply be hidden when the rail does not fit.
   */
  layout: "column" | "footer";
}) {
  const anyActivity = squads.some(
    (s) => (teamCards[s.id] ?? []).length > 0 || (spentCards[s.id] ?? []).length > 0,
  );
  if (!anyActivity && !armed) return null;

  const isColumn = layout === "column";

  return (
    <aside
      className={cn(
        "border-white/8 shrink-0 overflow-y-auto",
        isColumn
          ? "hidden w-64 flex-col border-r p-4 lg:flex xl:w-72 2xl:w-80"
          : "flex flex-col border-t px-5 py-3 lg:hidden",
      )}
      style={{ background: BG_SIDEBAR }}
    >
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-[#fbbf24]" />
        <p className="text-2xs font-mono font-bold uppercase tracking-widest text-[#fbbf24]/80">
          Power Cards
        </p>
      </div>
      {armed && (
        <p className="mb-2 animate-pulse text-xs font-black text-[#f472b6]">
          Choose a team to raid →
        </p>
      )}

      <div className={cn(isColumn ? "flex flex-col gap-2.5" : "flex gap-2.5 overflow-x-auto")}>
        {squads.map((s, i) => {
          const hand = teamCards[s.id] ?? [];
          const spent = spentCards[s.id] ?? [];
          if (hand.length === 0 && spent.length === 0 && !armed) return null;

          const color = squadAccent(i);
          const targetable = !!armed && armed.squadId !== s.id;
          return (
            <div
              key={s.id}
              onClick={() => targetable && onTargetTeam(s.id)}
              className={cn(
                "flex flex-col gap-2 rounded-2xl px-3 py-2.5 transition-colors",
                !isColumn && "min-w-[9.5rem] shrink-0",
              )}
              style={{
                background: targetable ? "rgba(219,39,119,0.2)" : "rgba(255,255,255,0.04)",
                border: targetable ? "2px solid #db2777" : `1px solid ${color}33`,
                cursor: targetable ? "pointer" : "default",
              }}
            >
              <div className="flex items-center gap-2">
                <TeamMark name={s.name} color={color} size="md" />
                <span className="truncate text-sm font-black text-white">{s.name}</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {hand.length === 0 && spent.length === 0 && (
                  <span className="text-xs text-white/25">no cards</span>
                )}

                {hand.map((k, idx) => {
                  const card = getCard(k);
                  // Instant + targeted play from the rail; self plays from its own
                  // on-turn button; passive is shown but not clickable.
                  const playable = card.mode === "instant" || card.mode === "targeted";
                  const isArmed = armed?.squadId === s.id && armed?.cardId === k;
                  return (
                    <button
                      key={`${k}-${idx}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (playable) onCardClick(s.id, k);
                      }}
                      title={`${card.label} — ${card.hint}`}
                      className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 transition-transform hover:scale-105"
                      style={{
                        background: `${card.color}2e`,
                        border: isArmed ? `2px solid ${card.color}` : `1.5px solid ${card.color}77`,
                        cursor: playable ? "pointer" : "default",
                      }}
                    >
                      <span className="text-xl leading-none">{card.emoji}</span>
                      <span className="text-2xs font-black leading-tight text-white">
                        {card.label}
                      </span>
                    </button>
                  );
                })}

                {/* Spent cards stay visible (dimmed) so the room can see what was
                    used — a card that silently vanishes reads as a bug. */}
                {spent.map((k, idx) => {
                  const card = getCard(k);
                  return (
                    <span
                      key={`spent-${k}-${idx}`}
                      title={`${card.label} — already played`}
                      className="flex items-center gap-1 rounded-xl border border-white/10 px-2 py-1 opacity-35 grayscale"
                    >
                      <span className="text-base leading-none">{card.emoji}</span>
                      <span className="text-2xs font-bold text-white/70 line-through">
                        {card.label}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

/** The pair a captain picked by hand, by registration id. */
type ChosenSwap = { fromRegistrationId: string; toRegistrationId: string };

/**
 * Swap picker — the captain chooses BOTH players, one per side.
 *
 * Skill levels must match, so choosing on one side dims every player on the
 * other whose level differs. Showing them dimmed rather than hiding them is
 * deliberate: a captain looking for a name needs to see it is there and why it
 * cannot be taken, otherwise a missing player reads as a bug.
 */
function SwapPickerOverlay({
  from,
  to,
  onConfirm,
  onCancel,
}: {
  from: SquadView;
  to: SquadView;
  onConfirm: (chosen: ChosenSwap) => void;
  onCancel: () => void;
}) {
  const card = getCard("swap");
  const [mine, setMine] = useState<SquadMemberView | null>(null);
  const [theirs, setTheirs] = useState<SquadMemberView | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const pairs = legalSwaps(from, to);
  // A player is offerable only if some legal trade involves them at all — that
  // already excludes captains and anyone whose level no one on the other side has.
  const myOptions = from.members.filter((m) =>
    pairs.some((p) => p.a.registrationId === m.registrationId),
  );
  const theirOptions = to.members.filter((m) =>
    pairs.some((p) => p.b.registrationId === m.registrationId),
  );

  function column(
    title: string,
    squadName: string,
    options: SquadMemberView[],
    selected: SquadMemberView | null,
    counterpart: SquadMemberView | null,
    onSelect: (m: SquadMemberView) => void,
  ) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <p className="text-2xs font-mono font-bold uppercase tracking-widest text-white/40">
          {title}
        </p>
        <p className="truncate text-sm font-black text-white">{squadName}</p>
        <div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto pr-1">
          {options.map((m) => {
            const isSelected = selected?.registrationId === m.registrationId;
            // Dimmed once the other side is chosen and the levels differ.
            const blocked = counterpart !== null && !sameSkill(m, counterpart);
            return (
              <button
                key={m.registrationId}
                onClick={() => !blocked && onSelect(m)}
                disabled={blocked}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors disabled:cursor-not-allowed"
                style={{
                  background: isSelected ? `${card.color}33` : "rgba(255,255,255,0.05)",
                  border: isSelected
                    ? `2px solid ${card.color}`
                    : "1px solid rgba(255,255,255,0.1)",
                  opacity: blocked ? 0.3 : 1,
                }}
              >
                <span className="truncate text-sm font-bold text-white">{m.displayName}</span>
                <span className="text-2xs ml-auto shrink-0 font-mono uppercase text-white/50">
                  {skillLabel(m.skillLevel)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const ready = mine !== null && theirs !== null;

  return (
    <div className="fixed inset-0 z-[64] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[80vh] w-[min(92vw,48rem)] flex-col gap-4 rounded-[2rem] px-8 py-7"
        style={{
          background: `linear-gradient(160deg, ${card.color}26 0%, rgba(30,41,59,0.98) 100%)`,
          border: `2px solid ${card.color}88`,
          boxShadow: `0 0 80px ${card.color}44, 0 24px 70px rgba(0,0,0,0.6)`,
        }}
      >
        <div className="text-center">
          <p
            className="font-mono text-xs font-black uppercase tracking-[0.28em]"
            style={{ color: card.color }}
          >
            {card.emoji} {card.title}
          </p>
          <p className="mt-1 text-lg font-black text-white">
            {from.name} <span style={{ color: card.color }}>⇄</span> {to.name}
          </p>
          <p className="mt-1 text-xs text-white/50">Both players must be the same skill level.</p>
        </div>

        {pairs.length === 0 ? (
          <p className="rounded-2xl bg-white/5 px-4 py-6 text-center text-sm font-semibold text-white/70">
            No same-skill players to trade with {to.name}. Your card is not used — raid a different
            team.
          </p>
        ) : (
          <div className="flex min-h-0 gap-4">
            {column("You give", from.name, myOptions, mine, theirs, setMine)}
            <div className="self-center text-2xl" style={{ color: card.color }}>
              ⇄
            </div>
            {column("You take", to.name, theirOptions, theirs, mine, setTheirs)}
          </div>
        )}

        <div className="flex justify-center gap-3">
          <button
            onClick={onCancel}
            className="rounded-full border border-white/15 px-6 py-2.5 text-sm font-bold text-white/70 transition-colors hover:bg-white/10"
          >
            Cancel
          </button>
          {pairs.length > 0 && (
            <button
              onClick={() =>
                ready &&
                onConfirm({
                  fromRegistrationId: mine.registrationId,
                  toRegistrationId: theirs.registrationId,
                })
              }
              disabled={!ready}
              className="rounded-full px-8 py-2.5 text-sm font-black text-white transition-transform enabled:hover:scale-105 disabled:opacity-40"
              style={{ background: card.color }}
            >
              {ready ? "Swap them" : "Pick one from each side"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Player picker (for cards that need a choice) ──────────────────────────────

/**
 * Generic chooser for any card declaring a `selection`. Renders the card's own
 * prompt and the pool it asks for, so a future card needing a choice reuses this
 * untouched. Cancel costs nothing — the card is only spent once a pick is made.
 */
function PlayerPickerOverlay({
  cardId,
  squadName,
  players,
  onPick,
  onCancel,
}: {
  cardId: PowerKind;
  squadName: string;
  players: UnassignedRegistrationView[];
  onPick: (player: UnassignedRegistrationView) => void;
  onCancel: () => void;
}) {
  const card = getCard(cardId);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[64] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[80vh] w-[min(92vw,44rem)] flex-col gap-4 rounded-[2rem] px-8 py-7"
        style={{
          background: `linear-gradient(160deg, ${card.color}26 0%, rgba(30,41,59,0.98) 100%)`,
          border: `2px solid ${card.color}88`,
          boxShadow: `0 0 80px ${card.color}44, 0 24px 70px rgba(0,0,0,0.6)`,
        }}
      >
        <div className="text-center">
          <p
            className="font-mono text-xs font-black uppercase tracking-[0.28em]"
            style={{ color: card.color }}
          >
            {card.emoji} {card.title}
          </p>
          <p className="mt-1 text-2xl font-black text-white">
            {card.selection?.prompt ?? "Choose a player"}
          </p>
          <p className="mt-1 text-sm text-white/50">{squadName} is picking</p>
        </div>

        <div className="grid grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {players.map((p) => (
            <button
              key={p.registrationId}
              onClick={() => onPick(p)}
              className="flex flex-col items-start gap-0.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left transition-colors hover:border-white/30 hover:bg-white/10"
            >
              <span className="truncate text-sm font-bold text-white">{p.displayName}</span>
              {p.skillLevel && (
                <span className="text-2xs font-semibold text-white/40">
                  {skillLabel(p.skillLevel)}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          className="mx-auto h-10 rounded-full border border-white/25 px-7 text-sm font-bold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          Cancel — keep the card
        </button>
      </div>
    </div>
  );
}

// ── Card confirm dialog ───────────────────────────────────────────────────────

/**
 * Generic pre-execution confirm. Rendered purely from card metadata + the card's
 * own `preview()` result, so any card exposing a preview gets this for free —
 * there is no card-specific logic here. Nothing is mutated until Confirm.
 */
function CardConfirmDialog({
  cardId,
  preview,
  onConfirm,
  onCancel,
}: {
  cardId: PowerKind;
  preview: CardPreview;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const card = getCard(cardId);
  const ref = useRef<HTMLDivElement>(null);
  // "no-players" is unactionable — everything else can be confirmed.
  const canConfirm = preview.ok || preview.reason === "immunity";

  useEffect(() => {
    if (!ref.current || prefersReducedMotion()) return;
    gsap.fromTo(
      ref.current,
      { scale: 0.85, opacity: 0, y: 16 },
      { scale: 1, opacity: 1, y: 0, duration: 0.28, ease: "back.out(1.7)" },
    );
  }, []);

  // Escape always cancels — a safe out at any moment.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[64] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`Confirm ${card.title}`}
        className="flex w-[min(90vw,34rem)] flex-col items-center gap-5 rounded-[2rem] px-10 py-9 text-center"
        style={{
          background: `linear-gradient(160deg, ${card.color}2b 0%, rgba(30,41,59,0.98) 100%)`,
          border: `2px solid ${card.color}88`,
          boxShadow: `0 0 80px ${card.color}44, 0 24px 70px rgba(0,0,0,0.6)`,
        }}
      >
        <span className="text-6xl drop-shadow-lg">{card.emoji}</span>
        <p
          className="font-mono text-xs font-black uppercase tracking-[0.28em]"
          style={{ color: card.color }}
        >
          Confirm Power Card
        </p>
        <p className="text-3xl font-black text-white">{card.title}</p>

        {/* The swap itself — both sides named explicitly so nothing is disputed. */}
        {preview.swap ? (
          <div className="flex w-full flex-col gap-2 rounded-2xl bg-black/25 px-5 py-4">
            <div className="flex items-center justify-between gap-3 text-left">
              <span className="text-sm text-white/50">{preview.swap.fromSquad}</span>
              <span className="text-lg font-black text-white">{preview.swap.a.displayName}</span>
            </div>
            <div className="text-center text-2xl font-black" style={{ color: card.color }}>
              ⇄
            </div>
            <div className="flex items-center justify-between gap-3 text-left">
              <span className="text-sm text-white/50">{preview.swap.toSquad}</span>
              <span className="text-lg font-black text-white">{preview.swap.b.displayName}</span>
            </div>
          </div>
        ) : (
          <p className="text-xl font-bold text-white/85">{preview.summary}</p>
        )}

        {preview.reason === "immunity" && (
          <p className="text-sm font-bold text-[#fbbf24]">
            This will be blocked — both cards are spent.
          </p>
        )}

        <div className="mt-1 flex gap-3">
          <button
            onClick={onCancel}
            className="h-11 rounded-full border border-white/25 px-7 text-sm font-bold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            Cancel
          </button>
          {canConfirm && (
            <button
              onClick={onConfirm}
              autoFocus
              className="h-11 rounded-full px-8 text-sm font-black text-white shadow-lg transition-transform hover:scale-[1.03] active:scale-[0.98]"
              style={{ backgroundColor: card.color }}
            >
              Play {card.label}
            </button>
          )}
        </div>
      </div>
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
  spentCards,
  activity,
  undoableEntry,
  onUndoLastPlay,
  onUnassignLast,
  onAwardCard,
  onPlayCard,
  onPreviewCard,
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
  spentCards: Record<string, PowerKind[]>;
  activity: ActivityEntry[];
  undoableEntry: ActivityEntry | null;
  onUndoLastPlay: () => Promise<EnginePowerEvent[]>;
  onUnassignLast: () => Promise<{ registrationId: string; squadId: string } | null>;
  onAwardCard: (squadId: string, cardId: PowerKind) => EnginePowerEvent[];
  onPlayCard: (
    cardId: PowerKind,
    squadId: string,
    targetSquadId?: string,
    chosenSwap?: ChosenSwap,
  ) => Promise<EnginePowerEvent[]>;
  onPreviewCard: (
    cardId: PowerKind,
    squadId: string,
    targetSquadId?: string,
    chosenSwap?: ChosenSwap,
  ) => CardPreview | null;
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
  // Shown during the bonus re-spin so the room knows the pick still stands.
  const [respinNote, setRespinNote] = useState<string | null>(null);
  // Teams that have already had their 3·2·1 moment (countdown is once per team).
  const countedDownTeamsRef = useRef<Set<string>>(new Set());
  const [isUndoing, setIsUndoing] = useState(false);
  // The pick just made, kept so a self-mode card can re-roll it. Cleared as soon
  // as the next spin starts — you can only re-roll the pick you just saw.
  const [lastPick, setLastPick] = useState<{
    squadId: string;
    player: UnassignedRegistrationView;
    slotIndex: number;
  } | null>(null);
  const [isRerolling, setIsRerolling] = useState(false);
  // A card that needs a player chosen before it resolves (e.g. Meri Marzi).
  const [choosing, setChoosing] = useState<PowerKind | null>(null);
  // Resolver for the current power-overlay hold, so it can be cut short.
  const dismissHoldRef = useRef<(() => void) | null>(null);

  /**
   * Hold an overlay for `ms`, but let the organizer skip it. Power moments are
   * fun the first time and drag by the tenth; being stuck watching a fixed
   * animation with a room waiting is worse than ending it early.
   */
  function holdOverlay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        dismissHoldRef.current = null;
        resolve();
      }, ms);
      dismissHoldRef.current = () => {
        clearTimeout(timer);
        dismissHoldRef.current = null;
        resolve();
      };
    });
  }

  const dismissOverlay = useCallback(() => dismissHoldRef.current?.(), []);
  // Active power being resolved on the wheel (drives the PowerOverlay).
  const [powerEvent, setPowerEvent] = useState<PowerEvent | null>(null);
  // A targeted card that has been picked up and is awaiting a target team.
  // Tracks WHICH card is armed, not just the team, so any targeted card works.
  const [armed, setArmed] = useState<{ squadId: string; cardId: PowerKind } | null>(null);
  // Target chosen for a swap, waiting on the captain to pick the two players.
  const [swapPicker, setSwapPicker] = useState<{ from: SquadView; to: SquadView } | null>(null);
  // A previewed-but-unconfirmed play. Nothing is mutated while this is set.
  const [pendingPlay, setPendingPlay] = useState<{
    cardId: PowerKind;
    squadId: string;
    targetSquadId: string;
    preview: CardPreview;
    /** The hand-picked pair, carried through so confirm plays exactly that trade. */
    chosenSwap?: ChosenSwap;
  } | null>(null);
  const [ghostFly, setGhostFly] = useState<{
    name: string;
    color: string;
    fromRect: DOMRect;
    toRect: DOMRect;
  } | null>(null);

  const currentSquadIdx = squads.findIndex((s) => s.id === currentSquad?.id);
  const canSpin =
    spinPhase === "idle" &&
    pool.length > 0 &&
    !isAssigning &&
    !countdownActive &&
    !powerEvent &&
    !pendingPlay &&
    // Space spins the wheel; it must not fire behind an open swap picker.
    !swapPicker;
  const poolEmpty = pool.length === 0 && totalRemaining > 0;

  // The deck for THIS wheel. Tiers hold very different numbers of players, so
  // the counts are per skill group: four cards is a surprise on a 30-player
  // intermediate wheel and near-constant on a 10-player advanced one.
  const deck = useMemo(() => {
    if (!powersEnabled) return [];
    const wheel = skillKeyOf(resolvedSkill);
    const ids = allCards()
      .filter((c) => c.wheelEligible)
      .map((c) => c.id);
    return buildDeckForWheel(ids, settings.cardSlots[wheel], DEFAULT_CARD_SLOTS);
  }, [powersEnabled, settings.cardSlots, resolvedSkill]);

  // The wheel slots are built ONCE per skill group and then held FIXED: power slots
  // stay put across spins, and only the picked player (and a landed power) are
  // removed. This is what makes powers land reliably and stop reshuffling every
  // spin. We rebuild only when the skill group changes or when data first arrives.
  //
  // A ref mirrors the state because runSpin/commitPick are async closures: a
  // re-roll mutates the slots (returns the player to the wheel) and spins again
  // in the SAME event, so reading the state snapshot would use the pre-mutation
  // slot list — misaligning the landing segment from the committed player.
  const [wheelSlots, setWheelSlotsState] = useState<WheelSlot[]>([]);
  const wheelSlotsRef = useRef<WheelSlot[]>([]);
  const setWheelSlots = (next: WheelSlot[] | ((prev: WheelSlot[]) => WheelSlot[])) => {
    const value = typeof next === "function" ? next(wheelSlotsRef.current) : next;
    wheelSlotsRef.current = value;
    setWheelSlotsState(value);
  };
  const builtForSkillRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const needsRebuild = builtForSkillRef.current !== resolvedSkill || wheelSlots.length === 0;
    if (!needsRebuild || pool.length === 0) return;
    setWheelSlots(buildWheelSlots(pool, deck));
    builtForSkillRef.current = resolvedSkill;
    // Guarded by the ref + length check so `pool` identity churn does NOT rebuild
    // (which would reshuffle the powers). Player removal is done in runSpin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSkill, pool, deck]);

  // How many power slots are actually still on the wheel right now — the teaser
  // reads this, not the fixed setting, so it stops counting consumed slots.
  const remainingPowerSlots = wheelSlots.filter((s) => s.type === "power").length;

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
    // Countdown only on a team's FIRST pick. Running it before all ~40 picks adds
    // over a minute of dead air and the bit goes stale; once per team keeps the
    // "on the clock" beat without stalling the ceremony.
    const firstPickForTeam = !countedDownTeamsRef.current.has(currentSquad.id);
    // Wildcard Finish: the last picks fire rapidly, no countdown, for a crescendo.
    if (
      settings.funMode &&
      settings.onTheClock &&
      !isWildcardActive &&
      !lastPlayer &&
      firstPickForTeam
    ) {
      countedDownTeamsRef.current.add(currentSquad.id);
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
  async function runSpin(forSquadId?: string) {
    // A re-roll spins for the team whose pick was just reverted — NOT the render's
    // `currentSquad`, which is a stale closure already pointing at the next team
    // on the clock by the time the re-roll button is clickable.
    const spinningSquad = forSquadId ? squads.find((s) => s.id === forSquadId) : currentSquad;
    if (!wheelRef.current || !spinningSquad) return;
    const slots = wheelSlotsRef.current;
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
    // A new spin retires the previous result — only the latest is re-rollable.
    setLastPick(null);

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
        onAwardCard(spinningSquad.id, landed.power);
        const meta = getCard(landed.power);
        setPowerEvent({
          kind: landed.power,
          detail: `${spinningSquad.name} drew ${meta.emoji} ${meta.label}`,
          // Say it out loud: landing on a power is a BONUS, not a wasted turn.
          // Without this the room reads the re-spin as the team losing a pick.
          note: "Bonus card — no pick lost. Spinning again for a player…",
        });
        await holdOverlay(Math.max(MIN_HOLD_MS, scaled(CARD_REVEAL_HOLD, settings.speed) * 1000));
        setPowerEvent(null);

        // Auto re-spin to a real player — the team's pick is unaffected.
        setHighlightIndex(null);
        setRespinNote(`${spinningSquad.name} still picks — bonus card awarded`);
        target = playerIdxs[Math.floor(Math.random() * playerIdxs.length)]!;
        await wheelRef.current.spin(target);
        setRespinNote(null);
      }
    }

    const playerSlot = slots[target];
    if (!playerSlot || playerSlot.type !== "player") {
      setSpinPhase("idle");
      return;
    }
    const player = playerSlot.player;

    const committed = await commitPick(player, landedPowerId, target, forSquadId);
    if (!committed) setSpinPhase("idle");
  }

  /**
   * Commit one pick: assign, clear the slot, celebrate, reveal. Shared by the
   * wheel and by cards that let a team choose their player instead of spinning,
   * so both routes produce the identical on-screen moment.
   */
  async function commitPick(
    player: UnassignedRegistrationView,
    landedPowerId: string | null,
    highlight: number | null,
    forSquadId?: string,
  ): Promise<boolean> {
    const slots = wheelSlotsRef.current;
    // Pass the squad explicitly when this pick belongs to a specific team (the
    // re-roll path) — otherwise the hook would resolve the team from its own
    // stale pickIndex closure and hand the player to the NEXT team on the clock.
    const result = await onAssign(player, forSquadId);
    if (!result) return false;

    // Keep the wheel FIXED: drop only the picked player and the power that was just
    // collected. Everything else stays exactly where it is.
    const pickedSlotIndex = slots.findIndex(
      (s) => s.type === "player" && s.id === player.registrationId,
    );
    setWheelSlots((prev) =>
      prev.filter((s) => {
        if (s.type === "player" && s.id === player.registrationId) return false;
        if (landedPowerId && s.type === "power" && s.id === landedPowerId) return false;
        return true;
      }),
    );

    // Remember the pick so a self-mode card (First Ball Trial) can re-roll it.
    setLastPick({ squadId: result.squadId, player, slotIndex: pickedSlotIndex });

    setBurstKey((k) => k + 1);
    playFanfare();
    setHighlightIndex(highlight);

    // Capture wheel center rect for reveal/fly
    const wheelRect = wheelWrapRef.current?.getBoundingClientRect() ?? null;

    setRevealInfo({
      playerName: result.displayName,
      skillLevel: result.skillLevel,
      divisionName: player.divisionName,
      squadId: result.squadId,
      squadName: result.squadName,
      squadColor: squadAccent(squads.findIndex((s) => s.id === result.squadId)),
      wheelRect,
    });
    setSpinPhase("revealing");

    // Flash team column
    setFlashSquadId(result.squadId);
    setTimeout(() => setFlashSquadId(null), 2000);
    return true;
  }

  function handleRevealDone(cardRect: DOMRect | null) {
    // Launch fly-to-team ghost — target resolved by id, never by (renamable) name.
    if (cardRect && revealInfo) {
      const targetEl = columnRefs.current.get(revealInfo.squadId) ?? null;
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
      display = { kind: played.cardId, detail: played.detail };
    } else if (swapDone) {
      display = { kind: swapDone.cardId, detail: `${swapDone.aName}  ⇄  ${swapDone.bName}` };
    } else if (blocked) {
      // Name the blocking card from its own metadata, never a hardcoded string.
      const immunity = events.find((e) => e.type === "ImmunityTriggered");
      const blocker = immunity ? getCard(immunity.cardId) : null;
      display = {
        kind: blocked.cardId,
        detail:
          blocked.reason === "immunity" && blocker
            ? `${blocker.emoji} Blocked by ${blocked.toSquad}'s ${blocker.label}!`
            : "No eligible players to swap",
        // Immunity cancels the raid at a cost to BOTH sides — say so, or the
        // shielded team looks like it got the block for free.
        note:
          blocked.reason === "immunity"
            ? "Both cards are spent — the shield is used up too"
            : "No card was spent — you can play it again",
      };
    }
    if (!display) return;

    setPowerEvent(display);
    await holdOverlay(Math.max(MIN_HOLD_MS, scaled(CARD_RESULT_HOLD, settings.speed) * 1000));
    setPowerEvent(null);
  }

  // Play a card from a team's hand — dispatched by the card's mode (no card ids
  // hardcoded here). Instant plays immediately; targeted arms target-picking.
  async function onCardClick(squadId: string, kind: PowerKind) {
    const mode = getCard(kind).mode;
    if (mode === "targeted") {
      setArmed((prev) =>
        prev && prev.squadId === squadId && prev.cardId === kind ? null : { squadId, cardId: kind },
      );
      return;
    }
    if (mode === "instant") {
      const events = await onPlayCard(kind, squadId);
      await showPowerEvents(events);
    }
    // self plays from its own on-turn button; passive is not clickable.
  }

  /**
   * Target chosen for a targeted card — PREVIEW only. Nothing is mutated until
   * the organizer confirms in the dialog, so a stray click is always recoverable.
   */
  function onTargetTeam(targetId: string) {
    const play = armed;
    setArmed(null);
    if (!play || play.squadId === targetId) return;

    const preview = onPreviewCard(play.cardId, play.squadId, targetId);
    if (!preview) return;

    // Immunity is decided before anyone picks — no point choosing players for a
    // raid that is already blocked. Otherwise the captain chooses both players.
    if (play.cardId === "swap" && preview.reason !== "immunity") {
      const from = squads.find((sq) => sq.id === play.squadId);
      const to = squads.find((sq) => sq.id === targetId);
      if (from && to) {
        setSwapPicker({ from, to });
        return;
      }
    }

    setPendingPlay({
      cardId: play.cardId,
      squadId: play.squadId,
      targetSquadId: targetId,
      preview,
    });
  }

  /** Captain picked the two players — preview that exact trade, then confirm. */
  function onSwapChosen(chosen: ChosenSwap) {
    const picker = swapPicker;
    setSwapPicker(null);
    if (!picker) return;
    const preview = onPreviewCard("swap", picker.from.id, picker.to.id, chosen);
    if (!preview) return;
    setPendingPlay({
      cardId: "swap",
      squadId: picker.from.id,
      targetSquadId: picker.to.id,
      preview,
      chosenSwap: chosen,
    });
  }

  /**
   * Play a self-mode card (First Ball Trial) to re-roll the pick just revealed.
   *
   * The card is only meaningful AFTER a result is on the table — there is nothing
   * to re-roll before the wheel stops. So this takes the player back off the team,
   * returns them to the wheel, spends the card, and spins that team again.
   */
  async function handleReroll(cardId: PowerKind) {
    if (isRerolling || !lastPick) return;
    setIsRerolling(true);
    try {
      const reverted = await onUnassignLast();
      if (!reverted) return; // server refused — card is not spent

      // Put the player back on the wheel where they were.
      const returning = lastPick;
      setWheelSlots((prev) => {
        const slot: WheelSlot = {
          type: "player",
          id: returning.player.registrationId,
          player: returning.player,
        };
        const next = [...prev];
        next.splice(Math.min(Math.max(returning.slotIndex, 0), next.length), 0, slot);
        return next;
      });

      await onPlayCard(cardId, returning.squadId);
      setLastPick(null);
      // Spin FOR the team whose pick was reverted — the closure's currentSquad
      // already points at the next team by the time the button is clicked.
      await runSpin(returning.squadId);
    } finally {
      setIsRerolling(false);
    }
  }

  /**
   * Resolve a card that needed a player chosen. The card is spent, then the pick
   * is committed through the same path a spin uses, so the room sees the usual
   * reveal rather than a player silently appearing.
   */
  async function handleChoosePlayer(cardId: PowerKind, player: UnassignedRegistrationView) {
    if (!currentSquad) return;
    setChoosing(null);
    setSpinPhase("spinning");
    const events = await onPlayCard(cardId, currentSquad.id);
    await showPowerEvents(events);
    const ok = await commitPick(player, null, null);
    if (!ok) setSpinPhase("idle");
  }

  /** Reverse the most recent reversible play and announce it to the room. */
  async function handleUndo() {
    if (isUndoing) return;
    setIsUndoing(true);
    try {
      const events = await onUndoLastPlay();
      const reverted = events.find((e) => e.type === "SwapCompleted");
      if (reverted) {
        setPowerEvent({
          kind: reverted.cardId,
          detail: `Reversed — ${reverted.aName} ⇄ ${reverted.bName}`,
          note: "Swap undone. The card has been returned.",
        });
        await holdOverlay(Math.max(MIN_HOLD_MS, scaled(CARD_RESULT_HOLD, settings.speed) * 1000));
        setPowerEvent(null);
      }
    } finally {
      setIsUndoing(false);
    }
  }

  /** Organizer confirmed the previewed play — now execute it. */
  async function onConfirmPlay() {
    const pending = pendingPlay;
    setPendingPlay(null);
    if (!pending) return;

    setPowerEvent({ kind: pending.cardId, detail: "Making the trade…" });
    const events = await onPlayCard(
      pending.cardId,
      pending.squadId,
      pending.targetSquadId,
      pending.chosenSwap,
    );
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
          <span className="font-mono text-xs text-white/35 lg:text-sm">
            {totalRemaining} remaining
          </span>
          <div className="w-28 lg:w-44 2xl:w-56">
            <ProgressBar total={totalPlayers} remaining={totalRemaining} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Power cards on the left, roster on the right — the wheel keeps the
            middle. As a footer this rail ate vertical space the wheel needed and
            scrolled sideways; as a column it stacks and stays fully visible. */}
        {settings.funMode && settings.powerSlots && (
          <TeamCardsRail
            squads={squads}
            teamCards={teamCards}
            spentCards={spentCards}
            armed={armed}
            onCardClick={onCardClick}
            onTargetTeam={onTargetTeam}
            layout="column"
          />
        )}

        {/* Wheel area — three fixed zones (status · wheel · controls) so nothing
            ever overlaps or gets clipped: the wheel takes whatever height is left
            after the other two, and scales itself to fit. */}
        <div className="relative grid flex-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 p-4 lg:gap-4 lg:p-6">
          {/* Ambient glow behind wheel */}
          <div
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              background: `radial-gradient(ellipse 55% 55% at 50% 50%, rgba(79,107,246,0.07) 0%, transparent 70%)`,
            }}
          />

          {/* Status zone — reserved height even while a reveal hides the banner,
              so the wheel does not jump between picks. */}
          <div className="relative z-10 flex min-h-[3.5rem] flex-wrap items-center justify-center gap-3">
            {settings.funMode && isWildcardActive && spinPhase !== "revealing" && (
              <div className="flex items-center gap-2 rounded-full border border-[#fbbf24]/50 bg-[#fbbf24]/15 px-5 py-2 text-sm font-black uppercase tracking-wider text-[#fbbf24] lg:text-base">
                <Sparkles className="h-4 w-4" />
                Wildcard Finish
              </div>
            )}

            {currentSquad && spinPhase !== "revealing" && (
              <SquadBanner squad={currentSquad} squadIndex={currentSquadIdx} />
            )}

            {/* Bonus re-spin in flight — keeps the room oriented mid-spin. */}
            {respinNote && (
              <div className="flex items-center gap-2 rounded-full border border-[#34d399]/50 bg-[#34d399]/15 px-5 py-1.5 text-sm font-black text-[#34d399] lg:text-base">
                <Sparkles className="h-4 w-4" />
                {respinNote}
              </div>
            )}
          </div>

          <WinnerBurst burstKey={burstKey} />

          {poolEmpty ? (
            <div className="z-10 flex flex-col items-center justify-center text-center">
              <p className="text-lg font-bold text-white lg:text-2xl">
                All {skillLabel(resolvedSkill)} players assigned
              </p>
              <p className="mt-1 text-sm text-white/40 lg:text-base">
                Switch skill group or you&apos;re done!
              </p>
            </div>
          ) : (
            <>
              {/* Wheel zone — fills the remaining height; the wheel sizes itself
                  to the SHORTER of the zone's height/width, so a projector gets a
                  materially bigger wheel and a laptop never clips it. */}
              <div
                ref={wheelWrapRef}
                className="relative z-10 flex min-h-0 items-center justify-center"
              >
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

                {/* Power slots present on the wheel — tease the room. Counted from
                    the LIVE wheel so it stops claiming slots that were consumed. */}
                {powersEnabled && remainingPowerSlots > 0 && spinPhase === "idle" && (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[#fbbf24]">
                    <Sparkles className="h-3.5 w-3.5" />
                    {remainingPowerSlots} power {remainingPowerSlots === 1 ? "slot" : "slots"} left
                    on this wheel
                  </span>
                )}

                {/* Self cards that need a choice (e.g. Meri Marzi) are played on
                    your own turn INSTEAD of spinning. Rendered from the card's
                    `selection` descriptor, so a new such card needs no code here. */}
                {currentSquad &&
                  spinPhase === "idle" &&
                  canSpin &&
                  (teamCards[currentSquad.id] ?? [])
                    .filter((id) => isChoiceCard(getCard(id)))
                    .slice(0, 1)
                    .map((id) => {
                      const card = getCard(id);
                      return (
                        <button
                          key={id}
                          onClick={() => setChoosing(id)}
                          title={card.hint}
                          className="flex flex-col items-center gap-0.5 rounded-2xl border px-4 py-1.5 transition-transform hover:scale-105"
                          style={{
                            borderColor: `${card.color}88`,
                            background: `${card.color}26`,
                            color: card.color,
                          }}
                        >
                          <span className="text-xs font-black">
                            {card.emoji} Use {card.label}
                          </span>
                          <span className="text-2xs font-semibold opacity-70">{card.hint}</span>
                        </button>
                      );
                    })}

                {/* Self-mode cards (e.g. First Ball Trial) re-roll the pick that
                    was just revealed — offered only while that result is the
                    latest one, since there is nothing to re-roll before then.
                    Cards that need a choice are played BEFORE the spin instead, so
                    they are excluded here — otherwise Meri Marzi renders in both
                    places and the re-roll path spends it without letting you pick. */}
                {lastPick &&
                  spinPhase === "idle" &&
                  (teamCards[lastPick.squadId] ?? [])
                    .filter((id) => isRerollCard(getCard(id)))
                    .slice(0, 1)
                    .map((id) => {
                      const card = getCard(id);
                      return (
                        <button
                          key={id}
                          onClick={() => void handleReroll(id)}
                          disabled={isRerolling}
                          title={card.hint}
                          className="flex flex-col items-center gap-0.5 rounded-2xl border border-[#4f6bf6]/50 bg-[#4f6bf6]/15 px-4 py-1.5 text-[#9db0fb] transition-transform hover:scale-105 disabled:opacity-50"
                        >
                          <span className="text-xs font-black">
                            {isRerolling
                              ? "Re-rolling…"
                              : `${card.emoji} Re-roll with ${card.label}`}
                          </span>
                          <span className="text-2xs font-semibold text-[#9db0fb]/70">
                            Puts {lastPick.player.displayName} back and spins again
                          </span>
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

        {/* Team roster sidebar — widens with the display so a projector shows a
            readable roster instead of a laptop-sized strip. */}
        <aside
          className="border-white/8 hidden w-72 shrink-0 overflow-y-auto border-l p-4 lg:block xl:w-80 2xl:w-[26rem]"
          style={{ background: BG_SIDEBAR }}
        >
          {settings.funMode && settings.powerSlots && (
            <ActivityTimeline
              activity={activity}
              squads={squads}
              undoableId={undoableEntry?.id ?? null}
              onUndo={() => void handleUndo()}
              isUndoing={isUndoing}
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
            teamCards={teamCards}
          />
        </aside>
      </div>

      {/* Below lg the left rail is hidden, but cards are played from it — so the
          old full-width strip stays as the narrow-screen fallback. */}
      {settings.funMode && settings.powerSlots && (
        <TeamCardsRail
          squads={squads}
          teamCards={teamCards}
          spentCards={spentCards}
          armed={armed}
          onCardClick={onCardClick}
          onTargetTeam={onTargetTeam}
          layout="footer"
        />
      )}

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
      {swapPicker && (
        <SwapPickerOverlay
          from={swapPicker.from}
          to={swapPicker.to}
          onConfirm={onSwapChosen}
          onCancel={() => setSwapPicker(null)}
        />
      )}
      {pendingPlay && (
        <CardConfirmDialog
          cardId={pendingPlay.cardId}
          preview={pendingPlay.preview}
          onConfirm={() => void onConfirmPlay()}
          onCancel={() => setPendingPlay(null)}
        />
      )}
      {choosing && currentSquad && (
        <PlayerPickerOverlay
          cardId={choosing}
          squadName={currentSquad.name}
          players={wheelSlots.filter(isPlayerSlot).map((s) => s.player)}
          onPick={(player) => void handleChoosePlayer(choosing, player)}
          onCancel={() => setChoosing(null)}
        />
      )}
      {powerEvent && <PowerOverlay event={powerEvent} onDismiss={dismissOverlay} />}
      {revealInfo && (
        <RevealOverlay
          // One mount per pick: the overlay animates once, and the next player
          // gets a fresh component rather than reusing a finished timeline.
          key={`${revealInfo.squadId}:${revealInfo.playerName}`}
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
  poolSizeBySkill,
  currentWheel,
}: {
  settings: CeremonySettings;
  onUpdate: (patch: Partial<CeremonySettings>) => void;
  onClose: () => void;
  /** Unassigned players per tier — drives the "won't fit" warning. */
  poolSizeBySkill: Record<string, number>;
  /** The wheel currently on screen, so the panel opens on the relevant tier. */
  currentWheel: SkillKey;
}) {
  const fun = settings.funMode;
  // Counts are per wheel, so the panel edits one tier at a time.
  const [wheel, setWheel] = useState<SkillKey>(currentWheel);
  const wheelCounts = settings.cardSlots[wheel];
  const totalCardSlots = allCards()
    .filter((c) => c.wheelEligible)
    .reduce((sum, c) => sum + (wheelCounts?.[c.id] ?? DEFAULT_CARD_SLOTS), 0);
  const playersOnWheel = poolSizeBySkill[wheel] ?? 0;
  const capacity = wheelDeckCapacity(totalCardSlots, playersOnWheel);
  // Only offer tiers that actually have players left to draft.
  const tiers = SKILL_KEYS.filter((k) => (poolSizeBySkill[k] ?? 0) > 0);
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
        hint="3·2·1 countdown on each team's first pick"
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

      {/* Deck composition: one count per card. 0 switches a card off, so the
          count is also the on/off control. Listed from the registry, so a newly
          registered card appears here on its own. */}
      {fun && settings.powerSlots && (
        <div className="ml-4 border-l border-white/10 pl-2">
          <p className="px-3 pb-1 pt-2 text-xs font-semibold text-white/50">
            Cards on the {SKILL_LABELS[wheel].toLowerCase()} wheel
          </p>
          {tiers.length > 1 && (
            <div className="mx-1 mb-1 flex gap-1 rounded-full border border-white/10 bg-white/5 p-1">
              {tiers.map((k) => (
                <button
                  key={k}
                  onClick={() => setWheel(k)}
                  className={cn(
                    "flex-1 rounded-full px-2 py-1 text-[11px] font-bold transition-colors",
                    k === wheel ? "bg-white/15 text-white" : "text-white/45 hover:text-white/80",
                  )}
                >
                  {SKILL_LABELS[k]}
                  <span className="ml-1 font-mono font-normal opacity-60">
                    {poolSizeBySkill[k] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-0.5 px-1 pb-1">
            {allCards()
              .filter((c) => c.wheelEligible)
              .map((c) => {
                const n = wheelCounts?.[c.id] ?? DEFAULT_CARD_SLOTS;
                const set = (next: number) =>
                  onUpdate({
                    cardSlots: {
                      ...settings.cardSlots,
                      [wheel]: {
                        ...wheelCounts,
                        [c.id]: Math.max(0, Math.min(10, next)),
                      },
                    },
                  });
                return (
                  <div key={c.id} className="flex items-center gap-2 px-2 py-1">
                    <span className="text-base leading-none">{c.emoji}</span>
                    <span
                      className="truncate text-xs font-bold"
                      style={{ color: n > 0 ? "white" : "rgba(255,255,255,0.35)" }}
                    >
                      {c.label}
                    </span>
                    <div className="ml-auto flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => set(n - 1)}
                        aria-label={`One fewer ${c.label}`}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                      >
                        −
                      </button>
                      <span className="w-4 text-center font-mono text-sm font-bold text-white">
                        {n}
                      </span>
                      <button
                        onClick={() => set(n + 1)}
                        aria-label={`One more ${c.label}`}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
          <p className="px-3 pb-2 pt-1 text-xs text-white/40">
            {totalCardSlots === 0
              ? `No cards — the ${SKILL_LABELS[wheel].toLowerCase()} wheel will be players only.`
              : `${totalCardSlots} card${totalCardSlots === 1 ? "" : "s"} among ${playersOnWheel} player${playersOnWheel === 1 ? "" : "s"}, spread out and shuffled.`}
          </p>
          {capacity.dropped > 0 && (
            <p className="mx-2 mb-2 rounded-lg bg-[#fbbf24]/15 px-3 py-2 text-xs font-semibold text-[#fbbf24]">
              Only {capacity.fits} will appear — the {SKILL_LABELS[wheel].toLowerCase()} wheel has{" "}
              {playersOnWheel} player{playersOnWheel === 1 ? "" : "s"} left, and a wheel never holds
              more cards than players.
            </p>
          )}
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
        <p className="font-mono text-sm font-bold uppercase tracking-[0.3em] text-[#fbbf24] lg:text-base">
          Introducing
        </p>
        <h1 className="mt-3 font-serif text-[clamp(3rem,6vw,6rem)] font-black tracking-tight text-white">
          The Teams
        </h1>
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

export function CountdownOverlay({ speed, onDone }: { speed: CeremonySpeed; onDone: () => void }) {
  const [n, setN] = useState(3);
  const numRef = useRef<HTMLDivElement>(null);

  // Same trap as the reveal card: `onDone` is an inline arrow at the call site,
  // so depending on it restarted the 3·2·1 timers on every parent render.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (prefersReducedMotion()) {
      onDoneRef.current();
      return;
    }
    const step = Math.max(300, scaled(650, speed)); // ms per number
    const t1 = setTimeout(() => setN(2), step);
    const t2 = setTimeout(() => setN(1), step * 2);
    const t3 = setTimeout(() => onDoneRef.current(), step * 3);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [speed]);

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
  const onBoard = new Set(squad.members.map((m) => m.registrationId));
  const drafted = sessionMembers.filter(
    (a) => a.squadId === squad.id && !onBoard.has(a.registrationId),
  );

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
        className="flex max-w-[min(92vw,68rem)] flex-col items-center gap-5 rounded-[2rem] px-8 py-10 text-center sm:px-16 sm:py-12"
        style={{
          background: `linear-gradient(160deg, ${color}33 0%, rgba(30,41,59,0.97) 100%)`,
          border: `2px solid ${color}66`,
          boxShadow: `0 0 90px ${color}44, 0 24px 70px rgba(0,0,0,0.65)`,
        }}
      >
        <p className="font-mono text-sm font-bold uppercase tracking-[0.3em]" style={{ color }}>
          Team Complete
        </p>
        <p className="max-w-full break-words text-[clamp(2.5rem,6vw,6rem)] font-black leading-tight text-white drop-shadow-lg">
          {squad.name}
        </p>
        <div className="flex max-w-3xl flex-wrap justify-center gap-2">
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

function PowerOverlay({ event, onDismiss }: { event: PowerEvent; onDismiss: () => void }) {
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

  // Skippable: click anywhere, Space, or Escape. By the tenth power moment the
  // organizer wants the room moving again, not to sit through the animation.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" || e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        onDismiss();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <div
      onClick={onDismiss}
      role="presentation"
      className="fixed inset-0 z-[59] flex cursor-pointer items-center justify-center bg-black/45 backdrop-blur-sm"
    >
      <div
        ref={ref}
        className="flex max-w-[min(92vw,60rem)] flex-col items-center gap-4 rounded-[2rem] px-8 py-10 text-center sm:px-16 sm:py-12"
        style={{
          background: `linear-gradient(160deg, ${meta.color}33 0%, rgba(30,41,59,0.97) 100%)`,
          border: `2px solid ${meta.color}88`,
          boxShadow: `0 0 90px ${meta.color}55, 0 24px 70px rgba(0,0,0,0.6)`,
        }}
      >
        <span className="text-7xl drop-shadow-lg lg:text-8xl">{meta.emoji}</span>
        <p
          className="font-mono text-sm font-black uppercase tracking-[0.28em]"
          style={{ color: meta.color }}
        >
          Power Card
        </p>
        <p className="break-words text-[clamp(2rem,4.5vw,4rem)] font-black leading-tight text-white">
          {meta.title}
        </p>
        {/* What the card actually does. The name alone means nothing the first
            time a captain sees it, and this is the only moment it is explained. */}
        <p className="max-w-xl text-lg font-semibold leading-snug text-white/70 lg:text-xl">
          {meta.hint}
        </p>
        <p className="max-w-full break-words text-xl font-bold text-white/85 lg:text-2xl">
          {event.detail}
        </p>
        {event.note && (
          <p className="text-base font-bold text-[#34d399] lg:text-lg">{event.note}</p>
        )}
        <p className="text-2xs font-mono uppercase tracking-widest text-white/30">
          Click or press Space to continue
        </p>
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
              poolSizeBySkill={ceremony.poolSizeBySkill}
              currentWheel={skillKeyOf(ceremony.resolvedSkill)}
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
          spentCards={ceremony.spentCards}
          activity={ceremony.activity}
          undoableEntry={ceremony.undoableEntry}
          onUndoLastPlay={ceremony.undoLastPlay}
          onUnassignLast={ceremony.unassignLast}
          onAwardCard={ceremony.awardCard}
          onPlayCard={ceremony.playCard}
          onPreviewCard={ceremony.previewCard}
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
