import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, Providers, renderHook, waitFor } from "@/test/test-utils";
import { makeTournament } from "@/test/fixtures";

// Mock the transport the hooks wrap.
vi.mock("@/features/tournaments/tournaments-api");
import * as tournamentsApi from "@/features/tournaments/tournaments-api";
import {
  useClearDraw,
  useGenerateDraw,
  useTournament,
  useTournaments,
} from "@/features/tournaments/use-tournaments";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <Providers client={createTestQueryClient()}>{children}</Providers>
);

describe("useTournaments", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns the fetched list", async () => {
    const data = [makeTournament({ name: "Alpha" }), makeTournament({ name: "Beta" })];
    vi.mocked(tournamentsApi.listTournaments).mockResolvedValue(data);

    const { result } = renderHook(() => useTournaments(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(tournamentsApi.listTournaments).toHaveBeenCalledOnce();
  });

  it("surfaces errors", async () => {
    vi.mocked(tournamentsApi.listTournaments).mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useTournaments(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useTournament", () => {
  beforeEach(() => vi.resetAllMocks());

  it("fetches a single tournament by id", async () => {
    const t = makeTournament({ id: "t-42", name: "Solo" });
    vi.mocked(tournamentsApi.getTournament).mockResolvedValue(t);

    const { result } = renderHook(() => useTournament("t-42"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe("Solo");
    expect(tournamentsApi.getTournament).toHaveBeenCalledWith("t-42");
  });

  it("does not fetch when disabled", () => {
    renderHook(() => useTournament("t-1", { enabled: false }), { wrapper });
    expect(tournamentsApi.getTournament).not.toHaveBeenCalled();
  });
});

describe("useGenerateDraw", () => {
  beforeEach(() => vi.resetAllMocks());

  it("generates a draw and invalidates the stage list + matches", async () => {
    vi.mocked(tournamentsApi.generateDraw).mockResolvedValue({
      stageId: "stage-1",
      format: "round_robin",
      groups: 0,
      rounds: 3,
      matches: 6,
      scheduled: 6,
      pending: 0,
    });
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useGenerateDraw("stage-1", "div-1", "tournament-1"), {
      wrapper: ({ children }) => <Providers client={client}>{children}</Providers>,
    });

    result.current.mutate({ overrideReadiness: false });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(vi.mocked(tournamentsApi.generateDraw).mock.calls[0]?.slice(0, 2)).toEqual([
      "stage-1",
      { overrideReadiness: false },
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["divisions", "div-1", "stages"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["stages", "stage-1", "matches"],
    });
  });

  it("surfaces a failed generation", async () => {
    vi.mocked(tournamentsApi.generateDraw).mockRejectedValue(new Error("too few participants"));
    const { result } = renderHook(() => useGenerateDraw("stage-1", "div-1", "tournament-1"), {
      wrapper,
    });

    result.current.mutate({ overrideReadiness: false });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useClearDraw", () => {
  beforeEach(() => vi.resetAllMocks());

  it("clears a draw and invalidates matches + standings + the stage list", async () => {
    vi.mocked(tournamentsApi.clearDraw).mockResolvedValue(undefined);
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useClearDraw("stage-1", "div-1", "tournament-1"), {
      wrapper: ({ children }) => <Providers client={client}>{children}</Providers>,
    });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(tournamentsApi.clearDraw).toHaveBeenCalledWith("stage-1");
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["stages", "stage-1", "standings"],
    });
  });

  it("surfaces a blocked clear (locked draw)", async () => {
    vi.mocked(tournamentsApi.clearDraw).mockRejectedValue(new Error("already scored"));
    const { result } = renderHook(() => useClearDraw("stage-1", "div-1", "tournament-1"), {
      wrapper,
    });

    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
