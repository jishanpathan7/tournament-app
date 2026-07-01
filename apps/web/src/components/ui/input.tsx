import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Candy Sticker input — white, 2px ink border, .75rem radius; focus → candy border
 * (no ring, per §16); error → pink border + pink shadow. Set `aria-invalid` for error.
 * See docs/DESIGN-SYSTEM.md §5/§8.
 */
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "border-ink bg-card text-foreground placeholder:text-muted-foreground/70 flex h-12 w-full rounded-[.75rem] border-2 px-4 py-2 text-base transition-colors",
        "focus-visible:border-candy focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-[invalid=true]:border-pink aria-[invalid=true]:shadow-sticker-pink",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
