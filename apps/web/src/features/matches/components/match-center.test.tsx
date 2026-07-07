import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MatchCenter } from "@/features/matches/components/match-center";
import { ApiError } from "@/lib/problem";
import {
  makeActivityEvent,
  makeMatch,
  makeMatchResultEvent,
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
vi.mock("@/features/matches/matches-api");
vi.mock("@/features/scoring/scoring-api");
import * as registrationsApi from "@/features/registrations/registrations-api";
import * as matchesApi from "@/features/matches/matches-api";
import * as scoringApi from "@/features/scoring/scoring-api";
import * as tournamentsApi from "@/features/tournaments/tournaments-api";

const TOURNAMENT_ID = "t-1";
const DIVISION_ID = "div-1";
const STAGE_ID = "stage-1";

const p1 = makeParticipant({ id: "p-1", displayName: "Aarav K." });
const p2 = makeParticipant({ id: "p-2", displayName: "Mei L." });
interface SideOverrides {
  outcome?: string | null;
  scoreFor?: number | null;
  scoreAgainst?: number | null;
}
const side = (id: string, overrides: SideOverrides = {}) => ({
  participantId: id,
  outcome: null,
  scoreFor: null,
  scoreAgainst: null,
  rank: null,
  ...overrides,
});

function baseSetup() {
  vi.mocked(tournamentsApi.getTournament).mockResolvedValue(makeTournament({ id: TOURNAMENT_ID }));
  vi.mocked(matchesApi.listTournamentStages).mockResolvedValue([
    makeStage({ id: STAGE_ID, divisionId: DIVISION_ID, type: "round_robin", seq: 0 }),
  ]);
  vi.mocked(matchesApi.listTournamentParticipants).mockResolvedValue([p1, p2]);
  vi.mocked(matchesApi.listTournamentActivity).mockResolvedValue([]);
  vi.mocked(scoringApi.listMatchEvents).mockResolvedValue([]);
  vi.mocked(scoringApi.getMatchEtag).mockResolvedValue('W/"123"');
  // Only used by listTournamentParticipants/listTournamentStages internals if not mocked
  // directly — kept resolved so nothing hangs if a real implementation slips through.
  vi.mocked(tournamentsApi.listDivisions).mockResolvedValue([]);
  vi.mocked(registrationsApi.listParticipants).mockResolvedValue([]);
}

function renderCenter() {
  return renderWithProviders(<MatchCenter tournamentId={TOURNAMENT_ID} />);
}

describe("MatchCenter", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionState.role = "organizer";
    baseSetup();
  });

  it("shows a skeleton while loading", () => {
    vi.mocked(tournamentsApi.getTournament).mockReturnValue(new Promise(() => {}));
    vi.mocked(matchesApi.listTournamentMatches).mockReturnValue(new Promise(() => {}));
    vi.mocked(matchesApi.listTournamentStages).mockReturnValue(new Promise(() => {}));
    renderCenter();
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows the empty state when there are no matches", async () => {
    vi.mocked(matchesApi.listTournamentMatches).mockResolvedValue([]);
    renderCenter();
    expect(await screen.findByText("No matches yet")).toBeInTheDocument();
  });

  it("renders the queue with status counts and opens the detail dialog on row click", async () => {
    const user = userEvent.setup();
    vi.mocked(matchesApi.listTournamentMatches).mockResolvedValue([
      makeMatch({
        id: "m-1",
        stageId: STAGE_ID,
        status: "scheduled",
        roundLabel: "Round 1",
        sides: [side(p1.id), side(p2.id)],
      }),
    ]);
    renderCenter();

    expect(await screen.findByText("Aarav K. vs Mei L.")).toBeInTheDocument();
    expect(screen.getByText("1 Scheduled")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /open match: aarav k\. vs mei l\./i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Enter result")).toBeInTheDocument();
  });

  it("filters the queue by search", async () => {
    const user = userEvent.setup();
    vi.mocked(matchesApi.listTournamentMatches).mockResolvedValue([
      makeMatch({
        id: "m-1",
        stageId: STAGE_ID,
        status: "scheduled",
        sides: [side(p1.id), side(p2.id)],
      }),
    ]);
    renderCenter();
    await screen.findByText("Aarav K. vs Mei L.");

    await user.type(screen.getByLabelText("Search matches"), "nobody");
    expect(await screen.findByText("No matches match")).toBeInTheDocument();
  });

  it("submits a normal score and reflects the update", async () => {
    const user = userEvent.setup();
    vi.mocked(matchesApi.listTournamentMatches).mockResolvedValue([
      makeMatch({
        id: "m-1",
        stageId: STAGE_ID,
        status: "scheduled",
        sides: [side(p1.id), side(p2.id)],
      }),
    ]);
    vi.mocked(scoringApi.scoreMatch).mockResolvedValue(
      makeMatch({
        id: "m-1",
        stageId: STAGE_ID,
        status: "completed",
        sides: [
          side(p1.id, { outcome: "win", scoreFor: 2, scoreAgainst: 0 }),
          side(p2.id, { outcome: "loss", scoreFor: 0, scoreAgainst: 2 }),
        ],
      }),
    );
    renderCenter();
    await user.click(await screen.findByRole("button", { name: /open match/i }));
    const dialog = await screen.findByRole("dialog");

    const [gameAInput, gameBInput] = within(dialog).getAllByLabelText(/game 1,/i);
    await user.type(gameAInput!, "21");
    await user.type(gameBInput!, "15");
    await user.click(within(dialog).getByRole("button", { name: "Submit result" }));

    await waitFor(() =>
      expect(scoringApi.scoreMatch).toHaveBeenCalledWith(
        "m-1",
        { endedBy: "normal", games: [[21, 15]] },
        { ifMatch: 'W/"123"', idempotencyKey: expect.any(String) },
      ),
    );
  });

  it("submits a walkover", async () => {
    const user = userEvent.setup();
    vi.mocked(matchesApi.listTournamentMatches).mockResolvedValue([
      makeMatch({
        id: "m-1",
        stageId: STAGE_ID,
        status: "scheduled",
        sides: [side(p1.id), side(p2.id)],
      }),
    ]);
    vi.mocked(scoringApi.scoreMatch).mockResolvedValue(
      makeMatch({
        id: "m-1",
        stageId: STAGE_ID,
        status: "walkover",
        sides: [side(p1.id, { outcome: "win" })],
      }),
    );
    renderCenter();
    await user.click(await screen.findByRole("button", { name: /open match/i }));
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("tab", { name: "Walkover" }));
    await user.click(within(dialog).getByRole("button", { name: "Aarav K." }));
    await user.click(within(dialog).getByRole("button", { name: "Submit result" }));

    await waitFor(() =>
      expect(scoringApi.scoreMatch).toHaveBeenCalledWith(
        "m-1",
        { endedBy: "walkover", walkoverWinner: 0 },
        expect.anything(),
      ),
    );
  });

  it("shows a structural validation error before calling the backend", async () => {
    const user = userEvent.setup();
    vi.mocked(matchesApi.listTournamentMatches).mockResolvedValue([
      makeMatch({
        id: "m-1",
        stageId: STAGE_ID,
        status: "scheduled",
        sides: [side(p1.id), side(p2.id)],
      }),
    ]);
    renderCenter();
    await user.click(await screen.findByRole("button", { name: /open match/i }));
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Submit result" }));

    expect(await within(dialog).findByText(/enter at least one game score/i)).toBeInTheDocument();
    expect(scoringApi.scoreMatch).not.toHaveBeenCalled();
  });

  it("surfaces a blocked correction (winner-change conflict) from the backend", async () => {
    const user = userEvent.setup();
    vi.mocked(matchesApi.listTournamentMatches).mockResolvedValue([
      makeMatch({
        id: "m-1",
        stageId: STAGE_ID,
        status: "completed",
        sides: [
          side(p1.id, { outcome: "win", scoreFor: 2, scoreAgainst: 0 }),
          side(p2.id, { outcome: "loss", scoreFor: 0, scoreAgainst: 2 }),
        ],
      }),
    ]);
    vi.mocked(scoringApi.scoreMatch).mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "Conflict",
        status: 409,
        code: "correction_conflict",
        detail: "cannot change the winner of a match that others have advanced from",
      }),
    );
    renderCenter();
    await user.click(await screen.findByRole("button", { name: /open match/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Correct result")).toBeInTheDocument();

    const [gameAInput, gameBInput] = within(dialog).getAllByLabelText(/game 1,/i);
    await user.type(gameAInput!, "15");
    await user.type(gameBInput!, "21");
    await user.click(within(dialog).getByRole("button", { name: "Submit result" }));

    expect(await within(dialog).findByText(/cannot change the winner/i)).toBeInTheDocument();
  });

  it("surfaces a stale-match conflict with a refresh hint", async () => {
    const user = userEvent.setup();
    vi.mocked(matchesApi.listTournamentMatches).mockResolvedValue([
      makeMatch({
        id: "m-1",
        stageId: STAGE_ID,
        status: "scheduled",
        sides: [side(p1.id), side(p2.id)],
      }),
    ]);
    vi.mocked(scoringApi.scoreMatch).mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "Precondition Failed",
        status: 412,
        code: "stale_match",
      }),
    );
    renderCenter();
    await user.click(await screen.findByRole("button", { name: /open match/i }));
    const dialog = await screen.findByRole("dialog");

    const [gameAInput, gameBInput] = within(dialog).getAllByLabelText(/game 1,/i);
    await user.type(gameAInput!, "21");
    await user.type(gameBInput!, "15");
    await user.click(within(dialog).getByRole("button", { name: "Submit result" }));

    expect(await within(dialog).findByText(/updated elsewhere/i)).toBeInTheDocument();
  });

  it("disables the submit button while the mutation is pending", async () => {
    const user = userEvent.setup();
    vi.mocked(matchesApi.listTournamentMatches).mockResolvedValue([
      makeMatch({
        id: "m-1",
        stageId: STAGE_ID,
        status: "scheduled",
        sides: [side(p1.id), side(p2.id)],
      }),
    ]);
    let resolveScore: (() => void) | undefined;
    vi.mocked(scoringApi.scoreMatch).mockReturnValue(
      new Promise((resolve) => {
        resolveScore = () =>
          resolve(makeMatch({ id: "m-1", stageId: STAGE_ID, status: "completed", sides: [] }));
      }),
    );
    renderCenter();
    await user.click(await screen.findByRole("button", { name: /open match/i }));
    const dialog = await screen.findByRole("dialog");

    const [gameAInput, gameBInput] = within(dialog).getAllByLabelText(/game 1,/i);
    await user.type(gameAInput!, "21");
    await user.type(gameBInput!, "15");
    const submitBtn = within(dialog).getByRole("button", { name: "Submit result" });
    await user.click(submitBtn);

    await waitFor(() => expect(submitBtn).toBeDisabled());
    resolveScore?.();
  });

  it("shows match history events once loaded", async () => {
    vi.mocked(matchesApi.listTournamentMatches).mockResolvedValue([
      makeMatch({
        id: "m-1",
        stageId: STAGE_ID,
        status: "completed",
        sides: [side(p1.id), side(p2.id)],
      }),
    ]);
    vi.mocked(scoringApi.listMatchEvents).mockResolvedValue([
      makeMatchResultEvent({ matchId: "m-1", type: "normal" }),
    ]);
    renderCenter();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /open match/i }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Score submitted")).toBeInTheDocument();
  });

  it("renders the tournament-wide activity timeline", async () => {
    vi.mocked(matchesApi.listTournamentMatches).mockResolvedValue([]);
    vi.mocked(matchesApi.listTournamentActivity).mockResolvedValue([
      makeActivityEvent({ action: "stage.generated", entity: "stage" }),
    ]);
    renderCenter();
    expect(await screen.findByText("Draw generated")).toBeInTheDocument();
  });

  it("hides score entry for a non-scoring role", async () => {
    sessionState.role = "viewer";
    const user = userEvent.setup();
    vi.mocked(matchesApi.listTournamentMatches).mockResolvedValue([
      makeMatch({
        id: "m-1",
        stageId: STAGE_ID,
        status: "scheduled",
        sides: [side(p1.id), side(p2.id)],
      }),
    ]);
    renderCenter();
    await user.click(await screen.findByRole("button", { name: /open match/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByText("Enter result")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Submit result" })).not.toBeInTheDocument();
  });
});
