import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, waitFor, within } from "@/test/test-utils";
import { makeDivision, makeMember, makeParticipant, makeRegistration } from "@/test/fixtures";

// Control the signed-in role for permission assertions (real `useCan` computes from it).
const { sessionState } = vi.hoisted(() => ({
  sessionState: { role: "organizer" as string | null, id: "organizer-1" },
}));
vi.mock("@/features/auth/use-session", () => ({
  useSession: () => ({
    session: sessionState.role ? { id: sessionState.id, activeRole: sessionState.role } : null,
    isAuthenticated: !!sessionState.role,
    isLoading: false,
  }),
}));

vi.mock("@/features/registrations/registrations-api");
vi.mock("@/features/orgs/orgs-api");
vi.mock("@/features/tournaments/tournaments-api");
import * as orgsApi from "@/features/orgs/orgs-api";
import * as registrationsApi from "@/features/registrations/registrations-api";
import * as tournamentsApi from "@/features/tournaments/tournaments-api";
import { RegistrationManagement } from "@/features/registrations/components/registration-management";

const TOURNAMENT_ID = "t-1";
const DIVISION_ID = "div-1";

function setupDivisionAndMembers() {
  vi.mocked(tournamentsApi.listDivisions).mockResolvedValue([
    makeDivision({
      id: DIVISION_ID,
      tournamentId: TOURNAMENT_ID,
      name: "Men's Doubles",
      capacity: 4,
    }),
  ]);
  vi.mocked(orgsApi.listMembers).mockResolvedValue([
    makeMember({ userId: "u-alice", name: "Alice Chen" }),
    makeMember({ userId: "u-bob", name: "Bob Diaz" }),
  ]);
}

describe("RegistrationManagement", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionState.role = "organizer";
    sessionState.id = "organizer-1";
  });

  it("shows a skeleton while loading", () => {
    setupDivisionAndMembers();
    vi.mocked(registrationsApi.listRegistrations).mockReturnValue(new Promise(() => {}));
    vi.mocked(registrationsApi.listParticipants).mockReturnValue(new Promise(() => {}));
    renderWithProviders(
      <RegistrationManagement tournamentId={TOURNAMENT_ID} divisionId={DIVISION_ID} />,
    );
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows the empty state when there are no registrations", async () => {
    setupDivisionAndMembers();
    vi.mocked(registrationsApi.listRegistrations).mockResolvedValue([]);
    vi.mocked(registrationsApi.listParticipants).mockResolvedValue([]);
    renderWithProviders(
      <RegistrationManagement tournamentId={TOURNAMENT_ID} divisionId={DIVISION_ID} />,
    );
    expect(await screen.findByText("No registrations yet")).toBeInTheDocument();
  });

  it("shows an error state with the queue unreachable", async () => {
    setupDivisionAndMembers();
    vi.mocked(registrationsApi.listRegistrations).mockRejectedValue(new Error("boom"));
    vi.mocked(registrationsApi.listParticipants).mockResolvedValue([]);
    renderWithProviders(
      <RegistrationManagement tournamentId={TOURNAMENT_ID} divisionId={DIVISION_ID} />,
    );
    expect(await screen.findByText("Couldn't load registrations")).toBeInTheDocument();
  });

  it("renders the capacity summary derived from participants + registrations", async () => {
    setupDivisionAndMembers();
    vi.mocked(registrationsApi.listRegistrations).mockResolvedValue([
      makeRegistration({ submittedBy: "u-alice", status: "approved", participantId: "p-1" }),
      makeRegistration({ submittedBy: "u-bob", status: "submitted" }),
    ]);
    vi.mocked(registrationsApi.listParticipants).mockResolvedValue([
      makeParticipant({ id: "p-1", status: "approved" }),
    ]);
    renderWithProviders(
      <RegistrationManagement tournamentId={TOURNAMENT_ID} divisionId={DIVISION_ID} />,
    );

    expect(await screen.findByText("3 of 4 slots remaining")).toBeInTheDocument();
    expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    expect(screen.getByText("Bob Diaz")).toBeInTheDocument();
  });

  it("filters the queue by search", async () => {
    const user = userEvent.setup();
    setupDivisionAndMembers();
    vi.mocked(registrationsApi.listRegistrations).mockResolvedValue([
      makeRegistration({ submittedBy: "u-alice", status: "submitted" }),
      makeRegistration({ submittedBy: "u-bob", status: "submitted" }),
    ]);
    vi.mocked(registrationsApi.listParticipants).mockResolvedValue([]);
    renderWithProviders(
      <RegistrationManagement tournamentId={TOURNAMENT_ID} divisionId={DIVISION_ID} />,
    );
    await screen.findByText("Alice Chen");

    await user.type(screen.getByLabelText("Search registrations"), "bob");

    await waitFor(() => expect(screen.queryByText("Alice Chen")).not.toBeInTheDocument());
    expect(screen.getByText("Bob Diaz")).toBeInTheDocument();
  });

  it("filters the queue by status", async () => {
    const user = userEvent.setup();
    setupDivisionAndMembers();
    vi.mocked(registrationsApi.listRegistrations).mockResolvedValue([
      makeRegistration({ submittedBy: "u-alice", status: "submitted" }),
      makeRegistration({ submittedBy: "u-bob", status: "waitlisted" }),
    ]);
    vi.mocked(registrationsApi.listParticipants).mockResolvedValue([]);
    renderWithProviders(
      <RegistrationManagement tournamentId={TOURNAMENT_ID} divisionId={DIVISION_ID} />,
    );
    await screen.findByText("Alice Chen");

    await user.click(screen.getByLabelText("Filter by status"));
    await user.click(await screen.findByRole("option", { name: "Waitlisted" }));

    await waitFor(() => expect(screen.queryByText("Alice Chen")).not.toBeInTheDocument());
    expect(screen.getByText("Bob Diaz")).toBeInTheDocument();
  });

  it("opens the detail dialog when a row is activated", async () => {
    const user = userEvent.setup();
    setupDivisionAndMembers();
    vi.mocked(registrationsApi.listRegistrations).mockResolvedValue([
      makeRegistration({
        submittedBy: "u-alice",
        status: "submitted",
        skillLevel: "advanced",
        formResponse: {},
      }),
    ]);
    vi.mocked(registrationsApi.listParticipants).mockResolvedValue([]);
    renderWithProviders(
      <RegistrationManagement tournamentId={TOURNAMENT_ID} divisionId={DIVISION_ID} />,
    );
    const row = await screen.findByRole("button", { name: /open registration from alice/i });
    await user.click(row);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByText("advanced")).toBeInTheDocument();
  });

  it("selects rows and fires a bulk approve", async () => {
    const user = userEvent.setup();
    setupDivisionAndMembers();
    vi.mocked(registrationsApi.listRegistrations).mockResolvedValue([
      makeRegistration({ id: "r-1", submittedBy: "u-alice", status: "submitted" }),
      makeRegistration({ id: "r-2", submittedBy: "u-bob", status: "submitted" }),
    ]);
    vi.mocked(registrationsApi.listParticipants).mockResolvedValue([]);
    vi.mocked(registrationsApi.bulkApproveRegistrations).mockResolvedValue({
      approved: 2,
      waitlisted: 0,
      skipped: 0,
    });
    renderWithProviders(
      <RegistrationManagement tournamentId={TOURNAMENT_ID} divisionId={DIVISION_ID} />,
    );
    await screen.findByText("Alice Chen");

    const checkboxes = screen.getAllByRole("checkbox", { name: /select registration from/i });
    await user.click(checkboxes[0]!);
    await user.click(checkboxes[1]!);

    const toolbar = screen.getByText("2 selected").closest("div")!;
    await user.click(within(toolbar).getByRole("button", { name: "Approve All" }));

    await waitFor(() =>
      expect(registrationsApi.bulkApproveRegistrations).toHaveBeenCalledWith(DIVISION_ID),
    );
  });

  it("hides the Registrations tab, checkboxes, and export for a non-managing role", async () => {
    sessionState.role = "viewer";
    setupDivisionAndMembers();
    vi.mocked(registrationsApi.listRegistrations).mockResolvedValue([]);
    vi.mocked(registrationsApi.listParticipants).mockResolvedValue([
      makeParticipant({ displayName: "Some Participant" }),
    ]);
    renderWithProviders(
      <RegistrationManagement tournamentId={TOURNAMENT_ID} divisionId={DIVISION_ID} />,
    );

    expect(await screen.findByText("Some Participant")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Registrations" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export CSV" })).not.toBeInTheDocument();
    expect(registrationsApi.listRegistrations).not.toHaveBeenCalled();
  });
});
