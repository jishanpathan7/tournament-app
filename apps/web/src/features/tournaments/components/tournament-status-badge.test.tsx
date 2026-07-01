import { describe, expect, it } from "vitest";

import { TournamentStatusBadge } from "@/features/tournaments/components/tournament-status-badge";
import { renderWithProviders, screen } from "@/test/test-utils";

describe("TournamentStatusBadge", () => {
  it("renders the human label for a known status", () => {
    renderWithProviders(<TournamentStatusBadge status="registration" />);
    expect(screen.getByText("Registration")).toBeInTheDocument();
  });

  it("falls back to the raw value for an unknown status", () => {
    renderWithProviders(<TournamentStatusBadge status="mystery" />);
    expect(screen.getByText("mystery")).toBeInTheDocument();
  });

  it("labels live tournaments", () => {
    renderWithProviders(<TournamentStatusBadge status="live" />);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });
});
