"use client";

import { Check, Flag, Minus, Plus, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { TeamBadge } from "@/components/ui/team-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { Spinner } from "@/components/ui/spinner";
import {
  BADMINTON_DEFAULTS,
  classifyGame,
  formatMatchRules,
  gameStatusIndicator,
  gamesWonBySide,
  matchDecided,
  resolveTiedGame,
  type BadmintonRules,
  type GameSide,
} from "@/features/matches/badminton-scoring";
import {
  buildScorePayload,
  type GameScore,
  type ScoreFormValues,
  validateScoreForm,
} from "@/features/matches/config";
import { cn } from "@/lib/utils";

const DEFAULT_RULES = BADMINTON_DEFAULTS;

function emptyLiveGame(): GameScore {
  return { a: 0, b: 0 };
}

/** Mobile court-side tap scoring — layout matches scorekeeper-mobile mockup. */
export function CourtScorekeeperPanel({
  labelA,
  labelB,
  teamA,
  teamB,
  rules = DEFAULT_RULES,
  submitting,
  fetchingEtag,
  onSubmit,
  onComplete,
  onScoringStart,
}: {
  labelA: string;
  labelB: string;
  teamA?: string | null;
  teamB?: string | null;
  rules?: BadmintonRules;
  submitting: boolean;
  fetchingEtag: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onComplete?: () => void;
  /** Called once when the first point is entered — marks the match live on court. */
  onScoringStart?: () => void;
}) {
  const [completedGames, setCompletedGames] = useState<GameScore[]>([]);
  const [liveGame, setLiveGame] = useState<GameScore>(emptyLiveGame());
  const [activeGameIndex, setActiveGameIndex] = useState(0);
  const [walkoverOpen, setWalkoverOpen] = useState(false);
  const [tieOpen, setTieOpen] = useState(false);
  const scoringStartedRef = useRef(false);

  const winsA = gamesWonBySide(completedGames as { a: number; b: number }[], "a");
  const winsB = gamesWonBySide(completedGames as { a: number; b: number }[], "b");
  const decided = matchDecided(completedGames as { a: number; b: number }[], rules);

  const a = liveGame.a ?? 0;
  const b = liveGame.b ?? 0;
  const liveStatus = useMemo(() => classifyGame(a, b, rules), [a, b, rules]);

  const bump = (side: GameSide, delta: number) => {
    setLiveGame((g) => {
      const prevA = g.a ?? 0;
      const prevB = g.b ?? 0;
      const next = Math.max(0, Math.min(rules.maxPoints, (g[side] ?? 0) + delta));
      if (!scoringStartedRef.current && onScoringStart && prevA === 0 && prevB === 0 && next > 0) {
        scoringStartedRef.current = true;
        onScoringStart();
      }
      return { ...g, [side]: next };
    });
  };

  const recordGame = (game: GameScore) => {
    const ga = game.a ?? 0;
    const gb = game.b ?? 0;
    if (classifyGame(ga, gb, rules).status !== "complete") return;

    const nextGames = [...completedGames, { a: ga, b: gb }];
    setCompletedGames(nextGames);
    setLiveGame(emptyLiveGame());
    setActiveGameIndex(nextGames.length);
    toast.success(`Game ${nextGames.length} recorded`);
  };

  const submitGame = () => {
    if (liveStatus.status === "complete") {
      recordGame(liveGame);
      return;
    }
    if (liveStatus.status === "tied") {
      setTieOpen(true);
      return;
    }
    if (liveStatus.status === "in_progress" || liveStatus.status === "invalid") {
      toast.error(liveStatus.message);
    }
  };

  const resolveTie = (winner: GameSide) => {
    if (liveStatus.status !== "tied") return;
    const resolved = resolveTiedGame(liveStatus.score, winner, rules);
    if (!resolved) {
      toast.error("Couldn't resolve this tie.");
      return;
    }
    setTieOpen(false);
    recordGame(resolved);
  };

  const undoGame = () => {
    if (completedGames.length === 0) return;
    const restored = completedGames[completedGames.length - 1]!;
    setCompletedGames((g) => g.slice(0, -1));
    setLiveGame(restored);
    setActiveGameIndex(Math.max(0, completedGames.length - 1));
  };

  const submitMatch = async (values: ScoreFormValues) => {
    const validation = validateScoreForm(values);
    if (validation) {
      toast.error(validation);
      return;
    }
    await onSubmit(buildScorePayload(values));
    onComplete?.();
  };

  const submitWalkover = async (winnerSide: 0 | 1) => {
    setWalkoverOpen(false);
    await submitMatch({
      resultType: "walkover",
      games: [],
      winnerSide,
      retiredSide: null,
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Game tabs — flush with scoreboard below */}
      <div className="flex px-0">
        {Array.from({ length: rules.bestOf }, (_, i) => {
          const done = completedGames[i];
          const active = i === activeGameIndex && !decided;
          const future = !done && !active;
          return (
            <div
              key={i}
              className={cn(
                "border-ink flex-1 border-2 border-b-0 py-2.5 text-center font-mono text-[11px] font-bold leading-tight",
                i === 0 && "rounded-tl-xl",
                i === rules.bestOf - 1 && "rounded-tr-xl",
                i > 0 && "-ml-[2px]",
                active && "bg-card relative z-10",
                done && !active && "bg-card text-muted-foreground",
                future && "bg-muted/40 text-muted-foreground/45",
              )}
            >
              G{i + 1}
              {done ? (
                <>
                  <span className="text-muted-foreground/60"> · </span>
                  {done.a}-{done.b}
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Deuce / Next-point-wins indicator */}
      {(() => {
        const indicator = gameStatusIndicator(a, b, rules);
        if (!indicator) return null;
        return (
          <div
            className={cn(
              "border-ink -mt-[2px] border-x-2 px-3 py-1.5 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em]",
              indicator === "next_point_wins"
                ? "bg-candy-tint text-candy-dark"
                : "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
            )}
          >
            {indicator === "next_point_wins" ? "⚡ Next point wins" : "Deuce"}
          </div>
        );
      })()}

      {/* Split scoreboard */}
      <div className="border-ink grid min-h-0 flex-1 grid-cols-2 border-2">
        <ScoreSide
          role="SERVER"
          label={labelA}
          teamName={teamA}
          score={a}
          onMinus={() => bump("a", -1)}
          onPlus={() => bump("a", 1)}
          maxPoints={rules.maxPoints}
          accent
        />
        <ScoreSide
          role="RECEIVER"
          label={labelB}
          teamName={teamB}
          score={b}
          onMinus={() => bump("b", -1)}
          onPlus={() => bump("b", 1)}
          maxPoints={rules.maxPoints}
        />
      </div>

      {/* Bottom actions */}
      <div className="mt-auto flex flex-col gap-3 px-4 pb-5 pt-4">
        {!decided ? (
          <Button
            type="button"
            tone="mint"
            size="lg"
            className="shadow-sticker h-14 w-full rounded-full text-base"
            onClick={submitGame}
          >
            <Check className="h-5 w-5" strokeWidth={2.5} />
            Submit game
          </Button>
        ) : (
          <Button
            type="button"
            tone="mint"
            size="lg"
            className="shadow-sticker h-14 w-full rounded-full text-base"
            disabled={submitting || fetchingEtag}
            onClick={() =>
              void submitMatch({
                resultType: "normal",
                games: completedGames,
                winnerSide: null,
                retiredSide: null,
              })
            }
          >
            {submitting ? (
              <Spinner className="h-5 w-5" />
            ) : (
              <Check className="h-5 w-5" strokeWidth={2.5} />
            )}
            Complete match ({winsA}–{winsB})
          </Button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            tone="paper"
            className="shadow-sticker h-12 rounded-full"
            disabled={submitting}
            onClick={() => setWalkoverOpen(true)}
          >
            <Flag className="h-4 w-4" strokeWidth={2.25} />
            Walkover
          </Button>
          <Button
            type="button"
            tone="paper"
            className="shadow-sticker h-12 rounded-full"
            onClick={undoGame}
            disabled={completedGames.length === 0}
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2.25} />
            Undo
          </Button>
        </div>

        <p className="text-muted-foreground/80 pt-1 text-center font-mono text-[10px] uppercase tracking-[0.18em]">
          Saved automatically · syncs when online
        </p>
      </div>

      <Dialog open={tieOpen} onOpenChange={setTieOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Resolve tie</DialogTitle>
            <DialogDescription>
              Tied at {a}-{b}. Who won this game?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button type="button" tone="paper" onClick={() => resolveTie("a")}>
              {labelA} won
            </Button>
            <Button type="button" tone="paper" onClick={() => resolveTie("b")}>
              {labelB} won
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" tone="ghost" size="sm" onClick={() => setTieOpen(false)}>
              Keep scoring
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={walkoverOpen} onOpenChange={setWalkoverOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Walkover</DialogTitle>
            <DialogDescription>Which side wins by walkover?</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              tone="paper"
              onClick={() => void submitWalkover(0)}
              disabled={submitting}
            >
              {labelA}
            </Button>
            <Button
              type="button"
              tone="paper"
              onClick={() => void submitWalkover(1)}
              disabled={submitting}
            >
              {labelB}
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" tone="ghost" size="sm" onClick={() => setWalkoverOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScoreSide({
  role,
  label,
  teamName,
  score,
  onMinus,
  onPlus,
  maxPoints,
  accent,
}: {
  role: "SERVER" | "RECEIVER";
  label: string;
  teamName?: string | null;
  score: number;
  onMinus: () => void;
  onPlus: () => void;
  maxPoints: number;
  accent?: boolean;
}) {
  return (
    <div className="border-ink flex flex-col items-center justify-center gap-6 border-r-2 px-3 py-8 last:border-r-0">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="label text-muted-foreground mb-2 flex items-center justify-center gap-1.5 text-[10px] tracking-[0.16em]">
          {role === "SERVER" ? (
            <span className="bg-mint ring-ink inline-block h-2 w-2 animate-pulse rounded-full ring-2" />
          ) : null}
          {role}
        </p>
        <TeamBadge teamName={teamName} />
        <h2 className="font-serif text-[1.35rem] font-semibold leading-tight">{label}</h2>
      </div>

      <div
        className={cn(
          "border-ink shadow-sticker w-full max-w-[148px] rounded-2xl border-2 py-9 text-center",
          accent ? "bg-candy-tint" : "bg-card",
        )}
      >
        <span className="font-mono text-[4.25rem] font-bold tabular-nums leading-none">
          {score}
        </span>
      </div>

      <div className="flex gap-3.5">
        <ScoreButton
          label={`Minus ${label}`}
          onClick={onMinus}
          disabled={score <= 0}
          variant="minus"
        />
        <ScoreButton
          label={`Plus ${label}`}
          onClick={onPlus}
          disabled={score >= maxPoints}
          variant="plus"
        />
      </div>
    </div>
  );
}

function ScoreButton({
  label,
  onClick,
  disabled,
  variant,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant: "minus" | "plus";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "border-ink ease-bouncy grid h-[4.25rem] w-[4.25rem] place-items-center rounded-full border-2 text-2xl font-bold transition-[transform,box-shadow] duration-150 active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-35",
        variant === "minus"
          ? "bg-card shadow-sticker-sm active:shadow-none"
          : "bg-candy shadow-sticker-sm text-white active:shadow-none",
      )}
    >
      {variant === "minus" ? (
        <Minus className="h-7 w-7" strokeWidth={2.75} />
      ) : (
        <Plus className="h-7 w-7" strokeWidth={2.75} />
      )}
    </button>
  );
}

/** Hook wrapper to fetch etag once on mount. */
export function useScorekeeperEtag(fetchEtag: () => Promise<string | null>) {
  const [etag, setEtag] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  useEffect(() => {
    let alive = true;
    setFetching(true);
    fetchEtag().then((tag) => {
      if (alive) {
        setEtag(tag);
        setFetching(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [fetchEtag]);
  return { etag, fetchingEtag: fetching, setEtag };
}

export function buildScorekeeperMeta(
  courtName?: string | null,
  rules: BadmintonRules = DEFAULT_RULES,
) {
  const court = courtName?.trim() ? courtName.trim().toUpperCase() : null;
  const format = formatMatchRules(rules).toUpperCase();
  return [court, format].filter(Boolean).join(" · ");
}

export function buildScorekeeperTitle(
  groupName?: string | null,
  roundLabel?: string | null,
  fallback?: string,
) {
  const parts = [groupName, roundLabel].filter(Boolean);
  if (parts.length > 0) return parts.join(" · ");
  return fallback ?? "Live match";
}
