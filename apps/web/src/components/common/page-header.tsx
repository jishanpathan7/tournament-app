import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Standard page header: mono eyebrow → serif title → optional description, with a
 * right-aligned action slot. Every console screen opens with this for consistent altitude.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="flex flex-col gap-1">
        {eyebrow ? (
          <p className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.28em]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-muted-foreground max-w-2xl text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  );
}
