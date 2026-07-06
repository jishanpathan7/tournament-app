"use client";

import gsap from "gsap";
import { ArrowLeft, ChevronRight, RotateCcw, Trophy } from "lucide-react";
import Link from "next/link";
import ReactConfetti from "react-confetti";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { CeremonyWheel, type WheelHandle } from "@/features/squads/components/draft-ceremony/ceremony-wheel";
import { skillLabel, useCeremony } from "@/features/squads/components/draft-ceremony/use-ceremony";
import type { SquadView, UnassignedRegistrationView } from "@/features/squads/types";

const VICTORY_SOUND_URL = "/sounds/victory-fanfare.mp3";

function playFanfare() {
  try {
    const audio = new Audio(VICTORY_SOUND_URL);
    audio.volume = 0.7;
    audio.play().catch(() => {/* autoplay policy — silently ignore */});
  } catch { /* browser doesn't support Audio */ }
}

const SQUAD_ACCENT_COLORS = [
  "#ef4444", "#3b82f6", "#22c55e", "#a855f7",
  "#f97316", "#14b8a6", "#ec4899", "#eab308",
];

function squadAccent(index: number): string {
  return SQUAD_ACCENT_COLORS[index % SQUAD_ACCENT_COLORS.length]!;
}

// ── Reveal overlay — shows player + auto-assigned team ───────────────────────

function RevealOverlay({
  playerName,
  skillLevel,
  squadName,
  squadColor,
  onDone,
}: {
  playerName: string;
  skillLevel: string | null;
  squadName: string;
  squadColor: string;
  onDone: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cardRef.current) return;
    const tl = gsap.timeline({ onComplete: onDone });
    tl.fromTo(
      cardRef.current,
      { scale: 0.3, opacity: 0, y: 50 },
      { scale: 1, opacity: 1, y: 0, duration: 0.55, ease: "back.out(1.7)" },
    )
      .to(cardRef.current, { duration: 2 })
      .to(cardRef.current, { scale: 0.85, opacity: 0, y: -30, duration: 0.4, ease: "power2.in" });
    return () => { tl.kill(); };
  }, [onDone]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center">
      <div
        ref={cardRef}
        className="flex flex-col items-center gap-4 rounded-3xl border-4 border-white/20 bg-[#1E293B]/90 px-14 py-10 text-center shadow-2xl backdrop-blur-md"
      >
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">🎉 Picked!</p>
        <p className="text-5xl font-black text-white drop-shadow-lg">{playerName}</p>
        {skillLevel && (
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white/70">
            {skillLabel(skillLevel)}
          </span>
        )}
        {/* Team assignment badge */}
        <div
          className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-black text-white shadow-lg"
          style={{ backgroundColor: squadColor }}
        >
          <span>→ {squadName}</span>
        </div>
      </div>
    </div>
  );
}

// ── Squad columns (live roster) ───────────────────────────────────────────────

function SquadRoster({ squads, assignments }: {
  squads: SquadView[];
  assignments: { registrationId: string; displayName: string; squadId: string }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {squads.map((squad, i) => {
        const myAssignments = assignments.filter((a) => a.squadId === squad.id);
        const total = squad.memberCount + myAssignments.length;
        return (
          <div
            key={squad.id}
            className="rounded-2xl border border-white/10 bg-white/5 p-3"
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: squadAccent(i) }}
              />
              <span className="text-sm font-bold text-white">{squad.name}</span>
              <span className="ml-auto text-xs text-white/40">{total}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {squad.members.map((m) => (
                <span
                  key={m.registrationId}
                  className="rounded-lg bg-white/10 px-2 py-0.5 text-xs text-white/70"
                >
                  {m.displayName}
                </span>
              ))}
              {myAssignments.map((a) => (
                <NewMemberPill key={a.registrationId} name={a.displayName} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NewMemberPill({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(
      ref.current,
      { scale: 0.5, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.7)" },
    );
  }, []);
  return (
    <span
      ref={ref}
      className="rounded-lg bg-white/25 px-2 py-0.5 text-xs font-semibold text-white"
    >
      {name}
    </span>
  );
}

// ── Confetti ──────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ["#4F6BF6", "#34D399", "#F43F5E", "#FBBF24", "#F472B6", "#FB923C", "#FFFDF5"];

/** Full-screen react-confetti used at draft-complete screen. */
function Confetti() {
  const [run, setRun] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setRun(false), 6000);
    return () => clearTimeout(t);
  }, []);
  return (
    <ReactConfetti
      className="pointer-events-none fixed inset-0 z-[55]"
      colors={CONFETTI_COLORS}
      numberOfPieces={run ? 220 : 0}
      recycle={false}
      gravity={0.18}
    />
  );
}

/**
 * Per-pick confetti burst — full-screen react-confetti that fires on each spin.
 * `burstKey` increments each pick; key prop forces remount → fresh animation.
 */
function WinnerBurst({ burstKey }: { burstKey: number }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (burstKey === 0) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), 3500);
    return () => clearTimeout(t);
  }, [burstKey]);

  if (!active) return null;
  return (
    <ReactConfetti
      key={burstKey}
      className="pointer-events-none fixed inset-0 z-[55]"
      colors={CONFETTI_COLORS}
      numberOfPieces={180}
      recycle={false}
      gravity={0.25}
      initialVelocityY={18}
    />
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
    if (!containerRef.current) return;
    gsap.fromTo(
      containerRef.current.children,
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, stagger: 0.12, ease: "power2.out" },
    );
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
      <div ref={containerRef} className="flex flex-col items-center gap-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 text-5xl shadow-2xl">
          🎯
        </div>
        <div>
          <h1 className="text-5xl font-black text-white">Draft Ceremony</h1>
          <p className="mt-2 text-lg text-white/60">
            {totalUnassigned} players · {squads.length} teams
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {squads.map((s, i) => (
            <span
              key={s.id}
              className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold text-white"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: squadAccent(i) }} />
              {s.name}
            </span>
          ))}
        </div>
        <Button
          onClick={onStart}
          className="mt-4 h-14 px-10 text-lg font-black shadow-2xl"
          tone="candy"
          size="lg"
        >
          Begin Draft
          <ChevronRight className="h-5 w-5" />
        </Button>
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
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;
    gsap.fromTo(
      containerRef.current.children,
      { y: 40, opacity: 0, scale: 0.9 },
      { y: 0, opacity: 1, scale: 1, duration: 0.7, stagger: 0.15, ease: "back.out(1.4)" },
    );
    const t = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {showConfetti && <Confetti />}
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
        <div ref={containerRef} className="flex w-full max-w-2xl flex-col items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 text-5xl shadow-2xl">
            🏆
          </div>
          <div className="text-center">
            <h1 className="text-4xl font-black text-white">Draft Complete!</h1>
            <p className="mt-2 text-white/60">All players assigned to teams</p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2">
            {squads.map((squad, i) => {
              const newOnes = sessionAssignments.filter((a) => a.squadId === squad.id);
              const total = squad.memberCount + newOnes.length;
              return (
                <div
                  key={squad.id}
                  className="rounded-2xl border border-white/15 bg-white/8 p-4"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: squadAccent(i) }} />
                    <span className="font-bold text-white">{squad.name}</span>
                    <span className="ml-auto text-sm text-white/40">{total} players</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {squad.members.map((m) => (
                      <span key={m.registrationId} className="rounded-lg bg-white/10 px-2 py-0.5 text-xs text-white/60">
                        {m.displayName}
                      </span>
                    ))}
                    {newOnes.map((a) => (
                      <span key={a.registrationId} className="rounded-lg bg-white/25 px-2 py-0.5 text-xs font-semibold text-white">
                        {a.displayName}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-3">
            <Link href={`/console/tournaments/${tournamentId}/teams`}>
              <Button tone="paper" className="border-white/20 text-white hover:bg-white/10">
                Back to Teams
              </Button>
            </Link>
            <Link href={`/console/tournaments/${tournamentId}/draws`}>
              <Button tone="candy">
                <Trophy className="h-4 w-4" />
                Continue to Draws
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main ceremony screen ──────────────────────────────────────────────────────

type SpinPhase = "idle" | "spinning" | "revealing";

interface RevealInfo {
  playerName: string;
  skillLevel: string | null;
  squadName: string;
  squadColor: string;
}

function MainScreen({
  squads,
  pool,
  skillGroups,
  resolvedSkill,
  totalRemaining,
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
  isAssigning: boolean;
  history: { registrationId: string; displayName: string; squadId: string }[];
  currentSquad: SquadView | undefined;
  onAssign: (player: UnassignedRegistrationView, squadId?: string) => Promise<import("@/features/squads/components/draft-ceremony/use-ceremony").Assignment | null>;
  onUndo: () => void;
  onChangeSkill: (skill: string | null) => void;
}) {
  const wheelRef = useRef<WheelHandle>(null);
  const [spinPhase, setSpinPhase]           = useState<SpinPhase>("idle");
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [revealInfo, setRevealInfo]         = useState<RevealInfo | null>(null);
  const [burstKey, setBurstKey]             = useState(0);

  const currentSquadIdx = squads.findIndex((s) => s.id === currentSquad?.id);
  const canSpin = spinPhase === "idle" && pool.length > 0 && !isAssigning;

  async function handleSpin() {
    if (!canSpin || !wheelRef.current || !currentSquad) return;
    const idx = Math.floor(Math.random() * pool.length);
    setSpinPhase("spinning");
    setHighlightIndex(null);

    await wheelRef.current.spin(idx);

    const player = pool[idx];
    if (!player) { setSpinPhase("idle"); return; }

    // Auto-assign to the current team immediately
    const result = await onAssign(player);
    if (!result) { setSpinPhase("idle"); return; }

    // Confetti + fanfare
    setBurstKey((k) => k + 1);
    playFanfare();

    setHighlightIndex(idx);
    setRevealInfo({
      playerName: result.displayName,
      skillLevel: result.skillLevel,
      squadName:  result.squadName,
      squadColor: squadAccent(squads.findIndex((s) => s.id === result.squadId)),
    });
    setSpinPhase("revealing");
  }

  const handleRevealDone = useCallback(() => {
    setRevealInfo(null);
    setHighlightIndex(null);
    setSpinPhase("idle");
  }, []);

  const poolEmpty = pool.length === 0 && totalRemaining > 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Skill tabs + remaining count */}
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-3">
        <div className="flex items-center gap-3">
          {skillGroups.length > 1 &&
            skillGroups.map((s) => (
              <button
                key={s ?? "__null__"}
                onClick={() => { onChangeSkill(s); setSpinPhase("idle"); setHighlightIndex(null); }}
                className={[
                  "rounded-full px-3 py-1 text-xs font-bold transition-all",
                  resolvedSkill === s
                    ? "bg-white text-gray-900"
                    : "border border-white/20 text-white/60 hover:text-white",
                ].join(" ")}
              >
                {skillLabel(s)}
              </button>
            ))}
        </div>
        <span className="text-sm text-white/50">{totalRemaining} remaining</span>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex flex-1 flex-col items-center justify-center gap-4 p-6">

          {/* "Now picking for" banner — shown when idle/spinning */}
          {currentSquad && spinPhase !== "revealing" && (
            <div
              className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-black text-white shadow-lg"
              style={{ backgroundColor: squadAccent(currentSquadIdx) }}
            >
              <span className="opacity-75">Now picking for</span>
              <span>{currentSquad.name}</span>
            </div>
          )}

          <WinnerBurst burstKey={burstKey} />

          {poolEmpty ? (
            <div className="text-center">
              <p className="text-lg font-bold text-white">All {skillLabel(resolvedSkill)} players assigned</p>
              <p className="mt-1 text-sm text-white/50">Switch skill group or you&apos;re done!</p>
            </div>
          ) : (
            <>
              <CeremonyWheel ref={wheelRef} players={pool} highlightIndex={highlightIndex} />

              <div className="flex flex-col items-center gap-2">
                <Button
                  onClick={handleSpin}
                  disabled={!canSpin}
                  tone="candy"
                  size="lg"
                  className="h-14 w-52 text-lg font-black shadow-xl"
                >
                  {spinPhase === "spinning" ? "Spinning…" : spinPhase === "revealing" ? "Assigned!" : "🎯  Spin!"}
                </Button>

                {history.length > 0 && spinPhase === "idle" && (
                  <button
                    onClick={onUndo}
                    className="flex items-center gap-1 text-xs text-white/40 transition-colors hover:text-white/70"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Undo last pick
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Roster sidebar */}
        <div className="hidden w-72 flex-shrink-0 overflow-y-auto border-l border-white/10 p-4 lg:block" style={{ background: "#28324A" }}>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-white/40">Teams</p>
          <SquadRoster squads={squads} assignments={history} />
        </div>
      </div>

      {revealInfo && (
        <RevealOverlay
          playerName={revealInfo.playerName}
          skillLevel={revealInfo.skillLevel}
          squadName={revealInfo.squadName}
          squadColor={revealInfo.squadColor}
          onDone={handleRevealDone}
        />
      )}
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────

export function DraftCeremonyShell({ tournamentId }: { tournamentId: string }) {
  const ceremony = useCeremony(tournamentId);

  if (ceremony.isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p className="text-sm text-white/50">Loading ceremony…</p>
        </div>
      </div>
    );
  }

  if (ceremony.isError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950 text-white">
        <p className="text-white/60">Failed to load teams data.</p>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "#1E293B" }}
    >
      {/* Nav bar */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <Link
          href={`/console/tournaments/${tournamentId}/teams`}
          className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Teams
        </Link>
        <span className="text-white/20">/</span>
        <span className="text-sm font-semibold text-white/70">Draft Ceremony</span>
        {ceremony.phase === "main" && (
          <>
            <span className="text-white/20">·</span>
            <span className="text-sm text-white/40">{ceremony.totalRemaining} unassigned</span>
          </>
        )}
      </div>

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
