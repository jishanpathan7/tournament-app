import { AlertCircle } from "lucide-react";
import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Form field scaffold: mono Label above → control → mono helper/error below (pink +
 * icon, never color-only). See design system §8. Wrap any input control as children.
 */
export function Field({
  label,
  htmlFor,
  error,
  helper,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor: string;
  error?: string;
  helper?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-pink text-2xs flex items-center gap-1.5 font-mono font-semibold uppercase tracking-[0.16em]">
          <AlertCircle className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          {error}
        </p>
      ) : helper ? (
        <p className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.16em]">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
