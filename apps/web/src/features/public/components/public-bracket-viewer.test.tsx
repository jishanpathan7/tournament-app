import { beforeEach, describe, expect, it, vi } from "vitest";

import { PublicBracketViewer } from "@/features/public/components/public-bracket-viewer";
import {
  makeMatch,
  makePublicDivision,
  makePublicParticipant,
  makePublicStage,
  makePublicTournament,
} from "@/test/fixtures";
import { renderWithProviders, screen } from "@/test/test-utils";

vi.mock("@/features/public/public-api");
import * as publicApi from "@/features/public/public-api";

vi.mock("@/features/public/components/public-tournament-provider", () => ({
  usePublicTournamentContext: () => ({
    tournament: makePublicTournament({ slug: SLUG }),
    slug: SLUG,
  }),
}));

const SLUG = "sibl-open";

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

describe("PublicBracketViewer", () => {
  beforeEach(() => vi.resetAllMocks());

  it("shows an empty state when no stage has been drawn yet", async () => {
    vi.mocked(publicApi.listDivisions).mockResolvedValue([]);
    vi.mocked(publicApi.listStages).mockResolvedValue([
      makePublicStage({ id: "stage-1", drawn: false }),
    ]);
    vi.mocked(publicApi.listMatches).mockResolvedValue([]);
    vi.mocked(publicApi.listParticipants).mockResolvedValue([]);
    renderWithProviders(<PublicBracketViewer slug={SLUG} />);

    expect(await screen.findByText("No bracket yet")).toBeInTheDocument();
  });

  it("renders a single-elimination tree with byes and a champion", async () => {
    const p1 = makePublicParticipant({ id: "p-1", displayName: "Aarav K." });
    vi.mocked(publicApi.listDivisions).mockResolvedValue([makePublicDivision({ id: "div-1" })]);
    vi.mocked(publicApi.listStages).mockResolvedValue([
      makePublicStage({ id: "stage-1", divisionId: "div-1", type: "single_elim", drawn: true }),
    ]);
    vi.mocked(publicApi.listMatches).mockResolvedValue([
      makeMatch({
        id: "m-1",
        stageId: "stage-1",
        roundLabel: "Final",
        status: "walkover",
        sides: [side("p-1", { outcome: "win" })],
      }),
    ]);
    vi.mocked(publicApi.listParticipants).mockResolvedValue([p1]);
    renderWithProviders(<PublicBracketViewer slug={SLUG} />);

    expect(await screen.findByText("Bye")).toBeInTheDocument();
    expect(screen.getByText("Champion")).toBeInTheDocument();
    expect(screen.getAllByText("Aarav K.").length).toBeGreaterThan(0);
  });

  it("renders round-robin fixtures grouped by pool", async () => {
    const p1 = makePublicParticipant({ id: "p-1", displayName: "Aarav K." });
    const p2 = makePublicParticipant({ id: "p-2", displayName: "Mei L." });
    vi.mocked(publicApi.listDivisions).mockResolvedValue([makePublicDivision({ id: "div-1" })]);
    vi.mocked(publicApi.listStages).mockResolvedValue([
      makePublicStage({ id: "stage-1", divisionId: "div-1", type: "round_robin", drawn: true }),
    ]);
    vi.mocked(publicApi.listMatches).mockResolvedValue([
      makeMatch({
        id: "m-1",
        stageId: "stage-1",
        groupName: "Pool A",
        status: "scheduled",
        sides: [side("p-1"), side("p-2")],
      }),
    ]);
    vi.mocked(publicApi.listParticipants).mockResolvedValue([p1, p2]);
    renderWithProviders(<PublicBracketViewer slug={SLUG} />);

    expect(await screen.findByText("Pool A")).toBeInTheDocument();
    expect(screen.getByText("Aarav K.")).toBeInTheDocument();
    expect(screen.getByText("Mei L.")).toBeInTheDocument();
  });

  it("shows a division/stage picker when more than one stage is drawn", async () => {
    vi.mocked(publicApi.listDivisions).mockResolvedValue([
      makePublicDivision({ id: "div-1", name: "Men's Singles" }),
      makePublicDivision({ id: "div-2", name: "Women's Singles" }),
    ]);
    vi.mocked(publicApi.listStages).mockResolvedValue([
      makePublicStage({ id: "stage-1", divisionId: "div-1", type: "single_elim", drawn: true }),
      makePublicStage({ id: "stage-2", divisionId: "div-2", type: "round_robin", drawn: true }),
    ]);
    vi.mocked(publicApi.listMatches).mockResolvedValue([]);
    vi.mocked(publicApi.listParticipants).mockResolvedValue([]);
    renderWithProviders(<PublicBracketViewer slug={SLUG} />);

    expect(await screen.findByRole("combobox", { name: "Choose a division" })).toBeInTheDocument();
  });
});
