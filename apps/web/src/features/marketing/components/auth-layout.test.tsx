import { describe, expect, it, vi } from "vitest";

import AuthLayout from "@/app/(auth)/layout";
import { AuthFormShell } from "@/features/marketing/components/auth-form-shell";
import { AuthRoleCards } from "@/features/marketing/components/auth-role-cards";
import { renderWithProviders, screen } from "@/test/test-utils";

vi.mock("@/features/auth/require-auth", () => ({
  RedirectIfAuthenticated: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("Auth layout components", () => {
  it("renders split layout with hero headline", () => {
    renderWithProviders(
      <AuthLayout>
        <div>Form slot</div>
      </AuthLayout>,
    );
    expect(screen.getByRole("heading", { name: /run any tournament/i })).toBeInTheDocument();
    expect(screen.getByText("Form slot")).toBeInTheDocument();
  });

  it("renders form shell header slots", () => {
    renderWithProviders(
      <AuthFormShell eyebrow="Welcome back" title="Sign in to Playlane" description="Test copy">
        <p>Form body</p>
      </AuthFormShell>,
    );
    expect(screen.getByRole("heading", { name: /sign in to playlane/i })).toBeInTheDocument();
    expect(screen.getByText("Form body")).toBeInTheDocument();
  });

  it("renders role exploration cards", () => {
    renderWithProviders(<AuthRoleCards />);
    expect(screen.getByText("Organizer")).toBeInTheDocument();
    expect(screen.getByText("Player")).toBeInTheDocument();
    expect(screen.getByText("Public Viewer")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /organizer/i })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: /player/i })).toHaveAttribute("href", "/portal");
    expect(screen.getByRole("link", { name: /public viewer/i })).toHaveAttribute("href", "/search");
  });
});
