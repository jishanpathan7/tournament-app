import { describe, expect, it } from "vitest";

import { SITE, siteTitle } from "@/lib/site";

describe("SITE", () => {
  it("defines Playlane identity constants", () => {
    expect(SITE.name).toBe("Playlane");
    expect(SITE.tagline).toContain("champion");
    expect(SITE.description).toBeTruthy();
    expect(SITE.titleTemplate).toContain("Playlane");
  });

  it("builds page titles from the template", () => {
    expect(siteTitle("Sign in")).toBe("Sign in · Playlane");
  });
});
