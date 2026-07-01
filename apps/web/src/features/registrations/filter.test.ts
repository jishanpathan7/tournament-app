import { describe, expect, it } from "vitest";

import { applyRegistrationFilters } from "@/features/registrations/filter";
import { makeMember, makeRegistration } from "@/test/fixtures";

describe("applyRegistrationFilters", () => {
  const alice = makeMember({ userId: "u-alice", name: "Alice Chen", email: "alice@example.com" });
  const bob = makeMember({ userId: "u-bob", name: "Bob Diaz", email: "bob@example.com" });
  const membersById = new Map([
    [alice.userId, alice],
    [bob.userId, bob],
  ]);

  const registrations = [
    makeRegistration({
      submittedBy: alice.userId,
      status: "submitted",
      skillLevel: "advanced",
      createdAt: "2026-03-01T00:00:00Z",
    }),
    makeRegistration({
      submittedBy: bob.userId,
      status: "approved",
      formResponse: { teamName: "Net Ninjas" },
      createdAt: "2026-01-01T00:00:00Z",
    }),
    makeRegistration({
      submittedBy: bob.userId,
      status: "waitlisted",
      createdAt: "2026-02-01T00:00:00Z",
    }),
  ];

  it("matches by submitter name", () => {
    const result = applyRegistrationFilters(
      registrations,
      { search: "alice", status: "all", sort: "recent" },
      membersById,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.submittedBy).toBe(alice.userId);
  });

  it("matches by submitter email", () => {
    const result = applyRegistrationFilters(
      registrations,
      { search: "bob@example", status: "all", sort: "recent" },
      membersById,
    );
    expect(result).toHaveLength(2);
  });

  it("matches inside the opaque formResponse", () => {
    const result = applyRegistrationFilters(
      registrations,
      { search: "net ninjas", status: "all", sort: "recent" },
      membersById,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.formResponse).toEqual({ teamName: "Net Ninjas" });
  });

  it("matches by skill level", () => {
    const result = applyRegistrationFilters(
      registrations,
      { search: "advanced", status: "all", sort: "recent" },
      membersById,
    );
    expect(result).toHaveLength(1);
  });

  it("filters by status", () => {
    const result = applyRegistrationFilters(
      registrations,
      { search: "", status: "waitlisted", sort: "recent" },
      membersById,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.status).toBe("waitlisted");
  });

  it("sorts newest first by default", () => {
    const result = applyRegistrationFilters(
      registrations,
      { search: "", status: "all", sort: "recent" },
      membersById,
    );
    expect(result.map((r) => r.createdAt)).toEqual([
      "2026-03-01T00:00:00Z",
      "2026-02-01T00:00:00Z",
      "2026-01-01T00:00:00Z",
    ]);
  });

  it("sorts oldest first when requested", () => {
    const result = applyRegistrationFilters(
      registrations,
      { search: "", status: "all", sort: "oldest" },
      membersById,
    );
    expect(result.map((r) => r.createdAt)).toEqual([
      "2026-01-01T00:00:00Z",
      "2026-02-01T00:00:00Z",
      "2026-03-01T00:00:00Z",
    ]);
  });

  it("returns everything for an empty search", () => {
    const result = applyRegistrationFilters(
      registrations,
      { search: "   ", status: "all", sort: "recent" },
      membersById,
    );
    expect(result).toHaveLength(3);
  });
});
