import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Selectable radio-style card for the wizard (sport / format pickers). Keyboard-operable. */
export function OptionCard({
  icon: Icon,
  label,
  description,
  selected,
  disabled,
  comingSoon,
  onSelect,
}: {
  icon?: LucideIcon;
  label: string;
  description?: string;
  selected: boolean;
  disabled?: boolean;
  comingSoon?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "border-ink bg-card ease-bouncy flex items-start gap-3 rounded-2xl border-2 p-4 text-left outline-none transition-[transform,box-shadow] duration-150",
        !disabled && "hover:shadow-sticker hover:-translate-x-0.5 hover:-translate-y-0.5",
        selected ? "shadow-sticker-candy ring-candy ring-2" : "shadow-sticker-xs",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      {Icon ? (
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2",
            selected ? "border-candy bg-candy-tint text-candy-dark" : "border-ink bg-muted",
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        </span>
      ) : null}
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="font-semibold">{label}</span>
          {comingSoon ? <Badge tone="muted">Soon</Badge> : null}
        </span>
        {description ? <span className="text-muted-foreground text-sm">{description}</span> : null}
      </span>
    </button>
  );
}
