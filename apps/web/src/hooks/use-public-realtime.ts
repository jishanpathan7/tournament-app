"use client";

import { useEffect, useRef, useState } from "react";

import type { RealtimeStatus } from "@/hooks/use-realtime";
import { REALTIME_EVENTS, publicTournamentStreamUrl } from "@/lib/realtime";

type EventHandler = (data: Record<string, unknown>) => void;

/**
 * The public microsite's realtime subscription — same shape as `useRealtime`, but
 * against the anonymous `/public/tournaments/{slug}/stream` endpoint (no cookies, no
 * principal) rather than the authenticated org/user-channel stream. There are no
 * built-in default handlers here (unlike `useRealtime`): the public query-key
 * namespace is entirely separate from the authenticated one, so every caller passes
 * its own invalidation handlers for the events it cares about.
 *
 * Pass `slug = null` to stay disconnected (e.g. before the tournament is known).
 */
export function usePublicRealtime(
  slug: string | null,
  handlers?: Partial<Record<string, EventHandler>>,
): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!slug) {
      setStatus("idle");
      return;
    }

    setStatus("connecting");
    const source = new EventSource(publicTournamentStreamUrl(slug));

    source.onopen = () => setStatus("open");
    source.onerror = () => setStatus("error"); // browser auto-reconnects

    const listeners: Array<[string, (e: MessageEvent) => void]> = [];
    for (const type of Object.values(REALTIME_EVENTS)) {
      const listener = (event: MessageEvent) => {
        let data: Record<string, unknown> = {};
        try {
          data = event.data ? JSON.parse(event.data) : {};
        } catch {
          data = {};
        }
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
  }, [slug]);

  return status;
}
