"use client";

import { Check, Download, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import {
  useBulkApproveRegistrations,
  useBulkRejectRegistrations,
} from "@/features/registrations/use-registrations";
import { errorMessage } from "@/lib/problem";

/** Appears once rows are selected: bulk approve/reject + export. */
export function BulkActionBar({
  divisionId,
  selectedIds,
  onClear,
  onExport,
}: {
  divisionId: string;
  selectedIds: string[];
  onClear: () => void;
  onExport: () => void;
}) {
  const bulkApprove = useBulkApproveRegistrations(divisionId);
  const bulkReject = useBulkRejectRegistrations(divisionId);
  const pending = bulkApprove.isPending || bulkReject.isPending;
  const count = selectedIds.length;

  return (
    <div className="border-ink bg-candy-tint shadow-sticker-xs flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 p-3">
      <span className="text-candy-dark text-2xs px-2 font-mono font-bold uppercase tracking-[0.16em]">
        {count} selected
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Button tone="paper" size="sm" onClick={onExport}>
          <Download className="h-4 w-4" strokeWidth={2.25} />
          Export CSV
        </Button>
        <Button
          tone="mint"
          size="sm"
          loading={bulkApprove.isPending}
          disabled={pending}
          onClick={() =>
            bulkApprove.mutate(undefined, {
              onSuccess: (r) => {
                toast.success(
                  `Approved ${r.approved} registration${r.approved === 1 ? "" : "s"}${r.waitlisted ? ` · ${r.waitlisted} waitlisted` : ""}`,
                );
                onClear();
              },
              onError: (e) => toast.error(errorMessage(e, "Approve all failed")),
            })
          }
        >
          {!bulkApprove.isPending && <Check className="h-4 w-4" strokeWidth={2.5} />}
          {bulkApprove.isPending ? `Approving ${count} registrations…` : "Approve All"}
        </Button>
        <Button
          tone="pink"
          size="sm"
          loading={bulkReject.isPending}
          disabled={pending}
          onClick={() =>
            bulkReject.mutate(selectedIds, {
              onSuccess: (r) => {
                if (r.failed.length === 0) {
                  toast.success(
                    `Rejected ${r.succeeded.length} registration${r.succeeded.length === 1 ? "" : "s"}`,
                  );
                } else {
                  toast.error(
                    `Rejected ${r.succeeded.length} of ${r.succeeded.length + r.failed.length} — ${r.failed.length} failed`,
                  );
                }
                onClear();
              },
              onError: (e) => toast.error(errorMessage(e, "Reject failed")),
            })
          }
        >
          {!bulkReject.isPending && <X className="h-4 w-4" strokeWidth={2.5} />}
          {bulkReject.isPending ? `Rejecting ${count}…` : "Reject"}
        </Button>
        <Button tone="ghost" size="sm" onClick={onClear} disabled={pending}>
          Clear
        </Button>
      </div>
    </div>
  );
}
