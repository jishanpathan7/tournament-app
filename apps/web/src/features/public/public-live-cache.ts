import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

const publicQueryKeys = queryKeys.public;

/** Invalidate public microsite caches that mirror live match / court state. */
export function invalidatePublicLiveCaches(
  queryClient: QueryClient,
  slug: string,
  opts?: { matchId?: string; standings?: boolean; courts?: boolean },
): void {
  void queryClient.invalidateQueries({ queryKey: publicQueryKeys.matches(slug) });

  if (opts?.courts !== false) {
    void queryClient.invalidateQueries({ queryKey: publicQueryKeys.courts(slug) });
  }

  if (opts?.matchId) {
    void queryClient.invalidateQueries({
      queryKey: publicQueryKeys.match(slug, opts.matchId),
    });
    void queryClient.invalidateQueries({
      queryKey: publicQueryKeys.matchEvents(slug, opts.matchId),
    });
  }

  if (opts?.standings) {
    void queryClient.invalidateQueries({
      predicate: (query) =>
        query.queryKey[0] === "public" &&
        query.queryKey[1] === "tournament" &&
        query.queryKey[2] === slug &&
        query.queryKey[4] === "standings",
    });
  }
}
