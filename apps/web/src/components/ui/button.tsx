import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Candy Sticker button — pill, 2px ink border, hard offset shadow, candy-press.
 * See docs/DESIGN-SYSTEM.md §5. Extend tones/sizes here rather than restyling inline.
 * `asChild` renders the styles onto a child element (e.g. a Next `<Link>`).
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border-2 border-ink font-sans font-bold tracking-tight transition-[transform,box-shadow] duration-150 ease-bouncy hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none",
  {
    variants: {
      tone: {
        // Cobalt-deep shadow per Candy Sticker spec §5 — press animation reads depth under cobalt
        candy:
          "bg-candy text-white shadow-sticker-candy hover:shadow-sticker-candy-md active:shadow-sticker-candy-xs",
        paper: "bg-card text-ink shadow-sticker hover:shadow-sticker-md active:shadow-sticker-xs",
        pink: "bg-pink text-ink shadow-sticker hover:shadow-sticker-md active:shadow-sticker-xs",
        yellow:
          "bg-yellow text-ink shadow-sticker hover:shadow-sticker-md active:shadow-sticker-xs",
        mint: "bg-mint text-ink shadow-sticker hover:shadow-sticker-md active:shadow-sticker-xs",
        ink: "bg-ink text-white shadow-sticker hover:shadow-sticker-md active:shadow-sticker-xs",
        ghost:
          "border-transparent shadow-none hover:bg-muted active:translate-x-0 active:translate-y-0",
      },
      size: {
        sm: "h-10 px-4 text-sm",
        md: "h-12 px-5 text-base",
        lg: "h-14 px-6 text-lg",
        icon: "h-10 w-10 shadow-sticker-xs",
        "icon-sm": "h-9 w-9 shadow-sticker-xs",
      },
    },
    defaultVariants: { tone: "candy", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, tone, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ tone, size }), className)} {...props} />;
  },
);
Button.displayName = "Button";

export { buttonVariants };
