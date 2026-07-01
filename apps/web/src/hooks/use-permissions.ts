"use client";

import { useSession } from "@/features/auth/use-session";
import { type Action, can } from "@/lib/permissions";

/**
 * UI permission gate keyed to the active org role from the session. Server re-checks
 * every mutation — this only hides/disables affordances. `useCan()` returns a predicate
 * so a component can test several actions without re-subscribing.
 */
export function useCan(): (action: Action) => boolean {
  const { session } = useSession();
  const role = session?.activeRole ?? null;
  return (action: Action) => can(role, action);
}
