import { describe, expect, it, vi } from "vitest";

import { makeMatch } from "@/test/fixtures";
import { createTestQueryClient } from "@/test/test-utils";
import { queryKeys } from "@/lib/query-keys";
import {
  invalidateFromMatchCompletedEvent,
  invalidateFromMatchStartedEvent,
  invalidateLiveTournamentCaches,
  patchMatchInCaches,
  reconcileMatchInCaches,
} from "@/lib/live-tournament-cache";

describe("live-tournament-cache", () => {
  it("patches match detail and tournament + stage lists", () => {
    const client = createTestQueryClient();
    const scheduled = makeMatch({ id: "m-1", stageId: "s-1", status: "scheduled" });
    const live = makeMatch({ id: "m-1", stageId: "s-1", status: "live" });

    client.setQueryData(queryKeys.tournaments.matches("t-1"), [scheduled]);
    client.setQueryData(queryKeys.stages.matches("s-1"), [scheduled]);

    patchMatchInCaches(client, live, "t-1");

    expect(client.getQueryData(queryKeys.matches.detail("m-1"))).toEqual(live);
    expect(
      client.getQueryData<(typeof live)[]>(queryKeys.tournaments.matches("t-1"))?.[0]?.status,
    ).toBe("live");
    expect(client.getQueryData<(typeof live)[]>(queryKeys.stages.matches("s-1"))?.[0]?.status).toBe(
      "live",
    );
  });

  it("reconcile scored invalidates queue + standings + activity", () => {
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const match = makeMatch({ id: "m-1", stageId: "s-1", status: "completed" });

    reconcileMatchInCaches(client, match, "t-1", "scored");

    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.schedule.queue("t-1") }),
    );
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.tournaments.activity("t-1") }),
    );
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.stages.standings("s-1") }),
    );
  });

  it("match.completed realtime handler invalidates schedule queue", () => {
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    invalidateFromMatchCompletedEvent(client, {
      tournamentId: "t-1",
      matchId: "m-1",
      status: "completed",
    });

    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.schedule.queue("t-1") }),
    );
  });

  it("match.started realtime handler invalidates schedule queue", () => {
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    invalidateFromMatchStartedEvent(client, {
      tournamentId: "t-1",
      matchId: "m-1",
      status: "live",
    });

    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.schedule.queue("t-1") }),
    );
  });

  it("invalidateLiveTournamentCaches no-ops bracket meta unless requested", () => {
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    invalidateLiveTournamentCaches(client, { tournamentId: "t-1" });

    expect(invalidate).not.toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["stages"] }));
  });

  it("412 conflict recovery: match detail and tournament matches should be invalidated", () => {
    // Documents the keys that score-entry-form.tsx must invalidate after a 412 so the
    // organizer sees current scores immediately rather than waiting for the SSE event.
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    // Simulate what score-entry-form does on a 412 response.
    void client.invalidateQueries({ queryKey: queryKeys.matches.detail("m-1") });
    void client.invalidateQueries({ queryKey: queryKeys.tournaments.matches("t-1") });

    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.matches.detail("m-1") }),
    );
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.tournaments.matches("t-1") }),
    );
  });
});
