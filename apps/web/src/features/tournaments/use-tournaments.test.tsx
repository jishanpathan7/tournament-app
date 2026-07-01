import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, Providers, renderHook, waitFor } from "@/test/test-utils";
import { makeTournament } from "@/test/fixtures";

// Mock the transport the hooks wrap.
vi.mock("@/features/tournaments/tournaments-api");
import * as tournamentsApi from "@/features/tournaments/tournaments-api";
import { useTournament, useTournaments } from "@/features/tournaments/use-tournaments";

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
