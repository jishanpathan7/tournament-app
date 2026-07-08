import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
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

vi.mock("@/features/tournaments/components/detail/divisions-section", () => ({
  DivisionsSection: () => <div>Event types</div>,
}));

vi.mock("@/features/tournaments/components/detail/overview-panel", () => ({
  OverviewPanel: () => <div>Overview</div>,
}));

vi.mock("@/hooks/use-permissions", () => ({
  useCan: () => () => true,
}));

import { useTournamentDashboard } from "@/features/tournaments/dashboard/use-tournament-dashboard";

const mockUseDashboard = vi.mocked(useTournamentDashboard);

function baseMock(phase: "before" | "during" | "after") {
  return {
    phase,
    step: phase === "after" ? 9 : phase === "during" ? 8 : 2,
    stepSignals: {
      hasApproved: true,
      squadsReady: false,
      pairingPublished: false,
      checkInReady: false,
      drawComplete: false,
      courtsReady: false,
      franchiseMode: false,
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
  it("renders before-phase checklist and expandable details", async () => {
    const user = userEvent.setup();
    mockUseDashboard.mockReturnValue(baseMock("before"));
    renderWithProviders(<TournamentDashboard tournamentId="t1" />);
    expect(screen.getByText("Your checklist")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /more details/i }));
    expect(screen.getByText("Readiness")).toBeInTheDocument();
    expect(screen.getByText("Participants")).toBeInTheDocument();
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
