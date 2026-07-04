import type { UnassignedRegistrationView } from "@/features/squads/types";
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
  return (
    <div className="border-ink bg-card flex flex-col rounded-2xl border-2 shadow-sticker-xs">
      <div className="border-ink/10 border-b px-4 py-3">
        <h3 className="font-serif text-lg font-semibold">Unassigned</h3>
        <p className="text-muted-foreground text-xs">{entries.length} players</p>
      </div>
      <ul className="flex max-h-[520px] flex-col gap-1 overflow-y-auto p-2">
        {entries.length === 0 ? (
          <li className="text-muted-foreground px-2 py-6 text-center text-sm">Everyone assigned</li>
        ) : (
          entries.map((entry) => {
            const selected = selectedId === entry.registrationId;
            return (
              <li key={entry.registrationId}>
                <button
                  type="button"
                  disabled={!onSelect}
                  onClick={() => onSelect?.(entry.registrationId)}
                  className={cn(
                    "flex w-full flex-col rounded-xl px-3 py-2 text-left text-sm transition-colors",
                    selected
                      ? "bg-candy-tint border-candy border-2"
                      : "hover:bg-muted/60 border-2 border-transparent",
                    !onSelect && "cursor-default",
                  )}
                >
                  <span className="font-semibold">{entry.displayName}</span>
                  <span className="text-muted-foreground text-xs">
                    {entry.divisionName}
                    {entry.skillLevel ? ` · ${entry.skillLevel}` : ""}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
