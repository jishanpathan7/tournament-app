/** Central Playlane product identity — used for metadata, marketing, and shell chrome. */

export const SITE = {
  name: "Playlane",
  tagline: "Run tournaments from registration to champion.",
  description: "The modern operating system for competitive events.",
  authDescription: "Competition management built for modern organizers.",
  titleTemplate: "%s · Playlane",
} as const;

export function siteTitle(page: string): string {
  return SITE.titleTemplate.replace("%s", page);
}
