import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MatchCenter } from "@/features/matches/components/match-center";
import { ApiError } from "@/lib/problem";
import {
  makeActivityEvent,
  makeMatch,
  makeMatchResultEvent,
  makeParticipant,
  makeScheduleQueue,
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
vi.mock("@/hooks/use-media-query", () => ({
  useIsDesktop: () => true,
  useMediaQuery: () => true,
}));

vi.mock("@/features/tournaments/tournaments-api");
vi.mock("@/features/registrations/registrations-api");
vi.mock("@/features/matches/matches-api");
vi.mock("@/features/scoring/scoring-api");
vi.mock("@/features/scheduling/scheduling-api");
vi.mock("@/features/courts/courts-api");
import * as courtsApi from "@/features/courts/courts-api";
import * as registrationsApi from "@/features/registrations/registrations-api";
import * as matchesApi from "@/features/matches/matches-api";
import * as scoringApi from "@/features/scoring/scoring-api";
import * as schedulingApi from "@/features/scheduling/scheduling-api";
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
  vi.mocked(scoringApi.startMatch).mockImplementation(async (matchId) =>
    makeMatch({
      id: matchId,
      stageId: STAGE_ID,
      status: "live",
      sides: [side(p1.id), side(p2.id)],
    }),
  );
  vi.mocked(schedulingApi.getQueue).mockResolvedValue(makeScheduleQueue());
  vi.mocked(courtsApi.listTournamentCourts).mockResolvedValue([]);
  vi.mocked(tournamentsApi.listDivisions).mockResolvedValue([]);
  vi.mocked(registrationsApi.listParticipants).mockResolvedValue([]);
}

function renderCenter() {
  return renderWithProviders(<MatchCenter tournamentId={TOURNAMENT_ID} />);
}

async function waitForQueue() {
  await screen.findByText("Aarav K. vs Mei L.");
}

async function openMatchCommandCenter(user: ReturnType<typeof userEvent.setup>) {
  await waitForQueue();
  await user.click(screen.getByRole("button", { name: /open match: aarav k\. vs mei l\./i }));
  return screen.findByRole("dialog");
}

async function openScoreTab(user: ReturnType<typeof userEvent.setup>) {
  await waitForQueue();
  await user.click(screen.getByRole("button", { name: "View match" }));
  return screen.findByRole("dialog");
}

async function openCompletedMatch(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText("Recently finished");
  await user.click(screen.getByRole("button", { name: /recently finished/i }));
  await screen.findByRole("button", { name: "View result" });
  await user.click(screen.getByRole("button", { name: "View result" }));
  return screen.findByRole("dialog");
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

  it("renders the ops summary, sectioned queue, and opens the command center on card click", async () => {
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
    expect(screen.getByText("Waiting to start")).toBeInTheDocument();
    expect(screen.getByText("Waiting for court")).toBeInTheDocument();

    const dialog = await openMatchCommandCenter(user);
    expect(within(dialog).getByRole("tab", { name: "Overview" })).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: /advanced filters/i }));
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
    const dialog = await openScoreTab(user);

    const [gameAInput, gameBInput] = within(dialog).getAllByLabelText(/game 1,/i);
    await user.type(gameAInput!, "21");
    await user.type(gameBInput!, "15");
    await user.click(within(dialog).getByRole("button", { name: "Finish match" }));

    await waitFor(() =>
      expect(scoringApi.scoreMatch).toHaveBeenCalledWith(
        "m-1",
        { endedBy: "normal", games: [[21, 15]] },
        { ifMatch: 'W/"123"', idempotencyKey: expect.any(String) },
      ),
    );
  });

  it("submits a walkover via quick action", async () => {
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
    const dialog = await openScoreTab(user);

    await user.click(within(dialog).getByRole("button", { name: "Walkover" }));
    await user.click(within(dialog).getByRole("button", { name: "Aarav K." }));
    await user.click(within(dialog).getByRole("button", { name: "Finish match" }));

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
    const dialog = await openScoreTab(user);

    await user.click(within(dialog).getByRole("button", { name: "Finish match" }));

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
    const dialog = await openCompletedMatch(user);
    expect(within(dialog).getByRole("button", { name: "Save correction" })).toBeInTheDocument();

    const [gameAInput, gameBInput] = within(dialog).getAllByLabelText(/game 1,/i);
    await user.type(gameAInput!, "15");
    await user.type(gameBInput!, "21");
    await user.click(within(dialog).getByRole("button", { name: "Save correction" }));

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
    const dialog = await openScoreTab(user);

    const [gameAInput, gameBInput] = within(dialog).getAllByLabelText(/game 1,/i);
    await user.type(gameAInput!, "21");
    await user.type(gameBInput!, "15");
    await user.click(within(dialog).getByRole("button", { name: "Finish match" }));

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
    const dialog = await openScoreTab(user);

    const [gameAInput, gameBInput] = within(dialog).getAllByLabelText(/game 1,/i);
    await user.type(gameAInput!, "21");
    await user.type(gameBInput!, "15");
    const submitBtn = within(dialog).getByRole("button", { name: "Finish match" });
    await user.click(submitBtn);

    await waitFor(() => expect(submitBtn).toBeDisabled());
    resolveScore?.();
  });

  it("shows match history events on the timeline tab", async () => {
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
    const dialog = await openCompletedMatch(user);
    await user.click(within(dialog).getByRole("tab", { name: "Timeline" }));
    expect(await within(dialog).findByText("Score submitted")).toBeInTheDocument();
  });

  it("does not start a match when opening the score tab via View match", async () => {
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
    await openScoreTab(user);
    await waitFor(() => expect(scoringApi.startMatch).not.toHaveBeenCalled());
  });

  it("starts a match when clicking Start match", async () => {
    const user = userEvent.setup();
    vi.mocked(matchesApi.listTournamentMatches).mockResolvedValue([
      makeMatch({
        id: "m-1",
        stageId: STAGE_ID,
        status: "scheduled",
        courtId: "court-1",
        sides: [side(p1.id), side(p2.id)],
      }),
    ]);
    renderCenter();
    await waitForQueue();
    await user.click(screen.getByRole("button", { name: "Start match" }));
    await waitFor(() =>
      expect(scoringApi.startMatch).toHaveBeenCalledWith("m-1", { ifMatch: null }),
    );
  });

  it("renders the compact activity feed", async () => {
    vi.mocked(matchesApi.listTournamentMatches).mockResolvedValue([]);
    vi.mocked(matchesApi.listTournamentActivity).mockResolvedValue([
      makeActivityEvent({ action: "stage.generated", entity: "stage" }),
    ]);
    renderCenter();
    expect(await screen.findByText("Draw generated")).toBeInTheDocument();
    expect(screen.getByText("Recent activity")).toBeInTheDocument();
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
    await user.click(
      await screen.findByRole("button", { name: /open match: aarav k\. vs mei l\./i }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("tab", { name: "Score" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Finish match" })).not.toBeInTheDocument();
  });
});
