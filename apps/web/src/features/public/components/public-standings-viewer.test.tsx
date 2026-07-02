import { beforeEach, describe, expect, it, vi } from "vitest";

import { PublicStandingsViewer } from "@/features/public/components/public-standings-viewer";
import { makePublicDivision, makePublicParticipant, makePublicStage } from "@/test/fixtures";
import { renderWithProviders, screen } from "@/test/test-utils";

vi.mock("@/features/public/public-api");
import * as publicApi from "@/features/public/public-api";

const SLUG = "sibl-open";

describe("PublicStandingsViewer", () => {
  beforeEach(() => vi.resetAllMocks());

  it("shows an empty state before any stage has been drawn", async () => {
    vi.mocked(publicApi.listDivisions).mockResolvedValue([]);
    vi.mocked(publicApi.listStages).mockResolvedValue([]);
    renderWithProviders(<PublicStandingsViewer slug={SLUG} />);

    expect(await screen.findByText("No standings yet")).toBeInTheDocument();
  });

  it("renders ranked rows with W-D-L, diff, and points, linking to participant profiles", async () => {
    const p1 = makePublicParticipant({ id: "p-1", displayName: "Aarav K." });
    vi.mocked(publicApi.listDivisions).mockResolvedValue([makePublicDivision({ id: "div-1" })]);
    vi.mocked(publicApi.listStages).mockResolvedValue([
      makePublicStage({ id: "stage-1", divisionId: "div-1", drawn: true }),
    ]);
    vi.mocked(publicApi.listParticipants).mockResolvedValue([p1]);
    vi.mocked(publicApi.getStandings).mockResolvedValue({
      stageId: "stage-1",
      rows: [
        {
          participantId: "p-1",
          groupId: null,
          played: 2,
          won: 2,
          drawn: 0,
          lost: 0,
          points: 2,
          scoreFor: 4,
          scoreAgainst: 1,
          diff: 3,
          rank: 1,
        },
      ],
    });
    renderWithProviders(<PublicStandingsViewer slug={SLUG} />);

    const link = await screen.findByRole("link", { name: "Aarav K." });
    expect(link).toHaveAttribute("href", `/t/${SLUG}/participants/p-1`);
    expect(screen.getByText("+3")).toBeInTheDocument();
  });

  it("shows a stage picker when more than one stage is drawn", async () => {
    vi.mocked(publicApi.listDivisions).mockResolvedValue([
      makePublicDivision({ id: "div-1", name: "Men's Singles" }),
      makePublicDivision({ id: "div-2", name: "Women's Singles" }),
    ]);
    vi.mocked(publicApi.listStages).mockResolvedValue([
      makePublicStage({ id: "stage-1", divisionId: "div-1", drawn: true }),
      makePublicStage({ id: "stage-2", divisionId: "div-2", drawn: true }),
    ]);
    vi.mocked(publicApi.listParticipants).mockResolvedValue([]);
    vi.mocked(publicApi.getStandings).mockResolvedValue({ stageId: "stage-1", rows: [] });
    renderWithProviders(<PublicStandingsViewer slug={SLUG} />);

    expect(await screen.findByRole("combobox", { name: "Choose a division" })).toBeInTheDocument();
  });
});
