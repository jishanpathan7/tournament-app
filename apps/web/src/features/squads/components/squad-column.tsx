"use client";

import { Crown, UserMinus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SquadView } from "@/features/squads/types";
import { squadTint } from "@/features/squads/config";
import { cn } from "@/lib/utils";

export function SquadColumn({
  squad,
  canManage,
  highlightAssign,
  onAssign,
  onRemove,
  onSetCaptain,
  onRename,
}: {
  squad: SquadView;
  canManage: boolean;
  highlightAssign: boolean;
  onAssign: () => void;
  onRemove: (registrationId: string) => void;
  onSetCaptain: (registrationId: string) => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(squad.name);
  const tint = squadTint(squad.sortOrder);

  function commitRename() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== squad.name) onRename(trimmed);
    setEditing(false);
  }

  return (
    <div
      className={cn(
        "border-ink flex flex-col rounded-2xl border-2 shadow-sticker-xs",
        tint,
        highlightAssign && canManage && "ring-candy ring-2 ring-offset-2",
      )}
    >
      <div className="border-ink/10 flex items-start justify-between gap-2 border-b px-3 py-3">
        <div className="min-w-0 flex-1">
          {editing && canManage ? (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setName(squad.name);
                  setEditing(false);
                }
              }}
              className="h-8 text-sm font-semibold"
              autoFocus
            />
          ) : (
            <button
              type="button"
              className={cn("font-serif text-left text-lg font-semibold", canManage && "hover:underline")}
              onClick={() => canManage && setEditing(true)}
              disabled={!canManage}
            >
              {squad.name}
            </button>
          )}
          <p className="text-muted-foreground text-xs">
            {squad.memberCount} players · skill {squad.totalSkillWeight.toFixed(1)}
          </p>
        </div>
        {canManage && highlightAssign ? (
          <Button tone="candy" size="sm" onClick={onAssign}>
            Assign here
          </Button>
        ) : null}
      </div>

      <ul className="flex min-h-[120px] flex-1 flex-col gap-1 p-2">
        {squad.members.map((member) => {
          const isCaptain = squad.captainRegistrationId === member.registrationId;
          return (
            <li
              key={member.registrationId}
              className="bg-card/80 border-ink/10 flex items-center gap-2 rounded-xl border px-2 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {isCaptain ? (
                    <Crown className="text-yellow h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                  ) : null}
                  <span className="truncate font-semibold">{member.displayName}</span>
                </div>
                <span className="text-muted-foreground truncate text-xs">
                  {member.divisionName}
                  {member.skillLevel ? ` · ${member.skillLevel}` : ""}
                </span>
              </div>
              {canManage ? (
                <div className="flex shrink-0 gap-0.5">
                  {!isCaptain ? (
                    <Button
                      tone="ghost"
                      size="icon-sm"
                      title="Make captain"
                      onClick={() => onSetCaptain(member.registrationId)}
                    >
                      <Crown className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </Button>
                  ) : null}
                  <Button
                    tone="ghost"
                    size="icon-sm"
                    title="Remove from team"
                    onClick={() => onRemove(member.registrationId)}
                  >
                    <UserMinus className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
