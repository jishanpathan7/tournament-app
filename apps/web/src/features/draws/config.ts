import type { MatchView, StageResponse, TournamentResponse } from "@tournament/api-client";

import type { BadgeProps } from "@/components/ui/badge";

/**
 * Pure helpers for the draw generation workflow — readiness checks, status derivation,
 * and match grouping. No competition logic lives here: the engine already decided the
 * structure (matches/rounds/groups/byes) server-side; this only reads/labels/groups the
 * response for display.
 */

type Tone = NonNullable<BadgeProps["tone"]>;

// ---- readiness ----

export const MIN_PARTICIPANTS = 2;

export interface DrawReadiness {
  ready: boolean;
  approvedCount: number;
  /** Blocking — generation will fail (or is nonsensical) until these are resolved. */
  reasons: string[];
  /** Non-blocking — surfaced so the organizer can make an informed call before generating. */
  warnings: string[];
}

/** Mirrors the backend's own preconditions (`too_few_participants`, "already drawn") plus
 * generic, format-agnostic heads-ups — never re-derives the actual bracket/schedule shape. */
export function evaluateDrawReadiness(params: {
  approvedCount: number;
  format: string;
  alreadyDrawn: boolean;
}): DrawReadiness {
  const { approvedCount, format, alreadyDrawn } = params;
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (alreadyDrawn) {
    reasons.push("This stage already has a draw. Clear it before generating a new one.");
  }
  if (approvedCount < MIN_PARTICIPANTS) {
    reasons.push(
      `At least ${MIN_PARTICIPANTS} approved participants are required (currently ${approvedCount}).`,
    );
  }

  if (!alreadyDrawn && approvedCount >= MIN_PARTICIPANTS) {
    if (format === "single_elim" && (approvedCount & (approvedCount - 1)) !== 0) {
      warnings.push(
        "Single elimination brackets round up to the next power of two — some participants will get a first-round bye.",
      );
    }
    if (format === "round_robin" && approvedCount % 2 !== 0) {
      warnings.push("An odd number of participants means one player sits out each round.");
    }
  }

  return { ready: reasons.length === 0, approvedCount, reasons, warnings };
}

// ---- draw status ----

export interface DrawStatusFlags {
  generated: boolean;
  published: boolean;
  locked: boolean;
  live: boolean;
}

/** Every flag is read straight off already-persisted fields — no client-side inference of
 * "has this been scored" (that distinction is backend-only; see `StageResponse.locked`). */
export function drawStatusFlags(
  stage: Pick<StageResponse, "drawn" | "locked">,
  tournament: Pick<TournamentResponse, "drawPublishedAt" | "status">,
): DrawStatusFlags {
  return {
    generated: stage.drawn,
    published: !!tournament.drawPublishedAt,
    locked: stage.locked,
    live: tournament.status === "live",
  };
}

export const DRAW_STATUS_META: Record<keyof DrawStatusFlags, { label: string; tone: Tone }> = {
  generated: { label: "Generated", tone: "mint" },
  published: { label: "Published", tone: "candy" },
  locked: { label: "Locked", tone: "ink" },
  live: { label: "Live", tone: "pink" },
};

// ---- match grouping ----

export interface MatchGroup {
  key: string;
  label: string;
  seq: number;
  matches: MatchView[];
}

/** Groups matches by round (bracket columns / round-robin sections), ordered by `roundSeq`.
 * Matches without a round (shouldn't happen post-draw, but keeps this total) land last. */
export function groupMatchesByRound(matches: MatchView[]): MatchGroup[] {
  const groups = new Map<string, MatchGroup>();
  for (const match of matches) {
    const key = match.roundId ?? "unassigned";
    const existing = groups.get(key);
    if (existing) {
      existing.matches.push(match);
    } else {
      groups.set(key, {
        key,
        label: match.roundLabel ?? "Round",
        seq: match.roundSeq ?? Number.MAX_SAFE_INTEGER,
        matches: [match],
      });
    }
  }
  return [...groups.values()].sort((a, b) => a.seq - b.seq);
}

/** Groups matches by group/pool (round-robin groups stage), ordered by group name. */
export function groupMatchesByGroup(matches: MatchView[]): MatchGroup[] {
  const groups = new Map<string, MatchGroup>();
  for (const match of matches) {
    const key = match.groupId ?? "ungrouped";
    const existing = groups.get(key);
    if (existing) {
      existing.matches.push(match);
    } else {
      groups.set(key, {
        key,
        label: match.groupName ?? "All matches",
        seq: 0,
        matches: [match],
      });
    }
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

// ---- match status ----

export const MATCH_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "muted" },
  scheduled: { label: "Scheduled", tone: "candy" },
  live: { label: "Live", tone: "pink" },
  completed: { label: "Completed", tone: "mint" },
  walkover: { label: "Walkover", tone: "yellow" },
  no_show: { label: "No-show", tone: "yellow" },
  cancelled: { label: "Cancelled", tone: "muted" },
};

export function matchStatusMeta(status: string): { label: string; tone: Tone } {
  return MATCH_STATUS[status] ?? { label: status, tone: "muted" };
}
