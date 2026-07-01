import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getRouterMock, renderWithProviders, screen, waitFor } from "@/test/test-utils";

const { sessionRef, switchMock } = vi.hoisted(() => ({
  sessionRef: { current: { session: null as unknown } },
  switchMock: { mutate: vi.fn(), isPending: false, variables: undefined as unknown },
}));
vi.mock("@/features/auth/use-session", () => ({ useSession: () => sessionRef.current }));
vi.mock("@/features/orgs/use-orgs", () => ({ useSwitchOrg: () => switchMock }));

import { OrganizationSelector } from "@/features/orgs/organization-selector";

describe("OrganizationSelector", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists memberships and switches into the chosen org", async () => {
    const user = userEvent.setup();
    sessionRef.current = {
      session: {
        activeOrganizationId: "o1",
        organizations: [
          { id: "o1", name: "Alpha Club", role: "owner" },
          { id: "o2", name: "Beta League", role: "organizer" },
        ],
      },
    };
    switchMock.mutate.mockImplementation((_id, opts) => opts?.onSuccess?.());

    renderWithProviders(<OrganizationSelector />);

    expect(screen.getByText("Alpha Club")).toBeInTheDocument();
    await user.click(screen.getByText("Beta League"));

    await waitFor(() => expect(switchMock.mutate).toHaveBeenCalledWith("o2", expect.anything()));
    expect(getRouterMock().replace).toHaveBeenCalledWith("/console");
  });

  it("shows a create CTA when the user has no organizations", () => {
    sessionRef.current = { session: { activeOrganizationId: null, organizations: [] } };
    renderWithProviders(<OrganizationSelector />);
    expect(screen.getByText("You're not in any organization yet")).toBeInTheDocument();
  });

  it("just enters the dashboard when the active org is re-selected", async () => {
    const user = userEvent.setup();
    sessionRef.current = {
      session: {
        activeOrganizationId: "o1",
        organizations: [{ id: "o1", name: "Alpha Club", role: "owner" }],
      },
    };
    renderWithProviders(<OrganizationSelector />);

    await user.click(screen.getByText("Alpha Club"));
    expect(switchMock.mutate).not.toHaveBeenCalled();
    expect(getRouterMock().replace).toHaveBeenCalledWith("/console");
  });
});
