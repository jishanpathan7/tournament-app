"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Pill icon-button pagination (design system §5). Hidden when there's a single page. */
export function Pagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav className="flex items-center justify-center gap-3" aria-label="Pagination">
      <Button
        tone="paper"
        size="icon-sm"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
      </Button>
      <span className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.16em]">
        Page {page} of {pageCount}
      </span>
      <Button
        tone="paper"
        size="icon-sm"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
      </Button>
    </nav>
  );
}
