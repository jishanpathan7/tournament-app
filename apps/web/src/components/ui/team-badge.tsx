import { cn } from "@/lib/utils";

interface TeamBadgeProps {
  teamName: string | null | undefined;
  className?: string;
}

export function TeamBadge({ teamName, className }: TeamBadgeProps) {
  if (!teamName) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none",
        "bg-muted text-muted-foreground border-border/50 border",
        className,
      )}
    >
      <span aria-hidden>🏷</span>
      {teamName}
    </span>
  );
}
