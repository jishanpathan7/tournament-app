import { Lock, LockOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { skillMeta } from "@/features/pairing/config";
import { TeamStrengthBar } from "@/features/pairing/components/team-strength-bar";
import type { EntrantView, ProposedTeamView } from "@tournament/api-client";
import { cn } from "@/lib/utils";

/**
 * One proposed team: its members (with skill), the strength/confidence bar, the reasons
 * the engine formed it, a lock toggle, and — in swap mode — clickable member chips for a
 * manual override (select a member here, then a member on another team to swap them).
 */
export function ProposedTeamCard({
  team,
  entrants,
  index,
  canManage,
  selectedMemberId,
  onSelectMember,
  onToggleLock,
  busy,
}: {
  team: ProposedTeamView;
  entrants: Map<string, EntrantView>;
  index: number;
  canManage: boolean;
  selectedMemberId: string | null;
  onSelectMember: (memberId: string) => void;
  onToggleLock: () => void;
  busy: boolean;
}) {
  return (
    <div
      className={cn(
        "border-ink bg-card shadow-sticker-xs flex flex-col gap-3 rounded-2xl border-2 p-4",
        team.locked && "ring-candy ring-2 ring-offset-2",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-2xs font-mono uppercase tracking-[0.14em] text-muted-foreground">
            Team {index + 1}
          </span>
          <span className="font-serif text-lg font-semibold tracking-tight">
            {team.teamName ?? `Team ${index + 1}`}
          </span>
        </div>
        {canManage ? (
          <Button
            tone={team.locked ? "candy" : "paper"}
            size="icon-sm"
            onClick={onToggleLock}
            disabled={busy}
            aria-label={team.locked ? "Unlock team" : "Lock team"}
            title={team.locked ? "Locked — survives regenerate" : "Lock team"}
          >
            {team.locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
          </Button>
        ) : team.locked ? (
          <Lock className="text-candy-dark h-4 w-4" aria-label="Locked" />
        ) : null}
      </div>

      <ul className="flex flex-col gap-2">
        {team.memberIds.map((memberId) => {
          const entrant = entrants.get(memberId);
          const skill = skillMeta(entrant?.skillLevel);
          const selected = selectedMemberId === memberId;
          const chip = (
            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="truncate font-medium">{entrant?.displayName ?? "Unknown"}</span>
              <Badge tone={skill.tone}>{skill.label}</Badge>
            </span>
          );
          return (
            <li key={memberId}>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => onSelectMember(memberId)}
                  disabled={busy}
                  aria-pressed={selected}
                  className={cn(
                    "border-border flex w-full items-center rounded-xl border-2 px-3 py-2 text-left transition-colors",
                    selected ? "border-candy bg-candy-tint" : "hover:bg-muted bg-card",
                  )}
                >
                  {chip}
                </button>
              ) : (
                <div className="border-border flex items-center rounded-xl border-2 bg-card px-3 py-2">
                  {chip}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <TeamStrengthBar strength={team.strength} confidence={team.confidence} />

      {team.reasons.length > 0 ? (
        <p className="text-2xs text-muted-foreground leading-relaxed">{team.reasons.join(" · ")}</p>
      ) : null}
    </div>
  );
}
