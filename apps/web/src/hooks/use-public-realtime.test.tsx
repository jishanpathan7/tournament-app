import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderHook } from "@/test/test-utils";

import { usePublicRealtime } from "@/hooks/use-public-realtime";

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

describe("usePublicRealtime", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("connects to the public tournament stream endpoint, not the authenticated one", () => {
    renderHook(() => usePublicRealtime("sibl-open"));
    const source = FakeEventSource.instances[0]!;
    expect(source.url).toContain("/api/v1/public/tournaments/sibl-open/stream");
    expect(source.url).not.toContain("/api/v1/realtime/stream");
  });

  it("does nothing (no connection) when slug is null", () => {
    expect(() => renderHook(() => usePublicRealtime(null))).not.toThrow();
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it("invokes the matching handler for a dispatched event", () => {
    const onMatchCompleted = vi.fn();
    renderHook(() =>
      usePublicRealtime("sibl-open", { "match.completed": onMatchCompleted }),
    );
    const source = FakeEventSource.instances[0]!;
    source.emit("match.completed", { matchId: "m-1", tournamentId: "t-1" });

    expect(onMatchCompleted).toHaveBeenCalledWith({ matchId: "m-1", tournamentId: "t-1" });
  });

  it("does not throw when no handler is registered for an event type", () => {
    renderHook(() => usePublicRealtime("sibl-open"));
    const source = FakeEventSource.instances[0]!;
    expect(() => source.emit("standings.updated", { stageId: "s-1" })).not.toThrow();
  });

  it("reports status transitions (connecting -> open)", () => {
    const { result } = renderHook(() => usePublicRealtime("sibl-open"));
    expect(result.current).toBe("connecting");
    act(() => FakeEventSource.instances[0]!.onopen?.());
    expect(result.current).toBe("open");
  });
});
