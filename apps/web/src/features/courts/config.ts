import type { BadgeProps } from "@/components/ui/badge";

type Tone = NonNullable<BadgeProps["tone"]>;

export const COURT_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "mint" },
  maintenance: { label: "Maintenance", tone: "yellow" },
  disabled: { label: "Disabled", tone: "muted" },
};

export function courtStatusMeta(status: string): { label: string; tone: Tone } {
  return COURT_STATUS[status] ?? { label: status, tone: "muted" };
}
