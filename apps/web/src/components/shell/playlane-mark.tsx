import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Playlane logo mark — match/fire icon.
 * Always rendered white via CSS filter so it remains legible on both the candy-chip
 * background (default Brand) and the dark-panel border container (inverted Brand).
 * `inverted` is accepted for backward-compatibility; the Brand container handles
 * the surrounding visual distinction.
 */
export function PlaylaneMark({
  className,
  size = 32,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  inverted,
}: {
  className?: string;
  size?: number;
  inverted?: boolean;
}) {
  return (
    <Image
      src="/logo-mark.png"
      alt=""
      width={size}
      height={size}
      className={cn("block shrink-0 brightness-0 invert", className)}
      aria-hidden
      priority
    />
  );
}
