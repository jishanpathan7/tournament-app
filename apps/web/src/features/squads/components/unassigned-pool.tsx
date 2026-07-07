"use client";

import { useDroppable } from "@dnd-kit/core";

import type { UnassignedRegistrationView } from "@/features/squads/types";
import { DraggablePlayerCard } from "@/features/squads/components/draggable-player-card";
import { cn } from "@/lib/utils";

export function UnassignedPool({
  entries,
  selectedId,
  onSelect,
}: {
  entries: UnassignedRegistrationView[];
  selectedId: string | null;
  onSelect?: (registrationId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "unassigned" });

  return (
    <div
      className={cn(
        "border-ink bg-card shadow-sticker-xs flex flex-col rounded-2xl border-2 transition-colors",
        isOver && "bg-muted/60",
      )}
    >
      <div className="border-ink/10 border-b px-4 py-3">
        <h3 className="font-serif text-lg font-semibold">Unassigned</h3>
        <p className="text-muted-foreground text-xs">{entries.length} players</p>
      </div>
      <ul
        ref={setNodeRef}
        className="flex max-h-[520px] min-h-[80px] flex-col gap-1 overflow-y-auto p-2"
      >
        {entries.length === 0 ? (
          <li className="text-muted-foreground px-2 py-6 text-center text-sm">Everyone assigned</li>
        ) : (
          entries.map((entry) => (
            <DraggablePlayerCard
              key={entry.registrationId}
              registrationId={entry.registrationId}
              displayName={entry.displayName}
              subtitle={[entry.divisionName, entry.skillLevel].filter(Boolean).join(" · ")}
              selected={selectedId === entry.registrationId}
              onSelect={onSelect ? () => onSelect(entry.registrationId) : undefined}
            />
          ))
        )}
      </ul>
    </div>
  );
}
