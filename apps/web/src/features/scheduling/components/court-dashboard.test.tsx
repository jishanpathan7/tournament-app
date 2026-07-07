import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CourtDashboard } from "@/features/scheduling/components/court-dashboard";
import {
  makeCourt,
  makeCourtQueue,
  makeMatch,
  makeParticipant,
  makeScheduleQueue,
} from "@/test/fixtures";
import { renderWithProviders, screen } from "@/test/test-utils";

vi.mock("@/features/auth/use-session", () => ({
  useSession: () => ({
    session: { activeOrganizationId: "org-1" },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

// The dashboard subscribes to realtime directly (it renders outside AppShell).
class FakeEventSource {
  addEventListener() {}
  removeEventListener() {}
  close() {}
}
beforeEach(() => vi.stubGlobal("EventSource", FakeEventSource));
afterEach(() => vi.unstubAllGlobals());

vi.mock("@/features/scheduling/scheduling-api");
vi.mock("@/features/matches/matches-api");
import * as matchesApi from "@/features/matches/matches-api";
import * as schedulingApi from "@/features/scheduling/scheduling-api";

const TOURNAMENT_ID = "t-1";

function side(id: string) {
  return { participantId: id, outcome: null, scoreFor: null, scoreAgainst: null, rank: null };
}

describe("CourtDashboard", () => {
  it("shows a message when no courts are assigned", async () => {
    vi.mocked(schedulingApi.getQueue).mockResolvedValue(makeScheduleQueue());
    vi.mocked(matchesApi.listTournamentParticipants).mockResolvedValue([]);
    renderWithProviders(<CourtDashboard tournamentId={TOURNAMENT_ID} />);

    expect(await screen.findByText("No courts assigned to this tournament.")).toBeInTheDocument();
  });

  it("renders each court's live status and current match", async () => {
    const p1 = makeParticipant({ id: "p-1", displayName: "Aarav K." });
    const p2 = makeParticipant({ id: "p-2", displayName: "Mei L." });
    vi.mocked(schedulingApi.getQueue).mockResolvedValue(
      makeScheduleQueue({
        courts: [
          makeCourtQueue({
            court: makeCourt({ id: "c-1", name: "Court 1" }),
            currentMatch: makeMatch({ status: "scheduled", sides: [side("p-1"), side("p-2")] }),
          }),
          makeCourtQueue({ court: makeCourt({ id: "c-2", name: "Court 2" }) }),
        ],
      }),
    );
    vi.mocked(matchesApi.listTournamentParticipants).mockResolvedValue([p1, p2]);
    renderWithProviders(<CourtDashboard tournamentId={TOURNAMENT_ID} />);

    expect(await screen.findByText("Court 1")).toBeInTheDocument();
    expect(screen.getByText("Court 2")).toBeInTheDocument();
    expect(screen.getByText("Aarav K. vs Mei L.")).toBeInTheDocument();
    expect(screen.getByText("Court is free")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
  });
});
