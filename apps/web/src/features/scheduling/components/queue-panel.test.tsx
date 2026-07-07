import { describe, expect, it, vi } from "vitest";

import { QueuePanel } from "@/features/scheduling/components/queue-panel";
import {
  makeCourt,
  makeCourtQueue,
  makeMatch,
  makeParticipant,
  makeScheduleQueue,
} from "@/test/fixtures";
import { renderWithProviders, screen } from "@/test/test-utils";

vi.mock("@/features/scheduling/scheduling-api");
vi.mock("@/features/matches/matches-api");
import * as matchesApi from "@/features/matches/matches-api";
import * as schedulingApi from "@/features/scheduling/scheduling-api";

const TOURNAMENT_ID = "t-1";

function side(id: string) {
  return { participantId: id, outcome: null, scoreFor: null, scoreAgainst: null, rank: null };
}

describe("QueuePanel", () => {
  it("shows an empty state when no courts are assigned", async () => {
    vi.mocked(schedulingApi.getQueue).mockResolvedValue(makeScheduleQueue());
    vi.mocked(matchesApi.listTournamentParticipants).mockResolvedValue([]);
    renderWithProviders(<QueuePanel tournamentId={TOURNAMENT_ID} />);

    expect(await screen.findByText("No courts assigned")).toBeInTheDocument();
  });

  it("shows the current match, next match, and free/delayed badges per court", async () => {
    const p1 = makeParticipant({ id: "p-1", displayName: "Aarav K." });
    const p2 = makeParticipant({ id: "p-2", displayName: "Mei L." });
    const current = makeMatch({
      id: "m-1",
      status: "scheduled",
      sides: [side("p-1"), side("p-2")],
    });
    const next = makeMatch({ id: "m-2", status: "scheduled", sides: [side("p-1"), side("p-2")] });

    vi.mocked(schedulingApi.getQueue).mockResolvedValue(
      makeScheduleQueue({
        courts: [
          makeCourtQueue({
            court: makeCourt({ id: "c-1", name: "Court 1" }),
            currentMatch: current,
            nextMatch: next,
          }),
          makeCourtQueue({ court: makeCourt({ id: "c-2", name: "Court 2" }) }),
        ],
        unscheduled: [
          makeMatch({ id: "m-3", status: "scheduled", sides: [side("p-1"), side("p-2")] }),
        ],
      }),
    );
    vi.mocked(matchesApi.listTournamentParticipants).mockResolvedValue([p1, p2]);
    renderWithProviders(<QueuePanel tournamentId={TOURNAMENT_ID} />);

    expect(await screen.findByText("Court 1")).toBeInTheDocument();
    expect(screen.getByText("Court 2")).toBeInTheDocument();
    expect(screen.getByText("1 free court")).toBeInTheDocument();
    expect(screen.getByText("1 waiting to be scheduled")).toBeInTheDocument();
    expect(screen.getAllByText("Aarav K. vs Mei L.").length).toBeGreaterThan(0);
    expect(screen.getByText(/^Next:/)).toBeInTheDocument();
  });

  it("flags a court as delayed", async () => {
    vi.mocked(schedulingApi.getQueue).mockResolvedValue(
      makeScheduleQueue({
        courts: [
          makeCourtQueue({
            court: makeCourt({ id: "c-1", name: "Court 1" }),
            currentMatch: makeMatch({ status: "scheduled", sides: [side("p-1"), side("p-2")] }),
            isDelayed: true,
          }),
        ],
      }),
    );
    vi.mocked(matchesApi.listTournamentParticipants).mockResolvedValue([]);
    renderWithProviders(<QueuePanel tournamentId={TOURNAMENT_ID} />);

    expect(await screen.findByText("1 delayed court")).toBeInTheDocument();
  });
});
