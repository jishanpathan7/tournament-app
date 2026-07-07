import userEvent from "@testing-library/user-event";
import type { PublicTournamentSearchResult } from "@tournament/api-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PublicSearchPage } from "@/features/public/components/public-search-page";
import { renderWithProviders, screen } from "@/test/test-utils";

vi.mock("@/features/public/public-api");
import * as publicApi from "@/features/public/public-api";

const result = (
  overrides: Partial<PublicTournamentSearchResult> = {},
): PublicTournamentSearchResult => ({
  slug: "sibl-open",
  name: "SIBL Open Badminton",
  sportKey: "badminton",
  status: "live",
  organizationName: "SIBL",
  organizationSlug: "sibl",
  ...overrides,
});

describe("PublicSearchPage", () => {
  beforeEach(() => vi.resetAllMocks());

  it("shows nothing before the user types a query", () => {
    renderWithProviders(<PublicSearchPage />);

    expect(screen.queryByText("No tournaments found")).not.toBeInTheDocument();
    expect(publicApi.searchTournaments).not.toHaveBeenCalled();
  });

  it("shows matching tournaments with organizer, sport, and status", async () => {
    const user = userEvent.setup();
    vi.mocked(publicApi.searchTournaments).mockResolvedValue([result()]);
    renderWithProviders(<PublicSearchPage />);

    await user.type(screen.getByLabelText("Search tournaments"), "sibl");

    const link = await screen.findByRole("link", { name: /SIBL Open Badminton/ });
    expect(link).toHaveAttribute("href", "/t/sibl-open");
    expect(screen.getByText(/SIBL · badminton/)).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(publicApi.searchTournaments).toHaveBeenCalledWith("sibl");
  });

  it("shows an empty state when nothing matches", async () => {
    const user = userEvent.setup();
    vi.mocked(publicApi.searchTournaments).mockResolvedValue([]);
    renderWithProviders(<PublicSearchPage />);

    await user.type(screen.getByLabelText("Search tournaments"), "nobody");

    expect(await screen.findByText("No tournaments found")).toBeInTheDocument();
  });

  it("shows an error state and can retry", async () => {
    const user = userEvent.setup();
    vi.mocked(publicApi.searchTournaments).mockRejectedValue(new Error("network down"));
    renderWithProviders(<PublicSearchPage />);

    await user.type(screen.getByLabelText("Search tournaments"), "sibl");

    expect(await screen.findByText("network down")).toBeInTheDocument();
  });
});
