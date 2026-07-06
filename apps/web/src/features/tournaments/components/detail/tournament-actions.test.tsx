import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, waitFor } from "@/test/test-utils";
import { makeTournament } from "@/test/fixtures";

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
import { TournamentActions } from "@/features/tournaments/components/detail/tournament-actions";

describe("TournamentActions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionState.role = "organizer";
  });

  it("renders nothing for roles without tournament:update", () => {
    sessionState.role = "viewer";
    const { container } = renderWithProviders(
      <TournamentActions tournament={makeTournament({ status: "draft" })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("exposes Publish and Actions for organizers", () => {
    renderWithProviders(<TournamentActions tournament={makeTournament({ status: "draft" })} />);
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /actions/i })).toBeInTheDocument();
  });

  it("runs a lifecycle transition through the confirm dialog", async () => {
    const user = userEvent.setup();
    const tournament = makeTournament({ status: "draft" });
    vi.mocked(tournamentsApi.transitionStatus).mockResolvedValue({
      ...tournament,
      status: "registration",
    });

    renderWithProviders(<TournamentActions tournament={tournament} />);

    await user.click(screen.getByRole("button", { name: /actions/i }));
    await user.click(await screen.findByRole("menuitem", { name: /open registration/i }));

    // Confirm dialog shows the action; confirm calls the API with the target status.
    const confirm = await screen.findByRole("button", { name: "Open registration" });
    await user.click(confirm);

    await waitFor(() =>
      expect(tournamentsApi.transitionStatus).toHaveBeenCalledWith(tournament.id, {
        status: "registration",
      }),
    );
  });
});
