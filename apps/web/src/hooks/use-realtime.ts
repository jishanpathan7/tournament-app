"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { queryKeys } from "@/lib/query-keys";
import { REALTIME_EVENTS, streamUrl } from "@/lib/realtime";

export type RealtimeStatus = "idle" | "connecting" | "open" | "error";

type EventHandler = (data: Record<string, unknown>) => void;

/**
 * Subscribe to a realtime channel over SSE. The backend frames each event with the
 * event *type* in the SSE `event:` field and the payload JSON in `data:`, so we attach
 * one named listener per known type. Default handlers invalidate the affected Query
 * keys; pass `handlers` to add/override behavior. Reconnection is handled by the browser.
 *
 * Pass `channel = null` to stay disconnected (e.g. before the org is known).
 */
export function useRealtime(
  channel: string | null,
  handlers?: Partial<Record<string, EventHandler>>,
): RealtimeStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  // Keep the latest handlers without re-opening the stream on every render.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!channel) {
      setStatus("idle");
      return;
    }

    setStatus("connecting");
    const source = new EventSource(streamUrl(channel), { withCredentials: true });

    source.onopen = () => setStatus("open");
    source.onerror = () => setStatus("error"); // browser auto-reconnects

    const defaults: Record<string, EventHandler> = {
      [REALTIME_EVENTS.MATCH_COMPLETED]: (data) => {
        if (typeof data.matchId === "string") {
          void queryClient.invalidateQueries({ queryKey: queryKeys.matches.detail(data.matchId) });
        }
        void queryClient.invalidateQueries({ queryKey: ["stages"] });
        void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
      },
      [REALTIME_EVENTS.BRACKET_UPDATED]: (data) => {
        if (typeof data.stageId === "string") {
          void queryClient.invalidateQueries({ queryKey: queryKeys.stages.matches(data.stageId) });
        }
        void queryClient.invalidateQueries({ queryKey: ["matches"] });
      },
      [REALTIME_EVENTS.STANDINGS_UPDATED]: (data) => {
        if (typeof data.stageId === "string") {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.stages.standings(data.stageId),
          });
        }
      },
    };

    const listeners: Array<[string, (e: MessageEvent) => void]> = [];
    for (const type of Object.values(REALTIME_EVENTS)) {
      const listener = (event: MessageEvent) => {
        let data: Record<string, unknown> = {};
        try {
          data = event.data ? JSON.parse(event.data) : {};
        } catch {
          data = {};
        }
        defaults[type]?.(data);
        handlersRef.current?.[type]?.(data);
      };
      source.addEventListener(type, listener as EventListener);
      listeners.push([type, listener]);
    }

    return () => {
      for (const [type, listener] of listeners) {
        source.removeEventListener(type, listener as EventListener);
      }
      source.close();
    };
  }, [channel, queryClient]);

  return status;
}
