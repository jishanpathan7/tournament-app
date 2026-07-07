/** Client-side badminton game rules — mirrors ``apps/api/app/sports/badminton.py`` for scorekeeper UX. */

export const BADMINTON_DEFAULTS = {
  bestOf: 3,
  pointsToWin: 21,
  winBy: 2,
  pointCap: 30,
} as const;

export type BadmintonRules = {
  bestOf: number;
  pointsToWin: number;
  winBy: number;
  pointCap: number;
};

/** Map API ``SportMatchConfigView`` (or partial) to client scoring rules. */
export function rulesFromSportConfig(
  config?: {
    bestOf?: number;
    pointsToWin?: number;
    winBy?: number;
    pointCap?: number;
  } | null,
): BadmintonRules {
  return {
    bestOf: config?.bestOf ?? BADMINTON_DEFAULTS.bestOf,
    pointsToWin: config?.pointsToWin ?? BADMINTON_DEFAULTS.pointsToWin,
    winBy: config?.winBy ?? BADMINTON_DEFAULTS.winBy,
    pointCap: config?.pointCap ?? BADMINTON_DEFAULTS.pointCap,
  };
}

export type GameSide = "a" | "b";

export type GameCompletion =
  | { status: "complete"; winner: GameSide }
  | { status: "tied"; score: number }
  | { status: "in_progress"; message: string }
  | { status: "invalid"; message: string };

/** Classify a single game's score (same rules as the backend sport profile). */
export function classifyGame(
  a: number,
  b: number,
  rules: BadmintonRules = BADMINTON_DEFAULTS,
): GameCompletion {
  const { pointsToWin, winBy, pointCap } = rules;

  if (a < 0 || b < 0) {
    return { status: "invalid", message: "Scores can't be negative." };
  }

  if (a === b) {
    if (a === 0) {
      return { status: "in_progress", message: "Enter scores for this game." };
    }
    return { status: "tied", score: a };
  }

  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  const winner: GameSide = a > b ? "a" : "b";
  const margin = hi - lo;

  if (hi > pointCap) {
    return { status: "invalid", message: `Scores can't exceed ${pointCap}.` };
  }
  if (hi < pointsToWin) {
    return {
      status: "in_progress",
      message: `Someone must reach at least ${pointsToWin} to finish the game.`,
    };
  }
  if (hi === pointsToWin) {
    return margin >= winBy
      ? { status: "complete", winner }
      : {
          status: "in_progress",
          message: `Win by ${winBy} — keep scoring (e.g. ${pointsToWin}-${pointsToWin - 1} isn't enough).`,
        };
  }
  if (hi < pointCap) {
    if (margin === winBy) return { status: "complete", winner };
    if (margin < winBy) {
      return {
        status: "in_progress",
        message: `Deuce — win by ${winBy} (e.g. ${hi + 1}-${lo} or ${hi + winBy}-${lo}).`,
      };
    }
    return { status: "invalid", message: `Illegal margin at ${a}-${b}.` };
  }
  // hi === pointCap
  return lo >= pointCap - winBy
    ? { status: "complete", winner }
    : { status: "invalid", message: `Illegal cap score ${a}-${b}.` };
}

/** After a tied score, umpire picks the game winner — produce a legal final line. */
export function resolveTiedGame(
  tiedScore: number,
  winner: GameSide,
  rules: BadmintonRules = BADMINTON_DEFAULTS,
): { a: number; b: number } | null {
  const { pointsToWin, winBy, pointCap } = rules;
  if (tiedScore < 0) return null;

  let win: number;
  let lose = tiedScore;

  if (tiedScore + winBy <= pointsToWin) {
    win = pointsToWin;
  } else {
    win = tiedScore + winBy;
    if (win > pointCap) {
      win = pointCap;
      lose = pointCap - winBy;
    }
  }

  return winner === "a" ? { a: win, b: lose } : { a: lose, b: win };
}

export function gamesWonBySide(games: { a: number; b: number }[], side: GameSide): number {
  const other: GameSide = side === "a" ? "b" : "a";
  return games.filter((g) => g[side] > g[other]).length;
}

export function matchDecided(
  games: { a: number; b: number }[],
  rules: BadmintonRules = BADMINTON_DEFAULTS,
): boolean {
  const majority = Math.floor(rules.bestOf / 2) + 1;
  return gamesWonBySide(games, "a") >= majority || gamesWonBySide(games, "b") >= majority;
}

export function decidingGameIndex(
  completedCount: number,
  games: { a: number; b: number }[],
  rules: BadmintonRules = BADMINTON_DEFAULTS,
): boolean {
  const winsA = gamesWonBySide(games, "a");
  const winsB = gamesWonBySide(games, "b");
  const majority = Math.floor(rules.bestOf / 2) + 1;
  return (
    completedCount === rules.bestOf - 1 &&
    winsA === winsB &&
    winsA === majority - 1 &&
    !matchDecided(games, rules)
  );
}
