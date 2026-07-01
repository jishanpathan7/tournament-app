import type { LucideIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Notion-calm empty state (design system §9): blob-shaped tinted icon container, mono
 * eyebrow, serif headline, muted line, single candy CTA slot. Encouraging, never dead-end.
 */
export function EmptyState({
  icon: Icon,
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-4 px-6 py-16 text-center", className)}>
      <div className="border-ink bg-candy-tint text-candy-dark rounded-blob shadow-sticker-xs flex h-20 w-20 items-center justify-center border-2">
        <Icon className="h-8 w-8" strokeWidth={2} aria-hidden />
      </div>
      {eyebrow ? (
        <p className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.28em]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-serif text-2xl font-semibold tracking-tight">{title}</h2>
      {description ? <p className="text-muted-foreground max-w-sm text-sm">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
