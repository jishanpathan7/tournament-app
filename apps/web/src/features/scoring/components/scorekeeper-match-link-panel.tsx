"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Mail, Smartphone, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import * as matchLinkApi from "@/features/scoring/scorekeeper-match-api";
import { errorMessage } from "@/lib/problem";

/** Generate a unique public link for this match — scorekeeper lands directly on scoring. */
export function ScorekeeperMatchLinkPanel({ matchId }: { matchId: string }) {
  const queryClient = useQueryClient();
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");

  const activeLink = useQuery({
    queryKey: ["scorekeeper-match-link", matchId],
    queryFn: () => matchLinkApi.getMatchScorekeeperLink(matchId),
  });

  const create = useMutation({
    mutationFn: () =>
      matchLinkApi.createMatchScorekeeperLink(matchId, {
        recipientEmail: recipientEmail.trim() || undefined,
        recipientName: recipientName.trim() || undefined,
      }),
    onSuccess: (link) => {
      setCreatedUrl(link.url);
      void queryClient.invalidateQueries({ queryKey: ["scorekeeper-match-link", matchId] });
      toast.success(
        recipientEmail.trim()
          ? "Scorekeeper link sent by email"
          : "Scorekeeper link ready — share with the court umpire",
      );
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const revoke = useMutation({
    mutationFn: () => matchLinkApi.revokeMatchScorekeeperLink(matchId),
    onSuccess: () => {
      setCreatedUrl(null);
      void queryClient.invalidateQueries({ queryKey: ["scorekeeper-match-link", matchId] });
      toast.success("Scorekeeper link revoked");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const copyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  const active = activeLink.data;
  const displayUrl = createdUrl ?? active?.url ?? null;
  const hasActive = active && !active.revoked;

  return (
    <div className="border-ink bg-lavender/30 flex flex-col gap-3 rounded-2xl border-2 p-4">
      <div className="flex items-start gap-2">
        <Smartphone className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <p className="font-serif text-base font-semibold">Court scorekeeper link</p>
          <p className="text-muted-foreground mt-1 text-sm">
            One link for this match only — opens the mobile scoring screen. No login, no access to
            other matches.
          </p>
        </div>
      </div>
      {!displayUrl ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`sk-email-${matchId}`} className="text-xs">
              Umpire email (optional)
            </Label>
            <Input
              id={`sk-email-${matchId}`}
              type="email"
              placeholder="umpire@example.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`sk-name-${matchId}`} className="text-xs">
              Umpire name (optional)
            </Label>
            <Input
              id={`sk-name-${matchId}`}
              placeholder="Court 1 umpire"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {displayUrl ? (
          <>
            <input
              readOnly
              value={displayUrl}
              className="border-ink bg-card min-w-0 flex-1 rounded-lg border px-2 py-1.5 font-mono text-xs"
            />
            <Button
              type="button"
              tone="paper"
              size="icon"
              onClick={() => void copyUrl(displayUrl)}
              aria-label="Copy link"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button
            type="button"
            tone="mint"
            size="sm"
            onClick={() => create.mutate()}
            disabled={create.isPending}
          >
            {recipientEmail.trim() ? (
              <>
                <Mail className="h-4 w-4" />
                Generate &amp; send
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4" />
                Generate link
              </>
            )}
          </Button>
        )}
        {hasActive && !createdUrl ? (
          <Button
            type="button"
            tone="ghost"
            size="sm"
            onClick={() => revoke.mutate()}
            disabled={revoke.isPending}
          >
            <X className="h-4 w-4" />
            Revoke
          </Button>
        ) : null}
        {hasActive && !displayUrl ? (
          <Button
            type="button"
            tone="paper"
            size="sm"
            onClick={() => create.mutate()}
            disabled={create.isPending}
          >
            Regenerate
          </Button>
        ) : null}
      </div>
    </div>
  );
}
