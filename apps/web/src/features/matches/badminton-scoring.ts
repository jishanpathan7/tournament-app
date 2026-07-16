/** Client-side badminton game rules — mirrors ``apps/api/app/sports/badminton.py`` for scorekeeper UX. */

export const BADMINTON_DEFAULTS = {
  bestOf: 3,
  pointsPerSet: 21,
  winBy: 2,
  maxPoints: 30,
} as const;

export type BadmintonRules = {
  bestOf: number;
  pointsPerSet: number;
  winBy: number;
  maxPoints: number;
};

/** Map API ``SportMatchConfigView`` (or partial) to client scoring rules. */
export function rulesFromSportConfig(
  config?: {
    bestOf?: number;
    pointsPerSet?: number;
    winBy?: number;
    maxPoints?: number;
  } | null,
): BadmintonRules {
  return {
    bestOf: config?.bestOf ?? BADMINTON_DEFAULTS.bestOf,
    pointsPerSet: config?.pointsPerSet ?? BADMINTON_DEFAULTS.pointsPerSet,
    winBy: config?.winBy ?? BADMINTON_DEFAULTS.winBy,
    maxPoints: config?.maxPoints ?? BADMINTON_DEFAULTS.maxPoints,
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
  const { pointsPerSet, winBy, maxPoints } = rules;

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

  if (hi > maxPoints) {
    return { status: "invalid", message: `Scores can't exceed ${maxPoints}.` };
  }
  if (hi < pointsPerSet) {
    return {
      status: "in_progress",
      message: `Someone must reach at least ${pointsPerSet} to finish the game.`,
    };
  }
  if (hi === pointsPerSet) {
    return margin >= winBy
      ? { status: "complete", winner }
      : {
          status: "in_progress",
          message: `Win by ${winBy} — keep scoring (e.g. ${pointsPerSet}-${pointsPerSet - 1} isn't enough).`,
        };
  }
  if (hi < maxPoints) {
    if (margin === winBy) return { status: "complete", winner };
    if (margin < winBy) {
      return {
        status: "in_progress",
        message: `Deuce — win by ${winBy} (e.g. ${hi + 1}-${lo} or ${hi + winBy}-${lo}).`,
      };
    }
    return { status: "invalid", message: `Illegal margin at ${a}-${b}.` };
  }
  // hi === maxPoints
  return lo >= maxPoints - winBy
    ? { status: "complete", winner }
    : { status: "invalid", message: `Illegal cap score ${a}-${b}.` };
}

/** After a tied score, umpire picks the game winner — produce a legal final line. */
export function resolveTiedGame(
  tiedScore: number,
  winner: GameSide,
  rules: BadmintonRules = BADMINTON_DEFAULTS,
): { a: number; b: number } | null {
  const { pointsPerSet, winBy, maxPoints } = rules;
  if (tiedScore < 0) return null;

  let win: number;
  let lose = tiedScore;

  if (tiedScore + winBy <= pointsPerSet) {
    win = pointsPerSet;
  } else {
    win = tiedScore + winBy;
    if (win > maxPoints) {
      win = maxPoints;
      lose = maxPoints - winBy;
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

/** Returns a live-game status indicator for UI display. */
export function gameStatusIndicator(
  a: number,
  b: number,
  rules: BadmintonRules = BADMINTON_DEFAULTS,
): "deuce" | "next_point_wins" | null {
  if (a !== b) return null;
  const { pointsPerSet, maxPoints, winBy } = rules;
  if (a >= maxPoints - winBy + 1 && a < maxPoints) return "next_point_wins";
  if (a >= pointsPerSet - winBy + 1) return "deuce";
  return null;
}

/** Human-readable match rules summary, e.g. "Best of 3 · First to 15 · Win by 2 · Cap 21" */
export function formatMatchRules(rules: BadmintonRules = BADMINTON_DEFAULTS): string {
  return `Best of ${rules.bestOf} · First to ${rules.pointsPerSet} · Win by ${rules.winBy} · Cap ${rules.maxPoints}`;
}
