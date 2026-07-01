/**
 * Curated option lists for org onboarding. `timezone` maps to the org's `timezone`
 * column; `country` and `defaultSport` are stored in the free-form `branding` object
 * (the backend has no dedicated columns). Sports reuse the tournaments capability list.
 */
import { SPORTS } from "@/features/tournaments/config";

export { SPORTS };

/** IANA timezones — a practical shortlist (extend as needed; not the full tz database). */
export const TIMEZONES: string[] = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Australia/Sydney",
];

export interface Country {
  code: string;
  name: string;
}

/** ISO-3166 shortlist covering major regions + the SIBL context. */
export const COUNTRIES: Country[] = [
  { code: "IN", name: "India" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SG", name: "Singapore" },
  { code: "AU", name: "Australia" },
  { code: "CA", name: "Canada" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "JP", name: "Japan" },
  { code: "CN", name: "China" },
  { code: "BR", name: "Brazil" },
  { code: "ZA", name: "South Africa" },
];

/** A best-effort default timezone from the browser, falling back to UTC. */
export function guessTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONES.includes(tz) ? tz : "UTC";
  } catch {
    return "UTC";
  }
}
