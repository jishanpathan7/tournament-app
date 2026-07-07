import Link from "next/link";

import { PlaylaneMark } from "@/components/shell/playlane-mark";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

/** Wordmark — Playlane mark + serif name. Collapses to just the mark when `compact`. */
export function Brand({
  compact = false,
  href = "/",
  inverted = false,
}: {
  compact?: boolean;
  href?: string;
  /** Use on dark marketing/auth panels — paper text, mark without candy chip bg. */
  inverted?: boolean;
}) {
  return (
    <Link href={href} className="flex items-center gap-2.5 outline-none" aria-label={SITE.name}>
      {inverted ? (
        <span className="border-paper/20 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2">
          <PlaylaneMark size={20} inverted />
        </span>
      ) : (
        <span className="bg-candy border-ink shadow-sticker-xs flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2">
          <PlaylaneMark size={20} />
        </span>
      )}
      <span
        className={cn(
          "font-serif text-lg font-semibold tracking-tight transition-opacity",
          inverted && "text-paper",
          compact && "hidden",
        )}
      >
        {SITE.name}
      </span>
    </Link>
  );
}
