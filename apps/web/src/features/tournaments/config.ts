import {
  CircleDot,
  Grid2x2,
  ListOrdered,
  type LucideIcon,
  Network,
  Repeat,
  Trophy,
} from "lucide-react";
import type {
  ParticipantKind,
  StageFormat,
  TournamentStatus,
  Visibility,
} from "@tournament/api-client";

import type { BadgeProps } from "@/components/ui/badge";

/**
 * Frontend mirror of backend capabilities + lifecycle. There is no sports/formats list
 * endpoint, so availability is curated here to match the registered SportProfile
 * (badminton) and FormatEngines (round robin, single elimination). Marking others
 * "comingSoon" surfaces the multi-sport vision without letting the API 422.
 * Keep the transition map aligned with `app/modules/tournaments/service.py::_TRANSITIONS`.
 */

type Tone = NonNullable<BadgeProps["tone"]>;

// ---- sports ----

export interface SportOption {
  key: string;
  label: string;
  icon: LucideIcon;
  participantKinds: ParticipantKind[];
  comingSoon?: boolean;
}

export const SPORTS: SportOption[] = [
  {
    key: "badminton",
    label: "Badminton",
    icon: CircleDot,
    participantKinds: ["individual", "pair"],
  },
  {
    key: "table_tennis",
    label: "Table Tennis",
    icon: CircleDot,
    participantKinds: ["individual", "pair"],
    comingSoon: true,
  },
  {
    key: "tennis",
    label: "Tennis",
    icon: CircleDot,
    participantKinds: ["individual", "pair"],
    comingSoon: true,
  },
  {
    key: "chess",
    label: "Chess",
    icon: Grid2x2,
    participantKinds: ["individual"],
    comingSoon: true,
  },
  {
    key: "football",
    label: "Football",
    icon: Trophy,
    participantKinds: ["team"],
    comingSoon: true,
  },
];

export function getSport(key: string): SportOption | undefined {
  return SPORTS.find((s) => s.key === key);
}

// ---- formats ----

export interface FormatOption {
  key: StageFormat;
  label: string;
  description: string;
  icon: LucideIcon;
  comingSoon?: boolean;
}

export const FORMATS: FormatOption[] = [
  {
    key: "round_robin",
    label: "Round Robin",
    description:
      "Team format — each pair plays every other pair. Ranked by points (3 win / 1 draw / 0 loss), then game difference.",
    icon: Repeat,
  },
  {
    key: "single_elim",
    label: "Single Elimination",
    description: "Knockout bracket — lose once and you're out. Best of 3 by default.",
    icon: Network,
  },
  {
    key: "group_knockout",
    label: "Groups + Knockout",
    description: "Group stage into a knockout bracket.",
    icon: ListOrdered,
    comingSoon: true,
  },
  {
    key: "swiss",
    label: "Swiss",
    description: "Fixed rounds, paired by standing.",
    icon: ListOrdered,
    comingSoon: true,
  },
  {
    key: "ladder",
    label: "Ladder",
    description: "Challenge-based ranking ladder.",
    icon: ListOrdered,
    comingSoon: true,
  },
];

export function getFormat(key: string): FormatOption | undefined {
  return FORMATS.find((f) => f.key === key);
}

// ---- participant kinds ----

export const PARTICIPANT_KINDS: Record<ParticipantKind, string> = {
  individual: "Singles",
  pair: "Doubles",
  team: "Team",
  squad: "Franchise squad",
};

// ---- visibility ----

export const VISIBILITIES: { value: Visibility; label: string; description: string }[] = [
  { value: "private", label: "Private", description: "Only your organization can see it." },
  { value: "unlisted", label: "Unlisted", description: "Anyone with the link can view." },
  { value: "public", label: "Public", description: "Listed publicly and discoverable." },
];

// ---- match format (best-of) ----

export const MATCH_FORMATS: { value: 1 | 3 | 5; label: string; description: string }[] = [
  { value: 1, label: "Best of 1", description: "Single game decides the winner." },
  { value: 3, label: "Best of 3", description: "First to win 2 games." },
  { value: 5, label: "Best of 5", description: "First to win 3 games." },
];

export function getMatchFormat(bestOf: number): (typeof MATCH_FORMATS)[number] | undefined {
  return MATCH_FORMATS.find((f) => f.value === bestOf);
}

// ---- status ----

export interface StatusMeta {
  label: string;
  tone: Tone;
  description: string;
  live?: boolean;
}

export const TOURNAMENT_STATUS: Record<TournamentStatus, StatusMeta> = {
  draft: { label: "Draft", tone: "muted", description: "Being set up; not yet open." },
  registration: { label: "Registration", tone: "candy", description: "Accepting entries." },
  seeding: { label: "Setting up", tone: "yellow", description: "Preparing brackets and schedule." },
  live: { label: "Live", tone: "pink", description: "Matches in progress.", live: true },
  completed: { label: "Completed", tone: "mint", description: "All results are in." },
  archived: { label: "Archived", tone: "muted", description: "Read-only; retired." },
};

// ---- lifecycle transitions (mirror of backend _TRANSITIONS) ----

export interface StatusTransition {
  to: TournamentStatus;
  label: string;
  description: string;
  /** A forward step vs. a rollback (affects button tone). */
  regressive?: boolean;
}

export const STATUS_TRANSITIONS: Record<TournamentStatus, StatusTransition[]> = {
  draft: [
    {
      to: "registration",
      label: "Open registration",
      description:
        "Players will be able to self-register via the public page. You'll get a link to share.",
    },
  ],
  registration: [
    {
      to: "seeding",
      label: "Continue setup",
      description:
        "Closes registration. You can approve players, build teams, and generate brackets.",
    },
    {
      to: "draft",
      label: "Back to draft",
      description: "Hides the tournament from the public page. Registration entries are kept.",
      regressive: true,
    },
  ],
  seeding: [
    {
      to: "live",
      label: "Go live",
      description:
        "Starts the event. Match scoring becomes active and live results are visible to players.",
    },
    {
      to: "registration",
      label: "Reopen registration",
      description: "Re-opens the public registration form. Use if you need to accept late entries.",
      regressive: true,
    },
  ],
  live: [
    {
      to: "completed",
      label: "Mark complete",
      description:
        "Closes scoring and publishes final results. The bracket and standings stay visible.",
    },
  ],
  completed: [
    {
      to: "archived",
      label: "Archive",
      description: "Moves to read-only archive. Hides from active lists.",
      regressive: true,
    },
  ],
  archived: [],
};

export const PUBLISH_ARTIFACTS: {
  key: string;
  label: string;
  field: keyof PublishableTimestamps;
}[] = [
  { key: "draw", label: "Brackets", field: "drawPublishedAt" },
  { key: "schedule", label: "Schedule", field: "schedulePublishedAt" },
  { key: "results", label: "Results", field: "resultsPublishedAt" },
];

export interface PublishableTimestamps {
  drawPublishedAt: string | null;
  schedulePublishedAt: string | null;
  resultsPublishedAt: string | null;
}
