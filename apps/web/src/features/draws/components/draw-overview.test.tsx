import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeDivision,
  makeMatch,
  makeParticipant,
  makeStage,
  makeTournament,
} from "@/test/fixtures";
import { renderWithProviders, screen, waitFor, within } from "@/test/test-utils";

// Control the signed-in role for permission assertions (real `useCan` computes from it).
const { sessionState } = vi.hoisted(() => ({
  sessionState: { role: "organizer" as string | null },
}));
vi.mock("@/features/auth/use-session", () => ({
  useSession: () => ({
    session: sessionState.role ? { id: "u-1", activeRole: sessionState.role } : null,
    isAuthenticated: !!sessionState.role,
    isLoading: false,
  }),
}));

vi.mock("@/features/tournaments/tournaments-api");
vi.mock("@/features/registrations/registrations-api");
vi.mock("@/features/scoring/scoring-api");
import * as registrationsApi from "@/features/registrations/registrations-api";
import * as scoringApi from "@/features/scoring/scoring-api";
import * as tournamentsApi from "@/features/tournaments/tournaments-api";
import { DrawOverview } from "@/features/draws/components/draw-overview";

const TOURNAMENT_ID = "t-1";
const DIVISION_ID = "div-1";
const STAGE_ID = "stage-1";

function baseSetup(stageOverrides: Partial<ReturnType<typeof makeStage>> = {}) {
  vi.mocked(tournamentsApi.getTournament).mockResolvedValue(
    makeTournament({ id: TOURNAMENT_ID, status: "seeding" }),
  );
  vi.mocked(tournamentsApi.listDivisions).mockResolvedValue([
    makeDivision({ id: DIVISION_ID, tournamentId: TOURNAMENT_ID, name: "Men's Singles" }),
  ]);
  vi.mocked(tournamentsApi.listStages).mockResolvedValue([
    makeStage({ id: STAGE_ID, divisionId: DIVISION_ID, type: "round_robin", ...stageOverrides }),
  ]);
}

function renderOverview() {
  return renderWithProviders(
    <DrawOverview tournamentId={TOURNAMENT_ID} divisionId={DIVISION_ID} stageId={STAGE_ID} />,
  );
}

describe("DrawOverview", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionState.role = "organizer";
    vi.mocked(scoringApi.getStandings).mockResolvedValue({ stageId: STAGE_ID, rows: [] });
    vi.mocked(registrationsApi.listParticipants).mockResolvedValue([]);
  });

  it("shows a skeleton while loading", () => {
    vi.mocked(tournamentsApi.getTournament).mockReturnValue(new Promise(() => {}));
    vi.mocked(tournamentsApi.listDivisions).mockReturnValue(new Promise(() => {}));
    vi.mocked(tournamentsApi.listStages).mockReturnValue(new Promise(() => {}));
    renderOverview();
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows the empty state and readiness checklist before a draw exists", async () => {
    baseSetup({ drawn: false });
    vi.mocked(registrationsApi.listParticipants).mockResolvedValue([
      makeParticipant({ status: "approved" }),
      makeParticipant({ status: "approved" }),
    ]);
    renderOverview();

    expect(await screen.findByText("No draw yet")).toBeInTheDocument();
    expect(screen.getByText("Ready to generate")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate draw/i })).toBeEnabled();
  });

  it("blocks generation and explains why with too few participants", async () => {
    baseSetup({ drawn: false });
    vi.mocked(registrationsApi.listParticipants).mockResolvedValue([
      makeParticipant({ status: "approved" }),
    ]);
    renderOverview();

    expect(await screen.findByText(/at least 2 approved participants/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate draw/i })).toBeDisabled();
  });

  it("generates a draw through the confirmation dialog", async () => {
    const user = userEvent.setup();
    baseSetup({ drawn: false });
    vi.mocked(registrationsApi.listParticipants).mockResolvedValue([
      makeParticipant({ status: "approved" }),
      makeParticipant({ status: "approved" }),
    ]);
    vi.mocked(tournamentsApi.generateDraw).mockResolvedValue({
      stageId: STAGE_ID,
      format: "round_robin",
      groups: 0,
      rounds: 1,
      matches: 1,
      scheduled: 1,
      pending: 0,
    });
    renderOverview();

    await user.click(await screen.findByRole("button", { name: /generate draw/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /generate draw/i }));

    await waitFor(() =>
      expect(vi.mocked(tournamentsApi.generateDraw).mock.calls[0]?.slice(0, 2)).toEqual([
        STAGE_ID,
        { overrideReadiness: false },
      ]),
    );
  });

  it("surfaces a validation failure from a failed generation", async () => {
    const user = userEvent.setup();
    baseSetup({ drawn: false });
    vi.mocked(registrationsApi.listParticipants).mockResolvedValue([
      makeParticipant({ status: "approved" }),
      makeParticipant({ status: "approved" }),
    ]);
    vi.mocked(tournamentsApi.generateDraw).mockRejectedValue(new Error("too_few_participants"));
    renderOverview();

    await user.click(await screen.findByRole("button", { name: /generate draw/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /generate draw/i }));

    expect(await within(dialog).findByText("too_few_participants")).toBeInTheDocument();
  });

  it("renders round robin fixtures grouped by round/group", async () => {
    baseSetup({ drawn: true, type: "round_robin" });
    const p1 = makeParticipant({ id: "p-1", displayName: "Aarav K." });
    const p2 = makeParticipant({ id: "p-2", displayName: "Mei L." });
    vi.mocked(registrationsApi.listParticipants).mockResolvedValue([p1, p2]);
    vi.mocked(scoringApi.listStageMatches).mockResolvedValue([
      makeMatch({
        status: "completed",
        sides: [
          { participantId: "p-1", outcome: "win", scoreFor: 21, scoreAgainst: 15, rank: null },
          { participantId: "p-2", outcome: "loss", scoreFor: 15, scoreAgainst: 21, rank: null },
        ],
      }),
    ]);
    vi.mocked(scoringApi.getStandings).mockResolvedValue({ stageId: STAGE_ID, rows: [] });
    renderOverview();

    expect(await screen.findByText("Aarav K.")).toBeInTheDocument();
    expect(screen.getByText("Mei L.")).toBeInTheDocument();
  });

  it("renders a single elimination bracket with round labels and a champion slot", async () => {
    baseSetup({ drawn: true, type: "single_elim" });
    const p1 = makeParticipant({ id: "p-1", displayName: "Sara P." });
    const p2 = makeParticipant({ id: "p-2", displayName: "Rohan M." });
    vi.mocked(registrationsApi.listParticipants).mockResolvedValue([p1, p2]);
    vi.mocked(scoringApi.listStageMatches).mockResolvedValue([
      makeMatch({
        roundId: "r-1",
        roundSeq: 1,
        roundLabel: "Final",
        status: "completed",
        sides: [
          { participantId: "p-1", outcome: "win", scoreFor: 21, scoreAgainst: 10, rank: null },
          { participantId: "p-2", outcome: "loss", scoreFor: 10, scoreAgainst: 21, rank: null },
        ],
      }),
    ]);
    renderOverview();

    expect(await screen.findByText("Final")).toBeInTheDocument();
    expect(screen.getByText("Champion")).toBeInTheDocument();
    expect(screen.getAllByText("Sara P.")).toHaveLength(2); // seed card + champion card
  });

  it("shows a bye placeholder for a walkover with only one real side", async () => {
    baseSetup({ drawn: true, type: "single_elim" });
    const p1 = makeParticipant({ id: "p-1", displayName: "Devi R." });
    vi.mocked(registrationsApi.listParticipants).mockResolvedValue([p1]);
    vi.mocked(scoringApi.listStageMatches).mockResolvedValue([
      makeMatch({
        roundId: "r-1",
        roundSeq: 1,
        roundLabel: "Semifinal",
        status: "walkover",
        sides: [
          { participantId: "p-1", outcome: "win", scoreFor: null, scoreAgainst: null, rank: null },
        ],
      }),
    ]);
    renderOverview();

    expect((await screen.findAllByText("Devi R.")).length).toBeGreaterThan(0);
    expect(screen.getByText("Bye")).toBeInTheDocument();
  });

  it("hides the clear-draw action once the stage is locked", async () => {
    baseSetup({ drawn: true, locked: true, type: "round_robin" });
    vi.mocked(registrationsApi.listParticipants).mockResolvedValue([
      makeParticipant({ status: "approved" }),
      makeParticipant({ status: "approved" }),
    ]);
    vi.mocked(scoringApi.listStageMatches).mockResolvedValue([]);
    renderOverview();

    expect((await screen.findAllByText(/locked/i)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /clear & regenerate/i })).not.toBeInTheDocument();
  });

  it("clears a draw through the confirmation dialog when unlocked", async () => {
    const user = userEvent.setup();
    baseSetup({ drawn: true, locked: false, type: "round_robin" });
    vi.mocked(registrationsApi.listParticipants).mockResolvedValue([
      makeParticipant({ status: "approved" }),
      makeParticipant({ status: "approved" }),
    ]);
    vi.mocked(scoringApi.listStageMatches).mockResolvedValue([]);
    vi.mocked(tournamentsApi.clearDraw).mockResolvedValue(undefined);
    renderOverview();

    await user.click(await screen.findByRole("button", { name: /clear & regenerate/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /clear draw/i }));

    await waitFor(() => expect(tournamentsApi.clearDraw).toHaveBeenCalledWith(STAGE_ID));
  });

  it("hides management actions for a non-managing role", async () => {
    sessionState.role = "viewer";
    baseSetup({ drawn: false });
    vi.mocked(registrationsApi.listParticipants).mockResolvedValue([
      makeParticipant({ status: "approved" }),
      makeParticipant({ status: "approved" }),
    ]);
    renderOverview();

    await screen.findByText("No draw yet");
    expect(screen.queryByRole("button", { name: /generate draw/i })).not.toBeInTheDocument();
  });

  it("shows the correct draw status badges (generated + live)", async () => {
    vi.mocked(tournamentsApi.getTournament).mockResolvedValue(
      makeTournament({
        id: TOURNAMENT_ID,
        status: "live",
        drawPublishedAt: "2026-07-01T00:00:00Z",
      }),
    );
    vi.mocked(tournamentsApi.listDivisions).mockResolvedValue([
      makeDivision({ id: DIVISION_ID, tournamentId: TOURNAMENT_ID }),
    ]);
    vi.mocked(tournamentsApi.listStages).mockResolvedValue([
      makeStage({ id: STAGE_ID, divisionId: DIVISION_ID, drawn: true, locked: false }),
    ]);
    vi.mocked(registrationsApi.listParticipants).mockResolvedValue([]);
    vi.mocked(scoringApi.listStageMatches).mockResolvedValue([]);
    renderOverview();

    expect(await screen.findByText("Generated")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.queryByText("Locked")).not.toBeInTheDocument();
  });
});
