"use client";

import * as React from "react";
import { Drawer as VaulDrawer } from "vaul";

import { cn } from "@/lib/utils";

/**
 * Mobile drawer (vaul) — the sidebar's mobile form: slide-in with an ink/40 backdrop
 * (design system §4/§11). `side` controls the edge it slides from.
 */
export const Sheet = VaulDrawer.Root;
export const SheetTrigger = VaulDrawer.Trigger;
export const SheetClose = VaulDrawer.Close;
export const SheetTitle = VaulDrawer.Title;
export const SheetDescription = VaulDrawer.Description;

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof VaulDrawer.Content>,
  React.ComponentPropsWithoutRef<typeof VaulDrawer.Content> & { side?: "left" | "right" }
>(({ className, children, side = "left", ...props }, ref) => (
  <VaulDrawer.Portal>
    <VaulDrawer.Overlay className="bg-ink/40 fixed inset-0 z-50" />
    <VaulDrawer.Content
      ref={ref}
      className={cn(
        "bg-card border-ink fixed bottom-0 top-0 z-50 flex w-[82%] max-w-[20rem] flex-col outline-none",
        side === "left" ? "left-0 border-r-2" : "right-0 border-l-2",
        className,
      )}
      {...props}
    >
      {children}
    </VaulDrawer.Content>
  </VaulDrawer.Portal>
));
SheetContent.displayName = "SheetContent";
