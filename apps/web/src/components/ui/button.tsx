import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Candy Sticker button — pill, 2px ink border, hard offset shadow, candy-press.
 * See docs/DESIGN-SYSTEM.md §5. Extend tones/sizes here rather than restyling inline.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border-2 border-ink font-sans font-bold tracking-tight transition-[transform,box-shadow] duration-150 ease-bouncy hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      tone: {
        candy:
          "bg-candy text-white shadow-sticker hover:shadow-sticker-md active:shadow-sticker-xs",
        paper: "bg-card text-ink shadow-sticker hover:shadow-sticker-md active:shadow-sticker-xs",
        pink: "bg-pink text-ink shadow-sticker hover:shadow-sticker-md active:shadow-sticker-xs",
        mint: "bg-mint text-ink shadow-sticker hover:shadow-sticker-md active:shadow-sticker-xs",
        ink: "bg-ink text-white shadow-sticker hover:shadow-sticker-md active:shadow-sticker-xs",
      },
      size: {
        sm: "h-10 px-4 text-sm",
        md: "h-12 px-5 text-base",
        lg: "h-14 px-6 text-lg",
      },
    },
    defaultVariants: { tone: "candy", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, tone, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ tone, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
