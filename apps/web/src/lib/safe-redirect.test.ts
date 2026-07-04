import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("accepts simple relative paths", () => {
    expect(safeRedirectPath("/console")).toBe("/console");
    expect(safeRedirectPath("/console/tournaments/123")).toBe("/console/tournaments/123");
    expect(safeRedirectPath("/invite?token=abc")).toBe("/invite?token=abc");
  });

  it("returns fallback for null/undefined/empty", () => {
    expect(safeRedirectPath(null)).toBe("/console");
    expect(safeRedirectPath(undefined)).toBe("/console");
    expect(safeRedirectPath("")).toBe("/console");
  });

  it("rejects absolute URLs", () => {
    expect(safeRedirectPath("https://evil.com")).toBe("/console");
    expect(safeRedirectPath("http://evil.com")).toBe("/console");
    expect(safeRedirectPath("ftp://evil.com")).toBe("/console");
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeRedirectPath("//evil.com")).toBe("/console");
    expect(safeRedirectPath("//evil.com/path")).toBe("/console");
  });

  it("rejects backslash tricks", () => {
    expect(safeRedirectPath("\\evil.com")).toBe("/console");
    expect(safeRedirectPath("/path\\evil")).toBe("/console");
  });

  it("rejects embedded credentials", () => {
    expect(safeRedirectPath("/@evil.com")).toBe("/console");
    expect(safeRedirectPath("/path@host")).toBe("/console");
  });

  it("honors custom fallback", () => {
    expect(safeRedirectPath(null, "/onboarding")).toBe("/onboarding");
    expect(safeRedirectPath("https://evil.com", "/onboarding")).toBe("/onboarding");
  });
});
