import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Badge / chip — pill, 2px border, mono UPPERCASE, tint fill + accent border + ink text
 * (design system §5). Tones map to the status palette; never rely on color alone —
 * pair with an icon/label at the call site.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-0.5 font-mono text-2xs font-bold uppercase tracking-[0.14em] whitespace-nowrap",
  {
    variants: {
      tone: {
        candy: "border-candy bg-candy-tint text-ink",
        pink: "border-pink bg-pink-tint text-ink",
        yellow: "border-yellow bg-yellow-tint text-ink",
        mint: "border-mint bg-mint-tint text-ink",
        ink: "border-ink bg-ink text-white",
        muted: "border-border bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { tone: "muted" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { badgeVariants };
