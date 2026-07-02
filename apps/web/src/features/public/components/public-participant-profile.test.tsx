import { beforeEach, describe, expect, it, vi } from "vitest";

import { PublicParticipantProfile } from "@/features/public/components/public-participant-profile";
import { makeMatch, makePublicDivision, makePublicParticipant, makePublicStage } from "@/test/fixtures";
import { renderWithProviders, screen } from "@/test/test-utils";

vi.mock("@/features/public/public-api");
import * as publicApi from "@/features/public/public-api";

const SLUG = "sibl-open";
const PARTICIPANT_ID = "p-1";

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

function setup() {
  vi.mocked(publicApi.getParticipant).mockResolvedValue(
    makePublicParticipant({ id: PARTICIPANT_ID, displayName: "Aarav K.", divisionId: "div-1", seed: 1 }),
  );
  vi.mocked(publicApi.listDivisions).mockResolvedValue([
    makePublicDivision({ id: "div-1", name: "Men's Singles" }),
  ]);
  vi.mocked(publicApi.listStages).mockResolvedValue([
    makePublicStage({ id: "stage-1", divisionId: "div-1", drawn: true }),
  ]);
  vi.mocked(publicApi.listParticipants).mockResolvedValue([
    makePublicParticipant({ id: PARTICIPANT_ID, displayName: "Aarav K." }),
    makePublicParticipant({ id: "p-2", displayName: "Mei L." }),
  ]);
}

describe("PublicParticipantProfile", () => {
  beforeEach(() => vi.resetAllMocks());

  it("renders the profile with kind, division, and seed", async () => {
    setup();
    vi.mocked(publicApi.listMatches).mockResolvedValue([]);
    vi.mocked(publicApi.getStandings).mockResolvedValue({ stageId: "stage-1", rows: [] });
    renderWithProviders(<PublicParticipantProfile slug={SLUG} participantId={PARTICIPANT_ID} />);

    expect(await screen.findByText("Aarav K.")).toBeInTheDocument();
    expect(screen.getByText("Men's Singles")).toBeInTheDocument();
    expect(screen.getByText("Seed 1")).toBeInTheDocument();
  });

  it("shows standings position when available", async () => {
    setup();
    vi.mocked(publicApi.listMatches).mockResolvedValue([]);
    vi.mocked(publicApi.getStandings).mockResolvedValue({
      stageId: "stage-1",
      rows: [
        {
          participantId: PARTICIPANT_ID,
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
    renderWithProviders(<PublicParticipantProfile slug={SLUG} participantId={PARTICIPANT_ID} />);

    expect(await screen.findByText("Standing")).toBeInTheDocument();
    expect(screen.getByText("2-0-0")).toBeInTheDocument();
  });

  it("splits current and completed matches into separate sections", async () => {
    setup();
    vi.mocked(publicApi.listMatches).mockResolvedValue([
      makeMatch({
        id: "m-1",
        stageId: "stage-1",
        status: "completed",
        sides: [side(PARTICIPANT_ID, { outcome: "win" }), side("p-2", { outcome: "loss" })],
      }),
      makeMatch({
        id: "m-2",
        stageId: "stage-1",
        status: "scheduled",
        sides: [side(PARTICIPANT_ID), side("p-2")],
      }),
    ]);
    vi.mocked(publicApi.getStandings).mockResolvedValue({ stageId: "stage-1", rows: [] });
    renderWithProviders(<PublicParticipantProfile slug={SLUG} participantId={PARTICIPANT_ID} />);

    expect(await screen.findByText("Current matches")).toBeInTheDocument();
    expect(screen.getByText("Match history")).toBeInTheDocument();
    expect(screen.getAllByText("vs Mei L.")).toHaveLength(2);
  });

  it("shows an error state for an unknown participant", async () => {
    vi.mocked(publicApi.getParticipant).mockRejectedValue(new Error("not found"));
    renderWithProviders(<PublicParticipantProfile slug={SLUG} participantId="missing" />);

    expect(await screen.findByText("Participant not found")).toBeInTheDocument();
  });
});
