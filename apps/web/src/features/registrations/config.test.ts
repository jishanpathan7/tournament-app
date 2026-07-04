import { describe, expect, it } from "vitest";

import {
  entrantLabel,
  formResponseSummary,
  registrationEntrantLabel,
  registrationsToCsv,
  statusMeta,
} from "@/features/registrations/config";
import { makeMember, makeParticipant, makeRegistration } from "@/test/fixtures";

describe("statusMeta", () => {
  it("resolves known statuses to a label + tone", () => {
    expect(statusMeta("waitlisted")).toEqual({ label: "Waitlisted", tone: "yellow" });
    expect(statusMeta("submitted")).toEqual({ label: "Pending", tone: "candy" });
  });

  it("falls back to the raw value for unknown statuses", () => {
    expect(statusMeta("mystery")).toEqual({ label: "mystery", tone: "muted" });
  });
});

describe("entrantLabel", () => {
  it("prefers the member's name", () => {
    const member = makeMember({ userId: "u-1", name: "Alice Chen", email: "alice@example.com" });
    expect(entrantLabel("u-1", new Map([["u-1", member]]))).toBe("Alice Chen");
  });

  it("falls back to email when name is empty", () => {
    const member = makeMember({ userId: "u-1", name: "", email: "alice@example.com" });
    expect(entrantLabel("u-1", new Map([["u-1", member]]))).toBe("alice@example.com");
  });

  it("never renders a bare UUID when the member is unresolved", () => {
    const label = entrantLabel("019f1e73-d022-7a75-ac84-4d1f76764f2a", new Map());
    expect(label).not.toContain("019f1e73-d022-7a75-ac84-4d1f76764f2a");
    expect(label).toMatch(/^Entrant /);
  });
});

describe("registrationEntrantLabel", () => {
  it("prefers the imported name in formResponse over the submitter account", () => {
    const member = makeMember({ userId: "u-org", name: "Jishan Pathan", email: "j@example.com" });
    const registration = makeRegistration({
      submittedBy: "u-org",
      formResponse: { name: "Mihir Tuli", email: "m@example.com" },
    });
    expect(registrationEntrantLabel(registration, new Map([["u-org", member]]))).toBe(
      "Mihir Tuli",
    );
  });
});

describe("formResponseSummary", () => {
  it("prefers teamName", () => {
    expect(formResponseSummary({ teamName: "Aces", players: [] })).toBe("Aces");
  });

  it("joins player names when there is no teamName", () => {
    expect(formResponseSummary({ players: [{ name: "A" }, { name: "B" }] })).toBe("A / B");
  });

  it("returns null for an unrelated shape", () => {
    expect(formResponseSummary({ note: "no seed preference" })).toBeNull();
  });
});

describe("registrationsToCsv", () => {
  it("escapes commas/quotes and includes resolved entrant + team labels", () => {
    const member = makeMember({ userId: "u-1", name: 'Alice "Ace" Chen', email: "a@example.com" });
    const registration = makeRegistration({
      submittedBy: "u-1",
      status: "approved",
      skillLevel: "advanced",
      formResponse: { teamName: "Net, Ninjas" },
      participantId: "p-1",
    });
    const participant = makeParticipant({ id: "p-1", displayName: "Net Ninjas" });

    const csv = registrationsToCsv(
      [registration],
      new Map([["u-1", member]]),
      new Map([["p-1", participant]]),
    );
    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      '"Entrant","Status","Skill level","Team / partner","Participant","Submitted at"',
    );
    expect(lines[1]).toContain('"Alice ""Ace"" Chen"');
    expect(lines[1]).toContain('"Net, Ninjas"');
    expect(lines[1]).toContain('"Approved"');
  });
});
