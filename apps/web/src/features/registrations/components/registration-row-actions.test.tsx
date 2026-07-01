import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/test/test-utils";
import { makeRegistration } from "@/test/fixtures";

const { sessionState } = vi.hoisted(() => ({
  sessionState: { id: "organizer-1" as string | null },
}));
vi.mock("@/features/auth/use-session", () => ({
  useSession: () => ({ session: sessionState.id ? { id: sessionState.id } : null }),
}));

vi.mock("@/features/registrations/registrations-api");
import * as registrationsApi from "@/features/registrations/registrations-api";
import { RegistrationRowActions } from "@/features/registrations/components/registration-row-actions";

describe("RegistrationRowActions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionState.id = "organizer-1";
  });

  it("shows approve/waitlist/reject for an organizer on a pending registration", () => {
    const registration = makeRegistration({ status: "submitted", submittedBy: "someone-else" });
    renderWithProviders(
      <RegistrationRowActions registration={registration} divisionId="div-1" canManage />,
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Waitlist" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("hides decision actions for a viewer without tournament:update", () => {
    const registration = makeRegistration({ status: "submitted", submittedBy: "someone-else" });
    renderWithProviders(
      <RegistrationRowActions registration={registration} divisionId="div-1" canManage={false} />,
    );
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("hides decision actions once the registration is no longer actionable", () => {
    const registration = makeRegistration({ status: "approved", submittedBy: "someone-else" });
    renderWithProviders(
      <RegistrationRowActions registration={registration} divisionId="div-1" canManage />,
    );
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("omits the waitlist button when already waitlisted (approve/reject only)", () => {
    const registration = makeRegistration({ status: "waitlisted", submittedBy: "someone-else" });
    renderWithProviders(
      <RegistrationRowActions registration={registration} divisionId="div-1" canManage />,
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Waitlist" })).not.toBeInTheDocument();
  });

  it("shows Withdraw only to the submitter, never to an organizer viewing someone else's entry", () => {
    const registration = makeRegistration({ status: "submitted", submittedBy: "organizer-1" });
    renderWithProviders(
      <RegistrationRowActions registration={registration} divisionId="div-1" canManage={false} />,
    );
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeInTheDocument();
  });

  it("renders nothing when the viewer can neither manage nor withdraw", () => {
    const registration = makeRegistration({ status: "approved", submittedBy: "someone-else" });
    const { container } = renderWithProviders(
      <RegistrationRowActions registration={registration} divisionId="div-1" canManage={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("calls approveRegistration when Approve is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(registrationsApi.approveRegistration).mockResolvedValue({
      registrationId: "r-1",
      status: "approved",
      participantId: "p-1",
    });
    const registration = makeRegistration({ id: "r-1", status: "submitted" });
    renderWithProviders(
      <RegistrationRowActions registration={registration} divisionId="div-1" canManage />,
    );

    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(registrationsApi.approveRegistration).toHaveBeenCalled();
  });
});
