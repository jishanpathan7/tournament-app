"use client";

import type { MatchView, ParticipantResponse } from "@tournament/api-client";
import { ArrowLeft, Check, Flag, Minus, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TeamBadge } from "@/components/ui/team-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { Spinner } from "@/components/ui/spinner";
import { MATCH_STATUS } from "@/features/draws/config";
import {
  buildScorePayload,
  type GameScore,
  type ScoreFormValues,
  validateScoreForm,
} from "@/features/matches/config";
import {
  classifyGame,
  formatMatchRules,
  gameStatusIndicator,
  resolveTiedGame,
  rulesFromSportConfig,
  type BadmintonRules,
  type GameSide,
} from "@/features/matches/badminton-scoring";
import * as scoringApi from "@/features/scoring/scoring-api";
import { useScoreMatch } from "@/features/scoring/use-matches";
import {
  useTournamentMatches,
  useTournamentParticipants,
} from "@/features/matches/use-tournament-matches";
import { useTournament } from "@/features/tournaments/use-tournaments";
import { ApiError, errorMessage } from "@/lib/problem";
import { cn } from "@/lib/utils";

function sideLabel(
  match: MatchView,
  side: 0 | 1,
  participantsById: Map<string, ParticipantResponse>,
) {
  const id = match.sides[side]?.participantId;
  return participantsById.get(id ?? "")?.displayName ?? `Side ${side + 1}`;
}

function gamesWon(games: GameScore[], side: keyof GameScore) {
  const other: keyof GameScore = side === "a" ? "b" : "a";
  return games.filter((g) => (g[side] ?? 0) > (g[other] ?? 0)).length;
}

function majority(bestOf: number) {
  return Math.floor(bestOf / 2) + 1;
}

function emptyLiveGame(): GameScore {
  return { a: 0, b: 0 };
}

/** Court-side tap scoring — large +/- buttons per side, game tabs, submits via the same
 * score API as the desktop Match Center form. */
export function MobileScorekeeper({ tournamentId }: { tournamentId: string }) {
  const tournament = useTournament(tournamentId);
  const matches = useTournamentMatches(tournamentId);
  const participants = useTournamentParticipants(tournamentId);
  const participantsById = useMemo(
    () => new Map((participants.data ?? []).map((p) => [p.id, p])),
    [participants.data],
  );

  const scorable = useMemo(
    () => (matches.data ?? []).filter((m) => ["scheduled", "live", "pending"].includes(m.status)),
    [matches.data],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = scorable.find((m) => m.id === selectedId) ?? null;

  if (selected) {
    return (
      <MobileScorekeeperMatch
        match={selected}
        tournamentId={tournamentId}
        participantsById={participantsById}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col gap-4 px-4 py-6">
      <Button asChild tone="ghost" size="sm" className="-ml-2 self-start">
        <Link href={`/console/tournaments/${tournamentId}/matches`}>
          <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
          Matches
        </Link>
      </Button>
      <div>
        <p className="label text-muted-foreground">Scorekeeper</p>
        <h1 className="font-serif text-2xl font-bold">{tournament.data?.name ?? "Tournament"}</h1>
        <p className="text-muted-foreground mt-1 text-sm">Tap a match to score at the court.</p>
      </div>
      {matches.isLoading ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : scorable.length === 0 ? (
        <p className="text-muted-foreground rounded-2xl border-2 border-dashed p-8 text-center text-sm">
          No matches ready to score right now.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {scorable.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setSelectedId(m.id)}
                className="border-ink bg-card shadow-sticker hover:shadow-sticker-sm w-full rounded-2xl border-2 p-4 text-left transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap gap-1">
                      <TeamBadge
                        teamName={participantsById.get(m.sides[0]?.participantId ?? "")?.teamName}
                      />
                      <TeamBadge
                        teamName={participantsById.get(m.sides[1]?.participantId ?? "")?.teamName}
                      />
                    </div>
                    <p className="font-semibold">
                      {sideLabel(m, 0, participantsById)} vs {sideLabel(m, 1, participantsById)}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {m.roundLabel ?? "Match"}
                      {m.courtId ? ` · Court ${m.courtId.slice(0, 8)}` : ""}
                    </p>
                  </div>
                  <Badge tone={MATCH_STATUS[m.status]?.tone ?? "muted"}>
                    {MATCH_STATUS[m.status]?.label ?? m.status}
                  </Badge>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MobileScorekeeperMatch({
  match,
  tournamentId,
  participantsById,
  onBack,
}: {
  match: MatchView;
  tournamentId: string;
  participantsById: Map<string, ParticipantResponse>;
  onBack: () => void;
}) {
  const rules: BadmintonRules = rulesFromSportConfig(match.sportConfig);
  const gamesRequired = majority(rules.bestOf);

  const [completedGames, setCompletedGames] = useState<GameScore[]>([]);
  const [liveGame, setLiveGame] = useState<GameScore>(emptyLiveGame());
  const [activeGameIndex, setActiveGameIndex] = useState(0);
  const [etag, setEtag] = useState<string | null>(null);
  const [fetchingEtag, setFetchingEtag] = useState(true);
  const [walkoverOpen, setWalkoverOpen] = useState(false);
  const [tieOpen, setTieOpen] = useState(false);
  const score = useScoreMatch(match.id, tournamentId);

  useEffect(() => {
    let alive = true;
    setFetchingEtag(true);
    scoringApi.getMatchEtag(match.id).then((tag) => {
      if (alive) {
        setEtag(tag);
        setFetchingEtag(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [match.id]);

  const labelA = sideLabel(match, 0, participantsById);
  const labelB = sideLabel(match, 1, participantsById);
  const teamA = participantsById.get(match.sides[0]?.participantId ?? "")?.teamName ?? null;
  const teamB = participantsById.get(match.sides[1]?.participantId ?? "")?.teamName ?? null;
  const winsA = gamesWon(completedGames, "a");
  const winsB = gamesWon(completedGames, "b");
  const matchDecided = winsA >= gamesRequired || winsB >= gamesRequired;

  const bump = (side: keyof GameScore, delta: number) => {
    setLiveGame((g) => {
      const next = Math.max(0, (g[side] ?? 0) + delta);
      return { ...g, [side]: next };
    });
  };

  const recordGame = (game: { a: number; b: number }) => {
    if (classifyGame(game.a, game.b, rules).status !== "complete") return;
    const nextGames = [...completedGames, game];
    setCompletedGames(nextGames);
    setLiveGame(emptyLiveGame());
    setActiveGameIndex(nextGames.length);
    toast.success(`Game ${nextGames.length} recorded`);
  };

  const submitGame = () => {
    const a = liveGame.a ?? 0;
    const b = liveGame.b ?? 0;
    const gameStatus = classifyGame(a, b, rules);
    if (gameStatus.status === "tied") {
      // Asking who won is the only way out of a tie — a toast telling the
      // scorekeeper to "resolve it" gave them nothing to act on.
      setTieOpen(true);
      return;
    }
    if (gameStatus.status !== "complete") {
      toast.error(gameStatus.message ?? "Game is not finished yet.");
      return;
    }
    recordGame({ a, b });
  };

  /** Turn a tie into a legal final line — at 14-all under 15-point rules the game
   * actually ends 16-14, which the scorekeeper shouldn't have to work out. */
  const resolveTie = (winner: GameSide) => {
    const a = liveGame.a ?? 0;
    const status = classifyGame(a, liveGame.b ?? 0, rules);
    if (status.status !== "tied") return;
    const resolved = resolveTiedGame(status.score, winner, rules);
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

  const submitWalkover = (side: 0 | 1) => {
    score.mutate(
      {
        payload: buildScorePayload({
          resultType: "walkover",
          games: [],
          winnerSide: side,
          retiredSide: null,
        }),
        ifMatch: etag,
      },
      {
        onSuccess: () => {
          toast.success("Walkover recorded");
          setWalkoverOpen(false);
          onBack();
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 412) {
            toast.error("Score changed elsewhere — reopen this match.");
            return;
          }
          toast.error(errorMessage(err));
        },
      },
    );
  };

  const submitMatch = () => {
    const values: ScoreFormValues = {
      resultType: "normal",
      games: completedGames,
      winnerSide: null,
      retiredSide: null,
    };
    const validation = validateScoreForm(values);
    if (validation) {
      toast.error(validation);
      return;
    }
    score.mutate(
      { payload: buildScorePayload(values), ifMatch: etag },
      {
        onSuccess: () => {
          toast.success("Match result saved");
          onBack();
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 412) {
            toast.error("Score changed elsewhere — reopen this match.");
            return;
          }
          toast.error(errorMessage(err));
        },
      },
    );
  };

  return (
    <div className="mx-auto flex min-h-[90vh] max-w-md flex-col">
      <div className="border-ink flex items-center gap-3 border-b-2 px-4 py-3">
        <Button type="button" tone="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {labelA} vs {labelB}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {match.roundLabel ?? "Live match"}
          </p>
        </div>
        <Badge tone="candy">Live</Badge>
      </div>

      <div className="flex gap-1 px-4 pt-3">
        {Array.from({ length: rules.bestOf }, (_, i) => {
          const done = completedGames[i];
          const active = i === activeGameIndex && !matchDecided;
          return (
            <div
              key={i}
              className={cn(
                "border-ink flex-1 rounded-t-lg border-2 border-b-0 px-2 py-2 text-center font-mono text-xs font-bold",
                active ? "bg-card" : "bg-muted text-muted-foreground",
                !done && !active && "opacity-40",
              )}
            >
              G{i + 1}
              {done ? ` · ${done.a}–${done.b}` : ""}
            </div>
          );
        })}
      </div>

      {/* What the current score means under this division's rules — deuce, the golden
          point, or how far off a finish still is. Without it the scorekeeper only
          finds out at "Submit game". */}
      {(() => {
        const a = liveGame.a ?? 0;
        const b = liveGame.b ?? 0;
        const indicator = gameStatusIndicator(a, b, rules);
        if (indicator) {
          return (
            <div
              className={cn(
                "border-ink -mb-[2px] border-x-2 px-3 py-1.5 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em]",
                indicator === "next_point_wins"
                  ? "bg-candy-tint text-candy-dark"
                  : "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
              )}
            >
              {indicator === "next_point_wins" ? "⚡ Next point wins" : "Deuce"}
            </div>
          );
        }
        const verdict = classifyGame(a, b, rules);
        const hint =
          verdict.status === "in_progress" || verdict.status === "invalid"
            ? verdict.message
            : verdict.status === "tied"
              ? "Tied — one side has to go ahead."
              : null;
        return (
          <p className="text-muted-foreground px-4 pb-1 text-center text-[11px]">
            {hint ?? formatMatchRules(rules)}
          </p>
        );
      })()}

      <div className="border-ink grid flex-1 grid-cols-2 border-y-2">
        <ScoreSide
          label={labelA}
          teamName={teamA}
          score={liveGame.a ?? 0}
          onMinus={() => bump("a", -1)}
          onPlus={() => bump("a", 1)}
          accent
        />
        <ScoreSide
          label={labelB}
          teamName={teamB}
          score={liveGame.b ?? 0}
          onMinus={() => bump("b", -1)}
          onPlus={() => bump("b", 1)}
        />
      </div>

      <div className="flex flex-col gap-3 p-4">
        {!matchDecided ? (
          <Button type="button" tone="mint" size="lg" className="w-full" onClick={submitGame}>
            <Check className="h-5 w-5" />
            Submit game
          </Button>
        ) : (
          <Button
            type="button"
            tone="mint"
            size="lg"
            className="w-full"
            disabled={score.isPending || fetchingEtag}
            onClick={submitMatch}
          >
            {score.isPending ? <Spinner className="h-5 w-5" /> : <Check className="h-5 w-5" />}
            Complete match ({winsA}–{winsB})
          </Button>
        )}
        <div className="flex gap-3">
          <Button
            type="button"
            tone="paper"
            className="flex-1"
            onClick={undoGame}
            disabled={completedGames.length === 0}
          >
            <RotateCcw className="h-4 w-4" />
            Undo
          </Button>
          <Button
            type="button"
            tone="pink"
            className="flex-1"
            onClick={() => setWalkoverOpen(true)}
          >
            <Flag className="h-4 w-4" />
            Walkover
          </Button>
        </div>
        <p className="text-muted-foreground text-center font-mono text-[10px] uppercase tracking-wider">
          Saved when you complete the match
        </p>
      </div>

      <Dialog open={tieOpen} onOpenChange={setTieOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Who won this game?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Tied at {liveGame.a ?? 0}–{liveGame.b ?? 0}. Pick the winner and we&apos;ll write the
            final score the rules allow.
          </p>
          <div className="flex gap-3 pt-2">
            <Button tone="candy" className="flex-1" onClick={() => resolveTie("a")}>
              {labelA}
            </Button>
            <Button tone="candy" className="flex-1" onClick={() => resolveTie("b")}>
              {labelB}
            </Button>
          </div>
          <Button tone="ghost" size="sm" onClick={() => setTieOpen(false)}>
            Keep scoring
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={walkoverOpen} onOpenChange={setWalkoverOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record walkover</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Which side wins by walkover? The other side forfeits.
          </p>
          <div className="flex gap-3 pt-2">
            <Button
              tone="candy"
              className="flex-1"
              disabled={score.isPending}
              onClick={() => submitWalkover(0)}
            >
              {score.isPending ? <Spinner className="h-4 w-4" /> : null}
              {labelA}
            </Button>
            <Button
              tone="candy"
              className="flex-1"
              disabled={score.isPending}
              onClick={() => submitWalkover(1)}
            >
              {score.isPending ? <Spinner className="h-4 w-4" /> : null}
              {labelB}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScoreSide({
  label,
  teamName,
  score,
  onMinus,
  onPlus,
  accent,
}: {
  label: string;
  teamName?: string | null;
  score: number;
  onMinus: () => void;
  onPlus: () => void;
  accent?: boolean;
}) {
  return (
    <div className="border-ink flex flex-col items-center gap-4 border-r-2 p-4 last:border-r-0">
      <div className="flex flex-col items-center gap-1 text-center">
        <TeamBadge teamName={teamName} />
        <h2 className="font-serif text-lg font-semibold">{label}</h2>
      </div>
      <div
        className={cn(
          "border-ink shadow-sticker w-full rounded-2xl border-2 py-6 text-center",
          accent && "bg-lavender",
        )}
      >
        <span className="font-mono text-5xl font-bold tabular-nums">{score}</span>
      </div>
      <div className="flex gap-4">
        <button
          type="button"
          aria-label={`Minus ${label}`}
          onClick={onMinus}
          className="border-ink shadow-sticker-sm bg-card grid h-16 w-16 place-items-center rounded-full border-2 text-2xl font-bold active:translate-x-0.5 active:translate-y-0.5"
        >
          <Minus className="h-6 w-6" />
        </button>
        <button
          type="button"
          aria-label={`Plus ${label}`}
          onClick={onPlus}
          className="border-ink bg-violet shadow-sticker-sm grid h-16 w-16 place-items-center rounded-full border-2 text-2xl font-bold text-white active:translate-x-0.5 active:translate-y-0.5"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
