import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PublicFixturesList } from "@/features/public/components/public-fixtures-list";
import { makeMatch, makePublicParticipant, makePublicStage } from "@/test/fixtures";
import { renderWithProviders, screen } from "@/test/test-utils";

vi.mock("@/features/public/public-api");
import * as publicApi from "@/features/public/public-api";

const SLUG = "sibl-open";

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

describe("PublicFixturesList", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(publicApi.listStages).mockResolvedValue([makePublicStage({ id: "stage-1" })]);
  });

  it("shows an empty state when there are no matches at all", async () => {
    vi.mocked(publicApi.listMatches).mockResolvedValue([]);
    vi.mocked(publicApi.listParticipants).mockResolvedValue([]);
    renderWithProviders(<PublicFixturesList slug={SLUG} />);

    expect(await screen.findByText("No fixtures yet")).toBeInTheDocument();
  });

  it("buckets matches into Today/Upcoming/Completed", async () => {
    const p1 = makePublicParticipant({ id: "p-1", displayName: "Aarav K." });
    const p2 = makePublicParticipant({ id: "p-2", displayName: "Mei L." });
    vi.mocked(publicApi.listMatches).mockResolvedValue([
      makeMatch({ id: "m-1", stageId: "stage-1", status: "completed", sides: [side("p-1"), side("p-2")] }),
      makeMatch({ id: "m-2", stageId: "stage-1", status: "pending", sides: [] }),
    ]);
    vi.mocked(publicApi.listParticipants).mockResolvedValue([p1, p2]);
    renderWithProviders(<PublicFixturesList slug={SLUG} />);

    expect(await screen.findByRole("heading", { name: "Completed" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Upcoming" })).toBeInTheDocument();
  });

  it("filters by participant search", async () => {
    const user = userEvent.setup();
    const p1 = makePublicParticipant({ id: "p-1", displayName: "Aarav K." });
    const p2 = makePublicParticipant({ id: "p-2", displayName: "Mei L." });
    vi.mocked(publicApi.listMatches).mockResolvedValue([
      makeMatch({ id: "m-1", stageId: "stage-1", status: "scheduled", sides: [side("p-1"), side("p-2")] }),
    ]);
    vi.mocked(publicApi.listParticipants).mockResolvedValue([p1, p2]);
    renderWithProviders(<PublicFixturesList slug={SLUG} />);
    await screen.findByText("Aarav K.");

    await user.type(screen.getByLabelText("Search fixtures"), "nobody");

    expect(await screen.findByText("No matches match")).toBeInTheDocument();
  });

  it("links each fixture to its live match view", async () => {
    const p1 = makePublicParticipant({ id: "p-1", displayName: "Aarav K." });
    const p2 = makePublicParticipant({ id: "p-2", displayName: "Mei L." });
    vi.mocked(publicApi.listMatches).mockResolvedValue([
      makeMatch({ id: "m-1", stageId: "stage-1", status: "scheduled", sides: [side("p-1"), side("p-2")] }),
    ]);
    vi.mocked(publicApi.listParticipants).mockResolvedValue([p1, p2]);
    renderWithProviders(<PublicFixturesList slug={SLUG} />);

    const name = await screen.findByText("Aarav K.");
    const link = name.closest("a");
    expect(link).toHaveAttribute("href", `/t/${SLUG}/matches/m-1`);
  });
});
