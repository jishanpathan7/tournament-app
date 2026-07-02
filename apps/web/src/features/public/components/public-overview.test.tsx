import { beforeEach, describe, expect, it, vi } from "vitest";

import { PublicOverview } from "@/features/public/components/public-overview";
import { PublicTournamentProvider } from "@/features/public/components/public-tournament-provider";
import { makePublicDivision, makePublicStage, makePublicTournament } from "@/test/fixtures";
import { renderWithProviders, screen } from "@/test/test-utils";

// The provider opens a realtime subscription; not under test here (see
// use-public-realtime.test.tsx) and would otherwise try to open a real EventSource.
vi.mock("@/hooks/use-public-realtime", () => ({ usePublicRealtime: () => "idle" }));

vi.mock("@/features/public/public-api");
import * as publicApi from "@/features/public/public-api";

const SLUG = "sibl-open";

function renderOverview(tournament = makePublicTournament({ slug: SLUG, name: "SIBL Open" })) {
  return renderWithProviders(
    <PublicTournamentProvider slug={SLUG} initialTournament={tournament}>
      <PublicOverview slug={SLUG} />
    </PublicTournamentProvider>,
  );
}

describe("PublicOverview", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(publicApi.getTournament).mockResolvedValue(makePublicTournament({ slug: SLUG }));
  });

  it("renders the tournament name, status, and organizer", async () => {
    vi.mocked(publicApi.listDivisions).mockResolvedValue([]);
    vi.mocked(publicApi.listStages).mockResolvedValue([]);
    renderOverview(
      makePublicTournament({
        slug: SLUG,
        name: "SIBL Open",
        status: "live",
        organization: { slug: "sibl", name: "SIBL Badminton", branding: {} },
      }),
    );

    expect(await screen.findByText("SIBL Open")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("SIBL Badminton")).toBeInTheDocument();
  });

  it("shows divisions with capacity and registration status", async () => {
    vi.mocked(publicApi.listDivisions).mockResolvedValue([
      makePublicDivision({ id: "div-1", name: "Men's Singles", capacity: 32, approvedCount: 12 }),
    ]);
    vi.mocked(publicApi.listStages).mockResolvedValue([
      makePublicStage({ id: "stage-1", divisionId: "div-1", type: "single_elim", drawn: false }),
    ]);
    renderOverview(makePublicTournament({ slug: SLUG, status: "registration" }));

    expect(await screen.findByText("Men's Singles")).toBeInTheDocument();
    expect(screen.getByText("12 of 32 spots filled")).toBeInTheDocument();
    expect(screen.getByText("Registration open")).toBeInTheDocument();
    expect(screen.getByText("Single Elimination")).toBeInTheDocument();
  });

  it("shows an honest empty state when there are no divisions yet", async () => {
    vi.mocked(publicApi.listDivisions).mockResolvedValue([]);
    vi.mocked(publicApi.listStages).mockResolvedValue([]);
    renderOverview();

    expect(await screen.findByText("No divisions announced yet.")).toBeInTheDocument();
  });

  it("never fabricates venue or schedule data it doesn't have", async () => {
    vi.mocked(publicApi.listDivisions).mockResolvedValue([]);
    vi.mocked(publicApi.listStages).mockResolvedValue([]);
    renderOverview(makePublicTournament({ slug: SLUG, schedulePublishedAt: null }));

    expect(await screen.findByText("Venue TBA")).toBeInTheDocument();
    expect(screen.getByText("Detailed scheduling hasn't been published yet.")).toBeInTheDocument();
  });
});
