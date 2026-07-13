import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ScheduleTimeline } from "@/features/scheduling/components/schedule-timeline";
import {
  makeCourt,
  makeMatch,
  makeParticipant,
  makeTournament,
  makeTournamentCourt,
} from "@/test/fixtures";
import { renderWithProviders, screen } from "@/test/test-utils";

const { sessionState } = vi.hoisted(() => ({
  sessionState: { role: "organizer" as string | null },
}));
vi.mock("@/features/auth/use-session", () => ({
  useSession: () => ({
    session: sessionState.role ? { activeRole: sessionState.role } : null,
    isAuthenticated: !!sessionState.role,
    isLoading: false,
  }),
}));

vi.mock("@/features/scheduling/scheduling-api");
vi.mock("@/features/courts/courts-api");
vi.mock("@/features/matches/matches-api");
vi.mock("@/features/tournaments/tournaments-api");
import * as courtsApi from "@/features/courts/courts-api";
import * as matchesApi from "@/features/matches/matches-api";
import * as schedulingApi from "@/features/scheduling/scheduling-api";
import * as tournamentsApi from "@/features/tournaments/tournaments-api";

const TOURNAMENT_ID = "t-1";

function side(id: string) {
  return { participantId: id, outcome: null, scoreFor: null, scoreAgainst: null, rank: null };
}

function setup() {
  vi.mocked(tournamentsApi.getTournament).mockResolvedValue(
    makeTournament({ id: TOURNAMENT_ID, startsAt: "2026-07-25T08:00:00Z" }),
  );
  vi.mocked(matchesApi.listTournamentParticipants).mockResolvedValue([
    makeParticipant({ id: "p-1", displayName: "Aarav K." }),
    makeParticipant({ id: "p-2", displayName: "Mei L." }),
  ]);
}

describe("ScheduleTimeline", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionState.role = "organizer";
  });

  it("shows an empty state when no courts are assigned", async () => {
    setup();
    vi.mocked(matchesApi.listTournamentMatches).mockResolvedValue([]);
    vi.mocked(courtsApi.listTournamentCourts).mockResolvedValue([]);
    renderWithProviders(<ScheduleTimeline tournamentId={TOURNAMENT_ID} />);

    expect(await screen.findByText("Add courts before scheduling")).toBeInTheDocument();
  });

  it("renders the Unscheduled lane and one lane per assigned court", async () => {
    setup();
    vi.mocked(matchesApi.listTournamentMatches).mockResolvedValue([
      makeMatch({ id: "m-1", status: "scheduled", sides: [side("p-1"), side("p-2")] }),
    ]);
    vi.mocked(courtsApi.listTournamentCourts).mockResolvedValue([
      makeTournamentCourt({ court: makeCourt({ id: "c-1", name: "Court 1" }) }),
    ]);
    renderWithProviders(<ScheduleTimeline tournamentId={TOURNAMENT_ID} />);

    expect(await screen.findByText("Unscheduled")).toBeInTheDocument();
    expect(screen.getByText("Court 1")).toBeInTheDocument();
    expect(screen.getByText("Aarav K. vs Mei L.")).toBeInTheDocument();
  });

  it("shows a banner for matches still waiting on the bracket", async () => {
    setup();
    vi.mocked(matchesApi.listTournamentMatches).mockResolvedValue([
      makeMatch({ id: "m-1", status: "pending", sides: [] }),
    ]);
    vi.mocked(courtsApi.listTournamentCourts).mockResolvedValue([
      makeTournamentCourt({ court: makeCourt({ id: "c-1", name: "Court 1" }) }),
    ]);
    renderWithProviders(<ScheduleTimeline tournamentId={TOURNAMENT_ID} />);

    expect(await screen.findByText(/still waiting on earlier bracket results/)).toBeInTheDocument();
  });

  it("clears a scheduled match's court/time when its clear button is clicked", async () => {
    const user = userEvent.setup();
    setup();
    const scheduled = makeMatch({
      id: "m-1",
      status: "scheduled",
      courtId: "c-1",
      scheduledAt: "2026-07-25T09:00:00Z",
      sides: [side("p-1"), side("p-2")],
    });
    vi.mocked(matchesApi.listTournamentMatches).mockResolvedValue([scheduled]);
    vi.mocked(courtsApi.listTournamentCourts).mockResolvedValue([
      makeTournamentCourt({ court: makeCourt({ id: "c-1", name: "Court 1" }) }),
    ]);
    vi.mocked(schedulingApi.clearSchedule).mockResolvedValue({
      ...scheduled,
      courtId: null,
      scheduledAt: null,
    });
    renderWithProviders(<ScheduleTimeline tournamentId={TOURNAMENT_ID} />);

    const clearButton = await screen.findByRole("button", { name: /Unschedule/ });
    await user.click(clearButton);

    expect(schedulingApi.clearSchedule).toHaveBeenCalledWith("m-1");
  });

  it("saves a new time from the retime popover", async () => {
    const user = userEvent.setup();
    setup();
    const scheduled = makeMatch({
      id: "m-1",
      status: "scheduled",
      courtId: "c-1",
      scheduledAt: "2026-07-25T09:00:00Z",
      sides: [side("p-1"), side("p-2")],
    });
    vi.mocked(matchesApi.listTournamentMatches).mockResolvedValue([scheduled]);
    vi.mocked(courtsApi.listTournamentCourts).mockResolvedValue([
      makeTournamentCourt({ court: makeCourt({ id: "c-1", name: "Court 1" }) }),
    ]);
    vi.mocked(schedulingApi.assignSchedule).mockResolvedValue({ match: scheduled, conflicts: [] });
    renderWithProviders(<ScheduleTimeline tournamentId={TOURNAMENT_ID} />);

    await user.click(await screen.findByRole("button", { name: /Change time/ }));
    const input = screen.getByLabelText("Scheduled time");
    await user.clear(input);
    await user.type(input, "2026-07-25T10:30");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(schedulingApi.assignSchedule).toHaveBeenCalledWith(
      "m-1",
      expect.objectContaining({ courtId: "c-1" }),
    );
  });

  it("hides drag handles and the clear button for a role without schedule:manage", async () => {
    sessionState.role = "viewer";
    setup();
    vi.mocked(matchesApi.listTournamentMatches).mockResolvedValue([
      makeMatch({
        id: "m-1",
        status: "scheduled",
        courtId: "c-1",
        scheduledAt: "2026-07-25T09:00:00Z",
        sides: [side("p-1"), side("p-2")],
      }),
    ]);
    vi.mocked(courtsApi.listTournamentCourts).mockResolvedValue([
      makeTournamentCourt({ court: makeCourt({ id: "c-1", name: "Court 1" }) }),
    ]);
    renderWithProviders(<ScheduleTimeline tournamentId={TOURNAMENT_ID} />);

    await screen.findByText("Aarav K. vs Mei L.");
    expect(screen.queryByRole("button", { name: /Unschedule/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bulk schedule" })).not.toBeInTheDocument();
  });
});
