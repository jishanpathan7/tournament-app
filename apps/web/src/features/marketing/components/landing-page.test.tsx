import { describe, expect, it, vi } from "vitest";

import { LandingPage } from "@/features/marketing/components/landing-page";
import { LandingRedirect } from "@/features/marketing/components/landing-redirect";
import { getRouterMock, renderWithProviders, screen } from "@/test/test-utils";

const { sessionState } = vi.hoisted(() => ({
  sessionState: { authenticated: false, loading: false },
}));

vi.mock("@/features/auth/use-session", () => ({
  useSession: () => ({
    session: sessionState.authenticated ? { id: "u1" } : null,
    isAuthenticated: sessionState.authenticated,
    isLoading: sessionState.loading,
  }),
}));

describe("LandingPage", () => {
  it("renders hero headline and primary CTAs", () => {
    renderWithProviders(<LandingPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/champion/i);
    expect(screen.getByRole("link", { name: /get started free/i })).toHaveAttribute(
      "href",
      "/register",
    );
    const signInLinks = screen.getAllByRole("link", { name: /^sign in$/i });
    expect(signInLinks.some((link) => link.getAttribute("href") === "/login")).toBe(true);
  });

  it("includes feature and sports sections", () => {
    renderWithProviders(<LandingPage />);
    expect(screen.getByRole("heading", { name: /everything organizers need/i })).toBeInTheDocument();
    expect(screen.getByText("Badminton")).toBeInTheDocument();
  });
});

describe("LandingRedirect", () => {
  it("redirects authenticated users to the console", () => {
    sessionState.authenticated = true;
    sessionState.loading = false;
    renderWithProviders(<LandingRedirect />);
    expect(getRouterMock().replace).toHaveBeenCalledWith("/console");
    sessionState.authenticated = false;
  });

  it("shows landing page for guests", () => {
    sessionState.authenticated = false;
    sessionState.loading = false;
    renderWithProviders(<LandingRedirect />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
