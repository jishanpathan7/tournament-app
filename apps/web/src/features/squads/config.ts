export const TEAM_COUNT_PRESETS = [4, 6, 8] as const;

export const SQUAD_TINTS = [
  "bg-candy-tint",
  "bg-mint-tint",
  "bg-yellow-tint",
  "bg-pink-tint",
] as const;

export function squadTint(index: number): string {
  return SQUAD_TINTS[index % SQUAD_TINTS.length] ?? "bg-muted";
}
