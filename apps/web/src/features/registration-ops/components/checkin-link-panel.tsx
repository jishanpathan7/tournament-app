"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Link2, QrCode } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import * as checkinApi from "@/features/registration-ops/checkin-link-api";
import { errorMessage } from "@/lib/problem";
import { queryKeys } from "@/lib/query-keys";

/** Organizer panel — QR + link for division self check-in. */
export function CheckInLinkPanel({ divisionId }: { divisionId: string }) {
  const queryClient = useQueryClient();
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  const activeLink = useQuery({
    queryKey: queryKeys.checkinLink.division(divisionId),
    queryFn: () => checkinApi.getDivisionCheckInLink(divisionId),
  });

  const create = useMutation({
    mutationFn: () => checkinApi.createDivisionCheckInLink(divisionId),
    onSuccess: (link) => {
      setCreatedUrl(link.url ?? null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.checkinLink.division(divisionId) });
      toast.success("Check-in QR ready — display at the venue entrance");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const copyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  const displayUrl = createdUrl ?? activeLink.data?.url ?? null;
  const hasActive = activeLink.data && !activeLink.data.revoked;

  return (
    <div className="border-ink bg-mint/20 flex flex-col gap-4 rounded-2xl border-2 p-4">
      <div className="flex items-start gap-2">
        <QrCode className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <p className="font-serif text-base font-semibold">Self check-in QR</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Players scan to find their name and mark themselves checked in — no login required.
          </p>
        </div>
      </div>

      {displayUrl ? (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="border-ink bg-card rounded-2xl border-2 p-3">
            <QRCodeSVG value={displayUrl} size={160} level="M" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <input
              readOnly
              value={displayUrl}
              className="border-ink bg-card w-full rounded-lg border px-2 py-1.5 font-mono text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" tone="paper" size="sm" onClick={() => void copyUrl(displayUrl)}>
                <Copy className="h-4 w-4" />
                Copy link
              </Button>
              {hasActive && !createdUrl ? (
                <Button
                  type="button"
                  tone="ghost"
                  size="sm"
                  onClick={() => create.mutate()}
                  disabled={create.isPending}
                >
                  Regenerate
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          tone="mint"
          size="sm"
          onClick={() => create.mutate()}
          disabled={create.isPending}
        >
          <Link2 className="h-4 w-4" />
          Generate check-in QR
        </Button>
      )}
    </div>
  );
}
