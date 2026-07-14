"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import * as matchLinkApi from "@/features/scoring/scorekeeper-match-api";
import { errorMessage } from "@/lib/problem";
import { queryKeys } from "@/lib/query-keys";

/** One-click copy of the scorekeeper link for a live match. Fetches the active link;
 * auto-creates one if none exists. Shows inline next to the primary action button. */
export function ScorekeeperCopyButton({ matchId }: { matchId: string }) {
  const queryClient = useQueryClient();

  const activeLink = useQuery({
    queryKey: queryKeys.scorekeeperLink.match(matchId),
    queryFn: () => matchLinkApi.getMatchScorekeeperLink(matchId),
  });

  const create = useMutation({
    mutationFn: () => matchLinkApi.createMatchScorekeeperLink(matchId),
    onSuccess: async (link) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.scorekeeperLink.match(matchId) });
      if (link.url) {
        await navigator.clipboard.writeText(link.url);
        toast.success("Scorekeeper link copied");
      }
    },
    onError: (err) => toast.error(errorMessage(err, "Couldn't generate scorekeeper link")),
  });

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = activeLink.data?.url ?? null;
    const hasActive = activeLink.data && !activeLink.data.revoked && url;
    if (hasActive) {
      await navigator.clipboard.writeText(url!);
      toast.success("Scorekeeper link copied");
    } else {
      create.mutate();
    }
  };

  const isPending = activeLink.isLoading || create.isPending;

  return (
    <Button
      type="button"
      tone="paper"
      size="sm"
      className="shrink-0 gap-1.5"
      disabled={isPending}
      onClick={(e) => void handleClick(e)}
      aria-label="Copy scorekeeper link"
      title="Copy scorekeeper link"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : activeLink.data?.url && !activeLink.data.revoked ? (
        <Copy className="h-4 w-4" />
      ) : (
        <Link2 className="h-4 w-4" />
      )}
      <span className="hidden sm:inline">Scorekeeper link</span>
    </Button>
  );
}
