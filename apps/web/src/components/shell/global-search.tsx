"use client";

import { Search } from "lucide-react";

import { useUiStore } from "@/stores/ui-store";

/**
 * Topbar search affordance — looks like an input, opens the ⌘K palette (design system
 * §13). A visible entry point keeps the palette discoverable (accessibility §16).
 */
export function GlobalSearch() {
  const setOpen = useUiStore((s) => s.setCommandOpen);

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="border-border bg-muted/60 text-muted-foreground hover:border-ink focus-visible:border-candy flex h-9 w-full max-w-sm items-center gap-2 rounded-full border-2 px-3.5 text-sm outline-none transition-colors"
    >
      <Search className="h-4 w-4 shrink-0" strokeWidth={2.25} />
      <span className="flex-1 text-left">Search…</span>
      <kbd className="border-border bg-card text-muted-foreground hidden rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}
