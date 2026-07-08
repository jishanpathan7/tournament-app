import type { SquadMemberView } from "@/features/squads/types";
import { cn } from "@/lib/utils";

const SKILL_SEGMENTS = [
  { key: "advanced", className: "bg-pink-300" },
  { key: "intermediate", className: "bg-candy" },
  { key: "beginner", className: "bg-mint" },
  { key: null, className: "bg-muted" },
] as const;

function segmentKey(skillLevel: string | null): string | null {
  if (!skillLevel) return null;
  if (skillLevel === "advanced" || skillLevel === "intermediate" || skillLevel === "beginner") {
    return skillLevel;
  }
  return null;
}

/** Horizontal skill distribution bar for collapsed team cards. */
export function SkillBar({
  members,
  className,
}: {
  members: SquadMemberView[];
  className?: string;
}) {
  if (members.length === 0) {
    return <div className={cn("bg-muted h-2 w-full rounded-full", className)} />;
  }

  const counts = new Map<string | null, number>();
  for (const member of members) {
    const key = segmentKey(member.skillLevel);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return (
    <div
      className={cn("border-ink/10 flex h-2 w-full overflow-hidden rounded-full border", className)}
      role="img"
      aria-label="Skill distribution"
    >
      {SKILL_SEGMENTS.map(({ key, className: segmentClass }) => {
        const count = counts.get(key) ?? 0;
        if (count === 0) return null;
        const width = (count / members.length) * 100;
        return (
          <div
            key={key ?? "unrated"}
            className={cn("h-full", segmentClass)}
            style={{ width: `${width}%` }}
            title={`${count} ${key ?? "unrated"}`}
          />
        );
      })}
    </div>
  );
}
