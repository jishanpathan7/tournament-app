import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getRouterMock, renderWithProviders, screen, waitFor } from "@/test/test-utils";

const { createMock, patchMock } = vi.hoisted(() => ({
  createMock: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false },
  patchMock: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false },
}));
vi.mock("@/features/orgs/use-orgs", () => ({
  useCreateOrg: () => createMock,
  useUpdateActiveOrg: () => patchMock,
}));
vi.mock("@/features/orgs/orgs-api", () => ({ uploadOrgLogo: vi.fn() }));

import { CreateOrganizationForm } from "@/features/orgs/create-organization-form";

describe("CreateOrganizationForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an org (auto-slug), patches branding, and enters the dashboard", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateOrganizationForm />);

    await user.type(screen.getByLabelText("Organization name"), "My Club");
    await user.click(screen.getByRole("button", { name: /create organization/i }));

    await waitFor(() =>
      expect(createMock.mutateAsync).toHaveBeenCalledWith({ name: "My Club", slug: "my-club" }),
    );
    // branding carries the onboarding-only fields (country/sport/logo) via PATCH.
    expect(patchMock.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        timezone: expect.any(String),
        branding: expect.objectContaining({ defaultSport: "badminton", country: "IN" }),
      }),
    );
    expect(getRouterMock().replace).toHaveBeenCalledWith("/console");
  });

  it("blocks submission with a validation error when the name is empty", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateOrganizationForm />);

    await user.click(screen.getByRole("button", { name: /create organization/i }));

    expect(await screen.findByText("Organization name is required")).toBeInTheDocument();
    expect(createMock.mutateAsync).not.toHaveBeenCalled();
  });
});
