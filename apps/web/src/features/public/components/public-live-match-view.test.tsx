import { beforeEach, describe, expect, it, vi } from "vitest";

import { PublicLiveMatchView } from "@/features/public/components/public-live-match-view";
import { makeMatch, makeMatchResultEvent, makePublicParticipant } from "@/test/fixtures";
import { renderWithProviders, screen } from "@/test/test-utils";

vi.mock("@/features/public/public-api");
import * as publicApi from "@/features/public/public-api";

const SLUG = "sibl-open";
const MATCH_ID = "m-1";

interface SideOverrides {
  outcome?: string | null;
  scoreFor?: number | null;
}
const side = (id: string, overrides: SideOverrides = {}) => ({
  participantId: id,
  outcome: null,
  scoreFor: null,
  scoreAgainst: null,
  rank: null,
  ...overrides,
});

describe("PublicLiveMatchView", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(publicApi.listParticipants).mockResolvedValue([
      makePublicParticipant({ id: "p-1", displayName: "Aarav K." }),
      makePublicParticipant({ id: "p-2", displayName: "Mei L." }),
    ]);
  });

  it("shows the current score with the winner bolded and a game-by-game breakdown", async () => {
    vi.mocked(publicApi.getMatch).mockResolvedValue(
      makeMatch({
        id: MATCH_ID,
        status: "completed",
        roundLabel: "Final",
        resultPayload: {
          games: [
            [21, 15],
            [21, 18],
          ],
        },
        sides: [
          side("p-1", { outcome: "win", scoreFor: 2 }),
          side("p-2", { outcome: "loss", scoreFor: 0 }),
        ],
      }),
    );
    vi.mocked(publicApi.listMatchEvents).mockResolvedValue([]);
    renderWithProviders(<PublicLiveMatchView slug={SLUG} matchId={MATCH_ID} />);

    expect(await screen.findByText("Aarav K. vs Mei L.")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("21–15")).toBeInTheDocument();
    expect(screen.getByText("21–18")).toBeInTheDocument();
  });

  it("points to the bracket for advancement once the match is decided", async () => {
    vi.mocked(publicApi.getMatch).mockResolvedValue(
      makeMatch({
        id: MATCH_ID,
        status: "completed",
        sides: [side("p-1", { outcome: "win" }), side("p-2", { outcome: "loss" })],
      }),
    );
    vi.mocked(publicApi.listMatchEvents).mockResolvedValue([]);
    renderWithProviders(<PublicLiveMatchView slug={SLUG} matchId={MATCH_ID} />);

    const bracketLink = await screen.findByRole("link", { name: "bracket" });
    expect(bracketLink).toHaveAttribute("href", `/t/${SLUG}/bracket`);
  });

  it("does not show the advancement note for a match still in progress", async () => {
    vi.mocked(publicApi.getMatch).mockResolvedValue(
      makeMatch({ id: MATCH_ID, status: "scheduled", sides: [side("p-1"), side("p-2")] }),
    );
    vi.mocked(publicApi.listMatchEvents).mockResolvedValue([]);
    renderWithProviders(<PublicLiveMatchView slug={SLUG} matchId={MATCH_ID} />);

    await screen.findByText("Scheduled");
    expect(screen.queryByRole("link", { name: "bracket" })).not.toBeInTheDocument();
  });

  it("renders the match history", async () => {
    vi.mocked(publicApi.getMatch).mockResolvedValue(
      makeMatch({ id: MATCH_ID, status: "completed", sides: [side("p-1"), side("p-2")] }),
    );
    vi.mocked(publicApi.listMatchEvents).mockResolvedValue([
      makeMatchResultEvent({ matchId: MATCH_ID, type: "normal" }),
    ]);
    renderWithProviders(<PublicLiveMatchView slug={SLUG} matchId={MATCH_ID} />);

    expect(await screen.findByText("Score submitted")).toBeInTheDocument();
  });

  it("never renders an actorId even if the API somehow returned one", async () => {
    vi.mocked(publicApi.getMatch).mockResolvedValue(
      makeMatch({ id: MATCH_ID, status: "completed", sides: [side("p-1"), side("p-2")] }),
    );
    vi.mocked(publicApi.listMatchEvents).mockResolvedValue([
      makeMatchResultEvent({ matchId: MATCH_ID, type: "normal", actorId: "user-1" }),
    ]);
    renderWithProviders(<PublicLiveMatchView slug={SLUG} matchId={MATCH_ID} />);

    await screen.findByText("Score submitted");
    expect(screen.queryByText("user-1")).not.toBeInTheDocument();
  });
});
