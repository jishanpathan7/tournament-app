import Link from "next/link";

import { cn } from "@/lib/utils";

/** Wordmark — serif name in an ink chip. Collapses to just the mark when `compact`. */
export function Brand({
  compact = false,
  href = "/console",
}: {
  compact?: boolean;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 outline-none"
      aria-label="Tournament Platform"
    >
      <span className="bg-candy border-ink shadow-sticker-xs flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 font-serif text-lg font-semibold text-white">
        T
      </span>
      <span
        className={cn(
          "font-serif text-lg font-semibold tracking-tight transition-opacity",
          compact && "hidden",
        )}
      >
        Tournament
      </span>
    </Link>
  );
}
