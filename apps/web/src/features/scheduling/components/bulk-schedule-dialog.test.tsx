import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BulkScheduleDialog } from "@/features/scheduling/components/bulk-schedule-dialog";
import { makeCourt, makeMatch } from "@/test/fixtures";
import { renderWithProviders, screen } from "@/test/test-utils";

vi.mock("@/features/scheduling/scheduling-api");
import * as schedulingApi from "@/features/scheduling/scheduling-api";

const TOURNAMENT_ID = "t-1";

describe("BulkScheduleDialog", () => {
  it("blocks submission with a message when there are no active courts", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <BulkScheduleDialog
        tournamentId={TOURNAMENT_ID}
        unscheduled={[makeMatch()]}
        activeCourts={[]}
        defaultStart={new Date("2026-07-25T08:00:00Z")}
        open
        onOpenChange={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Schedule all" }));

    expect(await screen.findByText("Assign at least one active court first.")).toBeInTheDocument();
    expect(schedulingApi.bulkAssignSchedule).not.toHaveBeenCalled();
  });

  it("round-robins unscheduled matches across the active courts back-to-back", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    vi.mocked(schedulingApi.bulkAssignSchedule).mockResolvedValue({ results: [] });
    const matches = [makeMatch({ id: "m-1" }), makeMatch({ id: "m-2" }), makeMatch({ id: "m-3" })];
    const courts = [makeCourt({ id: "c-1" }), makeCourt({ id: "c-2" })];

    renderWithProviders(
      <BulkScheduleDialog
        tournamentId={TOURNAMENT_ID}
        unscheduled={matches}
        activeCourts={courts}
        defaultStart={new Date("2026-07-25T08:00:00Z")}
        open
        onOpenChange={onOpenChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Schedule all" }));

    expect(schedulingApi.bulkAssignSchedule).toHaveBeenCalledWith(
      TOURNAMENT_ID,
      expect.objectContaining({
        assignments: [
          expect.objectContaining({ matchId: "m-1", courtId: "c-1" }),
          expect.objectContaining({ matchId: "m-2", courtId: "c-2" }),
          expect.objectContaining({ matchId: "m-3", courtId: "c-1" }),
        ],
      }),
    );
    // The third match (2nd slot on court c-1) starts one duration after the first.
    const call = vi.mocked(schedulingApi.bulkAssignSchedule).mock.calls[0]![1];
    const firstStart = new Date(call.assignments[0]!.scheduledAt).getTime();
    const secondSlotStart = new Date(call.assignments[2]!.scheduledAt).getTime();
    expect(secondSlotStart).toBeGreaterThan(firstStart);
  });

  it("shows an error banner when the batch is rejected", async () => {
    const user = userEvent.setup();
    vi.mocked(schedulingApi.bulkAssignSchedule).mockRejectedValue(new Error("conflict"));
    renderWithProviders(
      <BulkScheduleDialog
        tournamentId={TOURNAMENT_ID}
        unscheduled={[makeMatch()]}
        activeCourts={[makeCourt()]}
        defaultStart={new Date("2026-07-25T08:00:00Z")}
        open
        onOpenChange={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Schedule all" }));

    expect(await screen.findByText("conflict")).toBeInTheDocument();
  });
});
