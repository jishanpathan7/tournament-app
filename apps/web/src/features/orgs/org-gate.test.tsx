import { beforeEach, describe, expect, it, vi } from "vitest";

import { getRouterMock, renderWithProviders, screen, waitFor } from "@/test/test-utils";

// Control session + switch mutation.
const { sessionRef, switchMock } = vi.hoisted(() => ({
  sessionRef: { current: null as unknown },
  switchMock: { mutate: vi.fn() },
}));
vi.mock("@/features/auth/use-session", () => ({
  useSession: () => sessionRef.current,
}));
vi.mock("@/features/orgs/use-orgs", () => ({ useSwitchOrg: () => switchMock }));

import { OrgGate } from "@/features/orgs/org-gate";

function session(over: Record<string, unknown>) {
  return {
    session: { id: "u1", email: "a@b.com", name: "A", organizations: [], ...over },
    isLoading: false,
    isAuthenticated: true,
  };
}

describe("OrgGate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders children when an org is active", () => {
    sessionRef.current = session({ activeOrganizationId: "o1", organizations: [{ id: "o1" }] });
    renderWithProviders(
      <OrgGate>
        <div>console content</div>
      </OrgGate>,
    );
    expect(screen.getByText("console content")).toBeInTheDocument();
  });

  it("redirects to onboarding when the user has no orgs", async () => {
    sessionRef.current = session({ activeOrganizationId: null, organizations: [] });
    renderWithProviders(
      <OrgGate>
        <div>console content</div>
      </OrgGate>,
    );
    await waitFor(() => expect(getRouterMock().replace).toHaveBeenCalledWith("/onboarding"));
    expect(screen.queryByText("console content")).not.toBeInTheDocument();
  });

  it("auto-enters the only org when none is active", async () => {
    sessionRef.current = session({ activeOrganizationId: null, organizations: [{ id: "solo" }] });
    renderWithProviders(
      <OrgGate>
        <div>console content</div>
      </OrgGate>,
    );
    await waitFor(() => expect(switchMock.mutate).toHaveBeenCalledWith("solo"));
  });

  it("routes to the selector with multiple orgs and none active", async () => {
    sessionRef.current = session({
      activeOrganizationId: null,
      organizations: [{ id: "o1" }, { id: "o2" }],
    });
    renderWithProviders(
      <OrgGate>
        <div>console content</div>
      </OrgGate>,
    );
    await waitFor(() =>
      expect(getRouterMock().replace).toHaveBeenCalledWith("/select-organization"),
    );
  });

  it("shows a loader (no redirect) while the session resolves", () => {
    sessionRef.current = { session: null, isLoading: true, isAuthenticated: false };
    renderWithProviders(
      <OrgGate>
        <div>console content</div>
      </OrgGate>,
    );
    expect(getRouterMock().replace).not.toHaveBeenCalled();
    expect(screen.queryByText("console content")).not.toBeInTheDocument();
  });
});
