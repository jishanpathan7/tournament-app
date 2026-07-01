"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * Toaster — white, 2px ink, 1rem radius, top-center (design system §5/§10).
 * Success = mint, error = pink. Re-export `toast` from sonner at call sites.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      toastOptions={{
        classNames: {
          toast: "!border-2 !border-ink !bg-card !text-ink !rounded-2xl !shadow-sticker !font-sans",
          title: "!font-semibold",
          description: "!text-muted-foreground",
          success: "!border-mint",
          error: "!border-pink",
          actionButton: "!bg-candy !text-white !rounded-full",
          cancelButton: "!bg-muted !text-ink !rounded-full",
        },
      }}
    />
  );
}

export { toast } from "sonner";
