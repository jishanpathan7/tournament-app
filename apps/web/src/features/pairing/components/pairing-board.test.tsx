import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeEntrant, makePairingRun, makeProposedTeam } from "@/test/fixtures";
import { renderWithProviders, screen, waitFor } from "@/test/test-utils";

// Control the signed-in role — real `useCan` computes permissions from it.
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

vi.mock("@/features/pairing/pairing-api");
import * as pairingApi from "@/features/pairing/pairing-api";
import { PairingBoard } from "@/features/pairing/components/pairing-board";

const TOURNAMENT_ID = "t-1";
const DIVISION_ID = "div-1";

function twoTeamRun() {
  return makePairingRun({
    id: "run-1",
    divisionId: DIVISION_ID,
    entrants: [
      makeEntrant({ registrationId: "a", displayName: "Aarav", skillLevel: "advanced" }),
      makeEntrant({ registrationId: "b", displayName: "Mei", skillLevel: "beginner" }),
      makeEntrant({ registrationId: "c", displayName: "Chen", skillLevel: "intermediate" }),
      makeEntrant({ registrationId: "d", displayName: "Devi", skillLevel: "intermediate" }),
    ],
    teams: [
      makeProposedTeam({ id: "t1", memberIds: ["a", "b"], strength: 4, confidence: 1 }),
      makeProposedTeam({ id: "t2", memberIds: ["c", "d"], strength: 4, confidence: 1 }),
    ],
  });
}

function renderBoard() {
  return renderWithProviders(
    <PairingBoard tournamentId={TOURNAMENT_ID} divisionId={DIVISION_ID} />,
  );
}

describe("PairingBoard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionState.role = "organizer";
  });

  it("shows the empty state with a generate CTA when no run exists", async () => {
    vi.mocked(pairingApi.getPairing).mockResolvedValue(null);
    renderBoard();

    expect(await screen.findByText("No teams yet")).toBeInTheDocument();
    // Both the header and the empty-state CTA offer to generate.
    expect(screen.getAllByRole("button", { name: /generate teams/i }).length).toBeGreaterThan(0);
  });

  it("renders teams with members, skills, and the confidence visualization", async () => {
    vi.mocked(pairingApi.getPairing).mockResolvedValue(twoTeamRun());
    renderBoard();

    expect(await screen.findByText("Aarav")).toBeInTheDocument();
    expect(screen.getByText("Mei")).toBeInTheDocument();
    // Skill badges + confidence bands are shown.
    expect(screen.getAllByText("Advanced").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Balanced · 100%/).length).toBe(2);
    expect(screen.getByText("2 teams")).toBeInTheDocument();
  });

  it("generates teams when the CTA is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(pairingApi.getPairing).mockResolvedValue(null);
    vi.mocked(pairingApi.generatePairing).mockResolvedValue(twoTeamRun());
    renderBoard();

    const buttons = await screen.findAllByRole("button", { name: /generate teams/i });
    await user.click(buttons[0]!);
    await waitFor(() => expect(pairingApi.generatePairing).toHaveBeenCalledWith(DIVISION_ID, {}));
  });

  it("swaps two members across teams via two clicks", async () => {
    const user = userEvent.setup();
    vi.mocked(pairingApi.getPairing).mockResolvedValue(twoTeamRun());
    vi.mocked(pairingApi.swapMembers).mockResolvedValue(twoTeamRun());
    renderBoard();

    await user.click(await screen.findByRole("button", { name: /Aarav/ }));
    await user.click(screen.getByRole("button", { name: /Chen/ }));

    await waitFor(() =>
      expect(pairingApi.swapMembers).toHaveBeenCalledWith("run-1", {
        memberA: "a",
        memberB: "c",
      }),
    );
  });

  it("locks a team", async () => {
    const user = userEvent.setup();
    vi.mocked(pairingApi.getPairing).mockResolvedValue(twoTeamRun());
    vi.mocked(pairingApi.updateProposedTeam).mockResolvedValue(
      makeProposedTeam({ id: "t1", locked: true }),
    );
    renderBoard();

    const lockButtons = await screen.findAllByRole("button", { name: /lock team/i });
    await user.click(lockButtons[0]!);
    await waitFor(() => expect(pairingApi.updateProposedTeam).toHaveBeenCalled());
  });

  it("publishes after confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(pairingApi.getPairing).mockResolvedValue(twoTeamRun());
    vi.mocked(pairingApi.publishPairing).mockResolvedValue({
      runId: "run-1",
      publishedTeams: 2,
      unpairedCount: 0,
    });
    renderBoard();

    await user.click(await screen.findByRole("button", { name: /^Publish$/ }));
    // Confirm dialog → confirm.
    await user.click(await screen.findByRole("button", { name: /Publish teams/ }));
    await waitFor(() => expect(pairingApi.publishPairing).toHaveBeenCalledWith("run-1"));
  });

  it("hides management controls for a viewer", async () => {
    sessionState.role = "viewer";
    vi.mocked(pairingApi.getPairing).mockResolvedValue(twoTeamRun());
    renderBoard();

    await screen.findByText("Aarav");
    expect(screen.queryByRole("button", { name: /Regenerate/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Publish$/ })).not.toBeInTheDocument();
    // Members are plain text, not swap buttons, for a viewer.
    expect(screen.queryByRole("button", { name: /Aarav/ })).not.toBeInTheDocument();
  });

  it("shows unpaired reserves", async () => {
    const run = makePairingRun({
      id: "run-1",
      divisionId: DIVISION_ID,
      entrants: [
        makeEntrant({ registrationId: "a", displayName: "Solo Sam", skillLevel: "advanced" }),
      ],
      teams: [],
      unpairedIds: ["a"],
    });
    vi.mocked(pairingApi.getPairing).mockResolvedValue(run);
    renderBoard();

    expect(await screen.findByText("Unpaired reserves")).toBeInTheDocument();
    expect(screen.getByText("Solo Sam")).toBeInTheDocument();
  });
});
