"use client";

import gsap from "gsap";
import { ArrowLeft, ChevronRight, RotateCcw, Trophy } from "lucide-react";
import Link from "next/link";
import ReactConfetti from "react-confetti";
import { useCallback, useEffect, useRef, useState } from "react";

import { dur, ease, stagger } from "@/lib/motion";
import {
  CeremonyWheel,
  type WheelHandle,
} from "@/features/squads/components/draft-ceremony/ceremony-wheel";
import { skillLabel, useCeremony } from "@/features/squads/components/draft-ceremony/use-ceremony";
import type { SquadView, UnassignedRegistrationView } from "@/features/squads/types";

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

// ── Reveal overlay ────────────────────────────────────────────────────────────

interface RevealInfo {
  playerName: string;
  skillLevel: string | null;
  squadName: string;
  squadColor: string;
  wheelRect: DOMRect | null;
}

function RevealOverlay({
  info,
  onDone,
}: {
  info: RevealInfo;
  onDone: (cardRect: DOMRect | null) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    if (prefersReducedMotion()) {
      const t = setTimeout(() => onDone(null), 600);
      return () => clearTimeout(t);
    }

    const tl = gsap.timeline();

    // Entrance: scale up from wheel position
    tl.fromTo(
      el,
      { scale: 0.25, opacity: 0, y: 40 },
      { scale: 1, opacity: 1, y: 0, duration: dur.md, ease: "back.out(1.6)" },
    )
      .to(el, { duration: 1.8 }) // hold
      .to(el, {
        scale: 0.8,
        opacity: 0,
        y: -24,
        duration: dur.sm,
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
  }, [onDone]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center">
      <div
        ref={cardRef}
        className="flex flex-col items-center gap-4 rounded-3xl px-14 py-10 text-center shadow-2xl backdrop-blur-md"
        style={{
          background: `linear-gradient(135deg, ${info.squadColor}22 0%, rgba(30,41,59,0.95) 100%)`,
          border: `2px solid ${info.squadColor}55`,
          boxShadow: `0 0 60px ${info.squadColor}33, 0 20px 60px rgba(0,0,0,0.6)`,
        }}
      >
        <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-white/50">
          Now joining
        </p>
        <p className="text-5xl font-black text-white drop-shadow-lg">{info.playerName}</p>
        {info.skillLevel && (
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white/70">
            {skillLabel(info.skillLevel)}
          </span>
        )}
        <div
          className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-black text-white shadow-lg"
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
  onClick,
}: {
  phase: "idle" | "spinning" | "revealing";
  disabled: boolean;
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
    phase === "spinning" ? "Spinning…" : phase === "revealing" ? "Assigned!" : "🎯  Spin";

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
  const [ghostFly, setGhostFly] = useState<{
    name: string;
    color: string;
    fromRect: DOMRect;
    toRect: DOMRect;
  } | null>(null);

  const currentSquadIdx = squads.findIndex((s) => s.id === currentSquad?.id);
  const canSpin = spinPhase === "idle" && pool.length > 0 && !isAssigning;
  const poolEmpty = pool.length === 0 && totalRemaining > 0;

  async function handleSpin() {
    if (!canSpin || !wheelRef.current || !currentSquad) return;
    const idx = Math.floor(Math.random() * pool.length);
    setSpinPhase("spinning");
    setHighlightIndex(null);

    await wheelRef.current.spin(idx);

    const player = pool[idx];
    if (!player) {
      setSpinPhase("idle");
      return;
    }

    const result = await onAssign(player);
    if (!result) {
      setSpinPhase("idle");
      return;
    }

    setBurstKey((k) => k + 1);
    playFanfare();
    setHighlightIndex(idx);

    // Capture wheel center rect for reveal/fly
    const wheelRect = wheelWrapRef.current?.getBoundingClientRect() ?? null;

    setRevealInfo({
      playerName: result.displayName,
      skillLevel: result.skillLevel,
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
                  players={pool}
                  highlightIndex={highlightIndex}
                  reducedMotion={prefersReducedMotion()}
                />
              </div>

              <div className="relative z-10 flex flex-col items-center gap-2">
                <SpinButton phase={spinPhase} disabled={!canSpin} onClick={handleSpin} />
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
      {revealInfo && <RevealOverlay info={revealInfo} onDone={handleRevealDone} />}
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

// ── Shell ─────────────────────────────────────────────────────────────────────

export function DraftCeremonyShell({ tournamentId }: { tournamentId: string }) {
  const ceremony = useCeremony(tournamentId);
  const shellRef = useRef<HTMLDivElement>(null);
  const prevPhase = useRef<string>("intro");

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
        {ceremony.phase === "main" && (
          <>
            <span className="text-white/15">·</span>
            <span className="font-mono text-xs text-white/30">
              {ceremony.history.length} picked
            </span>
          </>
        )}
      </nav>

      {ceremony.phase === "intro" && (
        <IntroScreen
          squads={ceremony.squads}
          totalUnassigned={ceremony.totalRemaining}
          onStart={ceremony.start}
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
