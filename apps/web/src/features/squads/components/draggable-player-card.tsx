"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/lib/utils";

export function DraggablePlayerCard({
  registrationId,
  displayName,
  subtitle,
  selected,
  onSelect,
  isCaptain,
  actions,
}: {
  registrationId: string;
  displayName: string;
  subtitle?: string;
  selected?: boolean;
  onSelect?: () => void;
  isCaptain?: boolean;
  actions?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: registrationId,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card/80 border-ink/10 flex items-center gap-2 rounded-xl border px-2 py-2 text-sm",
        isDragging && "opacity-40",
        selected && "border-candy bg-candy-tint border-2",
      )}
    >
      {/* drag handle */}
      <span
        {...listeners}
        {...attributes}
        className="text-muted-foreground cursor-grab px-0.5 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        ⠿
      </span>
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={onSelect}
        disabled={!onSelect}
      >
        <div className="flex items-center gap-1.5">
          {isCaptain ? <span title="Captain">👑</span> : null}
          <span className="truncate font-semibold">{displayName}</span>
        </div>
        {subtitle ? (
          <span className="text-muted-foreground truncate text-xs">{subtitle}</span>
        ) : null}
      </button>
      {actions}
    </li>
  );
}
