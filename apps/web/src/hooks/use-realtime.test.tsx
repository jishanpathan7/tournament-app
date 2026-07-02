import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/lib/query-keys";
import { createTestQueryClient, Providers, renderHook } from "@/test/test-utils";

import { useRealtime } from "@/hooks/use-realtime";

/**
 * A minimal EventSource fake: captures `addEventListener` calls per event type so tests
 * can dispatch a fake server event and assert on the resulting cache invalidation,
 * without opening a real network connection.
 */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  listeners = new Map<string, ((e: MessageEvent) => void)[]>();
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, listener: (e: MessageEvent) => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  removeEventListener(type: string, listener: (e: MessageEvent) => void) {
    const list = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      list.filter((l) => l !== listener),
    );
  }
  close() {}
  emit(type: string, data: unknown) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data: JSON.stringify(data) } as MessageEvent);
    }
  }
}

describe("useRealtime — registration events", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("invalidates the division's registrations + participants on registration.approved", () => {
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Providers client={client}>{children}</Providers>
    );

    renderHook(() => useRealtime("org:org-1"), { wrapper });
    const source = FakeEventSource.instances[0]!;
    source.emit("registration.approved", { registrationId: "r-1", divisionId: "div-1" });

    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.divisions.registrations("div-1") }),
    );
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.divisions.participants("div-1") }),
    );
  });

  it("ignores an event with no divisionId rather than throwing", () => {
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Providers client={client}>{children}</Providers>
    );

    renderHook(() => useRealtime("org:org-1"), { wrapper });
    const source = FakeEventSource.instances[0]!;
    expect(() => source.emit("registration.submitted", {})).not.toThrow();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("invalidates the tournament-wide match queue + activity feed on match.completed", () => {
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Providers client={client}>{children}</Providers>
    );

    renderHook(() => useRealtime("org:org-1"), { wrapper });
    const source = FakeEventSource.instances[0]!;
    source.emit("match.completed", { matchId: "m-1", tournamentId: "t-1", status: "completed" });

    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.matches.detail("m-1") }),
    );
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.matches.events("m-1") }),
    );
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.tournaments.matches("t-1") }),
    );
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.tournaments.activity("t-1") }),
    );
  });

  it("invalidates the tournament-wide match queue on bracket.updated", () => {
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Providers client={client}>{children}</Providers>
    );

    renderHook(() => useRealtime("org:org-1"), { wrapper });
    const source = FakeEventSource.instances[0]!;
    source.emit("bracket.updated", { stageId: "stage-1", tournamentId: "t-1" });

    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.stages.matches("stage-1") }),
    );
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.tournaments.matches("t-1") }),
    );
  });

  it("does nothing (no connection) when channel is null", () => {
    expect(() => {
      const client = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <Providers client={client}>{children}</Providers>
      );
      renderHook(() => useRealtime(null), { wrapper });
    }).not.toThrow();
    expect(FakeEventSource.instances).toHaveLength(0);
  });
});
