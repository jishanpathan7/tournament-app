import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, waitFor } from "@/test/test-utils";
import { makeTournament } from "@/test/fixtures";

// Control the signed-in role for permission assertions.
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

vi.mock("@/features/tournaments/tournaments-api");
import * as tournamentsApi from "@/features/tournaments/tournaments-api";
import { TournamentList } from "@/features/tournaments/components/tournament-list";

describe("TournamentList", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionState.role = "organizer";
  });

  it("shows a skeleton while loading", () => {
    vi.mocked(tournamentsApi.listTournaments).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<TournamentList />);
    expect(screen.getByTestId("card-grid-skeleton")).toBeInTheDocument();
  });

  it("renders tournament cards once loaded", async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      makeTournament({ name: "Spring Open" }),
      makeTournament({ name: "Winter Cup" }),
    ]);
    renderWithProviders(<TournamentList />);
    expect(await screen.findByText("Spring Open")).toBeInTheDocument();
    expect(screen.getByText("Winter Cup")).toBeInTheDocument();
  });

  it("shows the empty state when there are no tournaments", async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([]);
    renderWithProviders(<TournamentList />);
    expect(await screen.findByText("Run your first tournament")).toBeInTheDocument();
  });

  it("shows an error state with retry on failure", async () => {
    vi.mocked(tournamentsApi.listTournaments).mockRejectedValue(new Error("nope"));
    renderWithProviders(<TournamentList />);
    expect(await screen.findByText("Couldn't load tournaments")).toBeInTheDocument();
  });

  it("filters the list by search", async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([
      makeTournament({ name: "Spring Open" }),
      makeTournament({ name: "Winter Cup" }),
    ]);
    renderWithProviders(<TournamentList />);
    await screen.findByText("Spring Open");

    await userEvent.type(screen.getByLabelText("Search tournaments"), "winter");

    await waitFor(() => expect(screen.queryByText("Spring Open")).not.toBeInTheDocument());
    expect(screen.getByText("Winter Cup")).toBeInTheDocument();
  });

  it("shows the New tournament action for organizers", async () => {
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([makeTournament()]);
    renderWithProviders(<TournamentList />);
    expect(await screen.findByRole("link", { name: /new tournament/i })).toBeInTheDocument();
  });

  it("hides the New tournament action for viewers", async () => {
    sessionState.role = "viewer";
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue([makeTournament()]);
    renderWithProviders(<TournamentList />);
    await screen.findByText("Tournaments");
    expect(screen.queryByRole("link", { name: /new tournament/i })).not.toBeInTheDocument();
  });
});
