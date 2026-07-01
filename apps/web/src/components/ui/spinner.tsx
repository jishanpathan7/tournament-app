import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/** Inline busy spinner — lucide loader, stroke 2.5, candy (design system §10). */
export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn("text-candy h-4 w-4 animate-spin", className)}
      strokeWidth={2.5}
      aria-hidden
    />
  );
}
