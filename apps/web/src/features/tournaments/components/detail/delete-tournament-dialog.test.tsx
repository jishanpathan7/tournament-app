import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, waitFor } from "@/test/test-utils";
import { makeTournament } from "@/test/fixtures";

vi.mock("@/features/tournaments/tournaments-api");
import * as tournamentsApi from "@/features/tournaments/tournaments-api";
import { DeleteTournamentDialog } from "@/features/tournaments/components/detail/delete-tournament-dialog";

const tournament = makeTournament({ name: "LinkLane-League 2026" });

function render() {
  return renderWithProviders(
    <DeleteTournamentDialog
      tournament={tournament}
      open
      onOpenChange={() => {}}
      onDeleted={() => {}}
    />,
  );
}

describe("DeleteTournamentDialog", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(tournamentsApi.deleteTournament).mockResolvedValue(undefined);
    vi.mocked(tournamentsApi.purgeTournament).mockResolvedValue(undefined);
  });

  it("deletes without purging by default", async () => {
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: "Delete tournament" }));

    await waitFor(() => expect(tournamentsApi.deleteTournament).toHaveBeenCalled());
    expect(vi.mocked(tournamentsApi.deleteTournament).mock.calls[0]?.[0]).toBe(tournament.id);
    expect(tournamentsApi.purgeTournament).not.toHaveBeenCalled();
  });

  it("keeps the permanent delete disabled until the name matches exactly", async () => {
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: /delete permanently instead/i }));
    const confirm = screen.getByRole("button", { name: "Delete permanently" });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText(/type/i), "LinkLane");
    expect(confirm).toBeDisabled();

    await user.clear(screen.getByLabelText(/type/i));
    await user.type(screen.getByLabelText(/type/i), tournament.name);
    expect(confirm).toBeEnabled();
  });

  it("soft-deletes first, because the API only purges an already-deleted tournament", async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    vi.mocked(tournamentsApi.deleteTournament).mockImplementation(async () => {
      order.push("delete");
    });
    vi.mocked(tournamentsApi.purgeTournament).mockImplementation(async () => {
      order.push("purge");
    });
    render();

    await user.click(screen.getByRole("button", { name: /delete permanently instead/i }));
    await user.type(screen.getByLabelText(/type/i), tournament.name);
    await user.click(screen.getByRole("button", { name: "Delete permanently" }));

    await waitFor(() => expect(order).toEqual(["delete", "purge"]));
    expect(vi.mocked(tournamentsApi.purgeTournament).mock.calls[0]?.slice(0, 2)).toEqual([
      tournament.id,
      tournament.name,
    ]);
  });
});
