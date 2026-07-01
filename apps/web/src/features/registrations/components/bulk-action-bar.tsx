"use client";

import { Check, Download, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import {
  useBulkApproveRegistrations,
  useBulkRejectRegistrations,
} from "@/features/registrations/use-registrations";

/** Appears once rows are selected: bulk approve/reject + export, and a precise per-id summary. */
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

  const report = (verb: string, result: { succeeded: string[]; failed: unknown[] }) => {
    if (result.failed.length === 0) {
      toast.success(
        `${verb} ${result.succeeded.length} registration${result.succeeded.length === 1 ? "" : "s"}`,
      );
    } else {
      toast.error(
        `${verb} ${result.succeeded.length} of ${result.succeeded.length + result.failed.length} — ${result.failed.length} failed`,
      );
    }
    onClear();
  };

  return (
    <div className="border-ink bg-candy-tint shadow-sticker-xs flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 p-3">
      <span className="text-candy-dark text-2xs px-2 font-mono font-bold uppercase tracking-[0.16em]">
        {selectedIds.length} selected
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Button tone="paper" size="sm" onClick={onExport}>
          <Download className="h-4 w-4" strokeWidth={2.25} />
          Export CSV
        </Button>
        <Button
          tone="mint"
          size="sm"
          disabled={pending}
          onClick={() =>
            bulkApprove.mutate(selectedIds, { onSuccess: (r) => report("Approved", r) })
          }
        >
          {bulkApprove.isPending ? <Spinner /> : <Check className="h-4 w-4" strokeWidth={2.5} />}
          Approve
        </Button>
        <Button
          tone="pink"
          size="sm"
          disabled={pending}
          onClick={() =>
            bulkReject.mutate(selectedIds, { onSuccess: (r) => report("Rejected", r) })
          }
        >
          {bulkReject.isPending ? <Spinner /> : <X className="h-4 w-4" strokeWidth={2.5} />}
          Reject
        </Button>
        <Button tone="ghost" size="sm" onClick={onClear} disabled={pending}>
          Clear
        </Button>
      </div>
    </div>
  );
}
