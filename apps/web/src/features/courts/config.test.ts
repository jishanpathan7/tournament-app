import { describe, expect, it } from "vitest";

import { courtStatusMeta } from "@/features/courts/config";

describe("courtStatusMeta", () => {
  it("maps every known status to a label + tone", () => {
    expect(courtStatusMeta("active")).toEqual({ label: "Active", tone: "mint" });
    expect(courtStatusMeta("maintenance")).toEqual({ label: "Maintenance", tone: "yellow" });
    expect(courtStatusMeta("disabled")).toEqual({ label: "Disabled", tone: "muted" });
  });

  it("falls back to the raw status with a muted tone for anything unknown", () => {
    expect(courtStatusMeta("something_new")).toEqual({ label: "something_new", tone: "muted" });
  });
});
