import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the transport so we can assert the register→login chain.
vi.mock("@/lib/api", () => ({
  api: { post: vi.fn() },
  apiGet: vi.fn(),
}));
import { api } from "@/lib/api";
import { register } from "@/features/auth/auth-api";

describe("register (first signup)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts to /auth/register and returns the established session", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { id: "u1", email: "new@example.com" },
    } as never);

    const me = await register({
      email: "new@example.com",
      name: "New User",
      password: "supersecret",
    });

    // The endpoint itself signs the user in — no separate login round-trip (avoids a
    // commit race) — so exactly one call.
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith("/auth/register", {
      email: "new@example.com",
      name: "New User",
      password: "supersecret",
    });
    expect(me).toEqual({ id: "u1", email: "new@example.com" });
  });
});
