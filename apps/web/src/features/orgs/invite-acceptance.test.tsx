import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getRouterMock,
  renderWithProviders,
  screen,
  setSearchParams,
  waitFor,
} from "@/test/test-utils";

const { sessionRef, acceptMock } = vi.hoisted(() => ({
  sessionRef: { current: { session: null as unknown, isLoading: false } },
  acceptMock: {
    mutate: vi.fn(),
    isError: false,
    error: null as unknown,
  },
}));
vi.mock("@/features/auth/use-session", () => ({ useSession: () => sessionRef.current }));
vi.mock("@/features/orgs/use-orgs", () => ({ useAcceptInvite: () => acceptMock }));

import { InviteAcceptance } from "@/features/orgs/invite-acceptance";

describe("InviteAcceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    acceptMock.isError = false;
    sessionRef.current = { session: null, isLoading: false };
  });

  it("accepts the invite and enters the dashboard when signed in", async () => {
    sessionRef.current = { session: { id: "u1" }, isLoading: false };
    acceptMock.mutate.mockImplementation((_token, opts) => opts?.onSuccess?.());
    setSearchParams("token=abc123");

    renderWithProviders(<InviteAcceptance />);

    await waitFor(() =>
      expect(acceptMock.mutate).toHaveBeenCalledWith("abc123", expect.anything()),
    );
    expect(getRouterMock().replace).toHaveBeenCalledWith("/console");
  });

  it("bounces to login (preserving the token) when signed out", async () => {
    sessionRef.current = { session: null, isLoading: false };
    setSearchParams("token=abc123");

    renderWithProviders(<InviteAcceptance />);

    await waitFor(() =>
      expect(getRouterMock().replace).toHaveBeenCalledWith(
        `/login?next=${encodeURIComponent("/invite?token=abc123")}`,
      ),
    );
    expect(acceptMock.mutate).not.toHaveBeenCalled();
  });

  it("shows an invalid state when the token is missing", () => {
    sessionRef.current = { session: { id: "u1" }, isLoading: false };
    setSearchParams("");

    renderWithProviders(<InviteAcceptance />);

    expect(screen.getByText("This invite link is invalid")).toBeInTheDocument();
    expect(acceptMock.mutate).not.toHaveBeenCalled();
  });
});
