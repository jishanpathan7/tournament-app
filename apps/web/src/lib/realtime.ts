import { env } from "@/lib/env";

/**
 * Realtime contract mirror of the backend `app/realtime` + per-module events. Transport
 * is SSE at MVP; channels are `org:{id}` / `user:{id}`. Event envelopes are `{ type, data }`.
 * Keep the event-type strings aligned with the backend `RT_*` constants.
 */

export const REALTIME_EVENTS = {
  MATCH_COMPLETED: "match.completed",
  BRACKET_UPDATED: "bracket.updated",
  STANDINGS_UPDATED: "standings.updated",
} as const;

export type RealtimeEventType = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export interface RealtimeEnvelope<T = Record<string, unknown>> {
  type: string;
  data: T;
}

export function orgChannel(organizationId: string): string {
  return `org:${organizationId}`;
}

export function userChannel(userId: string): string {
  return `user:${userId}`;
}

/** Absolute SSE URL for a channel (EventSource can't send headers; cookies flow via `withCredentials`). */
export function streamUrl(channel: string): string {
  const base = `${env.apiUrl}/api/v1/realtime/stream`;
  return `${base}?channel=${encodeURIComponent(channel)}`;
}
