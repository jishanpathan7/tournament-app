import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Functional-tier data table (design system §7): ink hairline row dividers, no
 * per-row card/shadow, sticky mono-uppercase header with a 2px ink bottom border,
 * whole-row hover (fill only — no rotation/lift). Native `<table>` semantics for
 * built-in keyboard/screen-reader navigation.
 */
export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="border-ink bg-card w-full overflow-x-auto rounded-2xl border-2">
      <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  ),
);
Table.displayName = "Table";

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("border-ink bg-card sticky top-0 z-10 border-b-2", className)}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("divide-border divide-y", className)} {...props} />
));
TableBody.displayName = "TableBody";

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn("hover:bg-muted/60 focus-within:bg-muted/60 transition-colors", className)}
    {...props}
  />
));
TableRow.displayName = "TableRow";

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "text-muted-foreground text-2xs h-11 px-4 text-left align-middle font-mono font-semibold uppercase tracking-[0.16em]",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn("h-[52px] px-4 align-middle", className)} {...props} />
));
TableCell.displayName = "TableCell";
