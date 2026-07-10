import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CourtManagement } from "@/features/courts/components/court-management";
import { makeCourt, makeTournamentCourt } from "@/test/fixtures";
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

vi.mock("@/features/courts/courts-api");
import * as courtsApi from "@/features/courts/courts-api";

const TOURNAMENT_ID = "t-1";

describe("CourtManagement", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionState.role = "organizer";
    vi.mocked(courtsApi.listVenues).mockResolvedValue([]);
  });

  it("shows an empty state with an Add court action when no courts are assigned", async () => {
    vi.mocked(courtsApi.listTournamentCourts).mockResolvedValue([]);
    vi.mocked(courtsApi.listCourts).mockResolvedValue([]);
    renderWithProviders(<CourtManagement tournamentId={TOURNAMENT_ID} />);

    expect(await screen.findByText("Assign courts to schedule matches")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add court" }).length).toBeGreaterThan(0);
  });

  it("lists assigned courts with their venue and status", async () => {
    vi.mocked(courtsApi.listTournamentCourts).mockResolvedValue([
      makeTournamentCourt({ court: makeCourt({ name: "Court A", venueName: "Main Gym" }) }),
    ]);
    vi.mocked(courtsApi.listCourts).mockResolvedValue([]);
    renderWithProviders(<CourtManagement tournamentId={TOURNAMENT_ID} />);

    expect(await screen.findByText("Court A")).toBeInTheDocument();
    expect(screen.getByText("Main Gym")).toBeInTheDocument();
  });

  it("hides management controls for a role without schedule:manage", async () => {
    sessionState.role = "viewer";
    vi.mocked(courtsApi.listTournamentCourts).mockResolvedValue([
      makeTournamentCourt({ court: makeCourt({ name: "Court A", status: "active" }) }),
    ]);
    vi.mocked(courtsApi.listCourts).mockResolvedValue([]);
    renderWithProviders(<CourtManagement tournamentId={TOURNAMENT_ID} />);

    await screen.findByText("Court A");
    expect(screen.queryByRole("button", { name: "Add court" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument(); // read-only badge instead of a select
  });

  it("removes a court when Remove is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(courtsApi.listTournamentCourts).mockResolvedValue([
      makeTournamentCourt({ id: "tc-1", court: makeCourt({ id: "c-1", name: "Court A" }) }),
    ]);
    vi.mocked(courtsApi.listCourts).mockResolvedValue([]);
    vi.mocked(courtsApi.unassignCourt).mockResolvedValue(undefined);
    renderWithProviders(<CourtManagement tournamentId={TOURNAMENT_ID} />);

    await user.click(await screen.findByRole("button", { name: "Remove" }));

    expect(courtsApi.unassignCourt).toHaveBeenCalledWith(TOURNAMENT_ID, "c-1");
  });

  it("offers to assign an existing unassigned court", async () => {
    vi.mocked(courtsApi.listTournamentCourts).mockResolvedValue([]);
    vi.mocked(courtsApi.listCourts).mockResolvedValue([
      makeCourt({ id: "c-unassigned", name: "Court B", venueName: "Annex" }),
    ]);
    renderWithProviders(<CourtManagement tournamentId={TOURNAMENT_ID} />);

    const toggle = await screen.findByRole("button", { name: /existing courts/i });
    expect(toggle).toBeInTheDocument();
    toggle.click();
    expect(await screen.findByRole("button", { name: "Assign" })).toBeInTheDocument();
  });
});
