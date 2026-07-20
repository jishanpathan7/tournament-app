import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";

import { TournamentDashboard } from "@/features/tournaments/dashboard/tournament-dashboard";

vi.mock("@/features/tournaments/dashboard/use-tournament-dashboard", () => ({
  useTournamentDashboard: vi.fn(),
}));

vi.mock("@/features/matches/components/activity-timeline", () => ({
  ActivityTimeline: () => <div data-testid="activity">Activity</div>,
}));

vi.mock("@/features/scheduling/components/queue-panel", () => ({
  QueuePanel: () => <div data-testid="queue">Queue</div>,
}));

vi.mock("@/hooks/use-permissions", () => ({
  useCan: () => () => true,
}));

import { useTournamentDashboard } from "@/features/tournaments/dashboard/use-tournament-dashboard";

const mockUseDashboard = vi.mocked(useTournamentDashboard);

type SignalOverrides = Partial<{
  hasApproved: boolean;
  squadsReady: boolean;
  pairingPublished: boolean;
  checkInReady: boolean;
  drawComplete: boolean;
  courtsReady: boolean;
  franchiseMode: boolean;
}>;

function baseMock(
  phase: "before" | "during" | "after",
  overrides: { step?: number; stepSignals?: SignalOverrides } = {},
) {
  return {
    phase,
    step: overrides.step ?? (phase === "after" ? 9 : phase === "during" ? 8 : 2),
    stepSignals: {
      hasApproved: true,
      squadsReady: false,
      pairingPublished: false,
      checkInReady: false,
      drawComplete: false,
      courtsReady: false,
      franchiseMode: false,
      ...overrides.stepSignals,
    },
    stats: [{ label: "Test", value: "1" }],
    alerts: [],
    champions: [],
    registrationTotals: { approved: 0, pending: 0, waitlisted: 0, rejected: 0 },
    drawProgress: { drawn: 0, total: 0 },
    participantsById: new Map(),
    stagesByDivision: new Map(),
    standingsByStage: new Map(),
    isLoadingCore: false,
    tournament: {
      isLoading: false,
      isError: false,
      data: {
        id: "t1",
        name: "Demo Open",
        status: phase === "during" ? "live" : phase === "after" ? "completed" : "registration",
        sportKey: "badminton",
        slug: "demo",
        visibility: "private",
        drawPublishedAt: null,
        schedulePublishedAt: null,
        resultsPublishedAt: null,
      },
      refetch: vi.fn(),
    },
    divisions: { data: [], isLoading: false },
    readiness: { isLoading: false, data: { divisions: [], totalCheckedIn: 0, totalPending: 0 } },
    matches: { data: [], isLoading: false },
    queue: { data: undefined, isLoading: false },
    stages: { data: [], isLoading: false },
    participants: { data: [], isLoading: false },
    activity: { isLoading: false },
  } as never;
}

describe("TournamentDashboard", () => {
  it("renders before-phase checklist and registration summary at step 2", () => {
    mockUseDashboard.mockReturnValue(baseMock("before"));
    renderWithProviders(<TournamentDashboard tournamentId="t1" />);
    // Checklist is always visible below the hero in before phase
    expect(screen.getByText("Your checklist")).toBeInTheDocument();
    // RegistrationsSummaryPanel promoted to main flow at step 2
    expect(screen.getByText("Participants")).toBeInTheDocument();
  });

  // Regression: the hero components were mapped to the wrong step numbers, so
  // the "Check-in" step offered team/draft actions and never linked to
  // attendance. Each step must offer the action its own label promises.
  it("offers check-in — not team actions — at step 3", () => {
    mockUseDashboard.mockReturnValue(baseMock("before", { step: 3 }));
    renderWithProviders(<TournamentDashboard tournamentId="t1" />);

    expect(screen.getByText("Open check-in")).toBeInTheDocument();
    expect(screen.queryByText("Run draft ceremony")).not.toBeInTheDocument();
  });

  it("offers team actions at step 4, once check-in is done", () => {
    mockUseDashboard.mockReturnValue(
      // Franchise mode is what surfaces the draft ceremony entry point.
      baseMock("before", { step: 4, stepSignals: { checkInReady: true, franchiseMode: true } }),
    );
    renderWithProviders(<TournamentDashboard tournamentId="t1" />);

    expect(screen.getByText("Run draft ceremony")).toBeInTheDocument();
    expect(screen.queryByText("Open check-in")).not.toBeInTheDocument();
  });

  it("renders during-phase match progress", () => {
    mockUseDashboard.mockReturnValue(baseMock("during"));
    renderWithProviders(<TournamentDashboard tournamentId="t1" />);
    expect(screen.getByText("Match progress")).toBeInTheDocument();
    expect(screen.getByText("Court status")).toBeInTheDocument();
  });

  it("renders after-phase champions", () => {
    mockUseDashboard.mockReturnValue(baseMock("after"));
    renderWithProviders(<TournamentDashboard tournamentId="t1" />);
    expect(screen.getByText("Champions")).toBeInTheDocument();
    expect(screen.getByText("Statistics")).toBeInTheDocument();
  });
});
