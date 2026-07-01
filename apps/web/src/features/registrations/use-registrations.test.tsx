import type { ApproveResult } from "@tournament/api-client";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/lib/query-keys";
import { createTestQueryClient, Providers, renderHook, waitFor } from "@/test/test-utils";
import { makeParticipant, makeRegistration, makeTeam } from "@/test/fixtures";

vi.mock("@/features/registrations/registrations-api");
import * as registrationsApi from "@/features/registrations/registrations-api";
import {
  useApproveRegistration,
  useBulkApproveRegistrations,
  useParticipants,
  useRegistrations,
  useRejectRegistration,
  useTeam,
  useWaitlistRegistration,
  useWithdrawRegistration,
} from "@/features/registrations/use-registrations";

const DIVISION_ID = "div-1";

function wrapperWith(client: ReturnType<typeof createTestQueryClient>) {
  function wrapper({ children }: { children: React.ReactNode }) {
    return <Providers client={client}>{children}</Providers>;
  }
  return wrapper;
}

describe("useRegistrations / useParticipants / useTeam", () => {
  beforeEach(() => vi.resetAllMocks());

  it("fetches the registration queue", async () => {
    const data = [makeRegistration({ status: "submitted" })];
    vi.mocked(registrationsApi.listRegistrations).mockResolvedValue(data);
    const client = createTestQueryClient();

    const { result } = renderHook(() => useRegistrations(DIVISION_ID), {
      wrapper: wrapperWith(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(registrationsApi.listRegistrations).toHaveBeenCalledWith(DIVISION_ID);
  });

  it("fetches participants", async () => {
    vi.mocked(registrationsApi.listParticipants).mockResolvedValue([makeParticipant()]);
    const client = createTestQueryClient();

    const { result } = renderHook(() => useParticipants(DIVISION_ID), {
      wrapper: wrapperWith(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it("fetches a team's roster, disabled without an id", () => {
    const client = createTestQueryClient();
    renderHook(() => useTeam(null), { wrapper: wrapperWith(client) });
    expect(registrationsApi.getTeam).not.toHaveBeenCalled();
  });

  it("fetches a team's roster when given an id", async () => {
    vi.mocked(registrationsApi.getTeam).mockResolvedValue(makeTeam({ name: "Aces" }));
    const client = createTestQueryClient();

    const { result } = renderHook(() => useTeam("team-1"), { wrapper: wrapperWith(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe("Aces");
  });
});

/**
 * The test client uses `gcTime: 0` (see `createTestQueryClient`), so data seeded via
 * `setQueryData` with no active observer is garbage-collected almost immediately —
 * before a mutation's `onMutate` ever runs. Rendering `useRegistrations` alongside the
 * mutation keeps a real observer alive, which also mirrors how the screen actually uses
 * these hooks together (the list is already mounted while an action runs).
 */
function useApproveHarness(divisionId: string) {
  const list = useRegistrations(divisionId);
  const approve = useApproveRegistration(divisionId);
  return { list, approve };
}

describe("useApproveRegistration (optimistic update)", () => {
  beforeEach(() => vi.resetAllMocks());

  it("flips status optimistically, then settles from the server", async () => {
    const registration = makeRegistration({ id: "r-1", status: "submitted" });
    const client = createTestQueryClient();

    let resolveApprove!: (v: ApproveResult) => void;
    vi.mocked(registrationsApi.listRegistrations).mockResolvedValue([registration]);
    vi.mocked(registrationsApi.approveRegistration).mockReturnValue(
      new Promise((resolve) => {
        resolveApprove = resolve;
      }),
    );

    const { result } = renderHook(() => useApproveHarness(DIVISION_ID), {
      wrapper: wrapperWith(client),
    });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    result.current.approve.mutate("r-1");

    // Optimistic: the cache flips before the network call resolves.
    await waitFor(() => expect(result.current.list.data?.[0]?.status).toBe("approved"));

    resolveApprove({ registrationId: "r-1", status: "approved", participantId: "p-1" });
    await waitFor(() => expect(result.current.approve.isSuccess).toBe(true));
  });

  it("rolls back the optimistic flip when the API rejects", async () => {
    const registration = makeRegistration({ id: "r-1", status: "submitted" });
    const client = createTestQueryClient();
    vi.mocked(registrationsApi.listRegistrations).mockResolvedValue([registration]);
    vi.mocked(registrationsApi.approveRegistration).mockRejectedValue(
      new Error("registration is rejected, cannot approve"),
    );

    const { result } = renderHook(() => useApproveHarness(DIVISION_ID), {
      wrapper: wrapperWith(client),
    });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    result.current.approve.mutate("r-1", { onError: () => {} });

    await waitFor(() => expect(result.current.approve.isError).toBe(true));
    expect(result.current.list.data?.[0]?.status).toBe("submitted");
  });
});

describe("useRejectRegistration / useWaitlistRegistration / useWithdrawRegistration", () => {
  beforeEach(() => vi.resetAllMocks());

  it("reject calls the transport and settles to the rejected optimistic state", async () => {
    const registration = makeRegistration({ id: "r-1", status: "submitted" });
    const client = createTestQueryClient();
    vi.mocked(registrationsApi.rejectRegistration).mockResolvedValue({
      ...registration,
      status: "rejected",
    });
    vi.mocked(registrationsApi.listRegistrations).mockResolvedValue([
      { ...registration, status: "rejected" },
    ]);

    const { result } = renderHook(() => useRejectRegistration(DIVISION_ID), {
      wrapper: wrapperWith(client),
    });
    result.current.mutate("r-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(vi.mocked(registrationsApi.rejectRegistration).mock.calls[0]?.[0]).toBe("r-1");
  });

  it("waitlist calls the transport", async () => {
    const registration = makeRegistration({ id: "r-1", status: "submitted" });
    const client = createTestQueryClient();
    vi.mocked(registrationsApi.waitlistRegistration).mockResolvedValue({
      ...registration,
      status: "waitlisted",
    });
    vi.mocked(registrationsApi.listRegistrations).mockResolvedValue([registration]);

    const { result } = renderHook(() => useWaitlistRegistration(DIVISION_ID), {
      wrapper: wrapperWith(client),
    });
    result.current.mutate("r-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(vi.mocked(registrationsApi.waitlistRegistration).mock.calls[0]?.[0]).toBe("r-1");
  });

  it("withdraw calls the transport", async () => {
    const registration = makeRegistration({ id: "r-1", status: "approved" });
    const client = createTestQueryClient();
    vi.mocked(registrationsApi.withdrawRegistration).mockResolvedValue({
      ...registration,
      status: "withdrawn",
    });
    vi.mocked(registrationsApi.listRegistrations).mockResolvedValue([registration]);

    const { result } = renderHook(() => useWithdrawRegistration(DIVISION_ID), {
      wrapper: wrapperWith(client),
    });
    result.current.mutate("r-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(vi.mocked(registrationsApi.withdrawRegistration).mock.calls[0]?.[0]).toBe("r-1");
  });
});

describe("useBulkApproveRegistrations (fan-out, no bulk endpoint)", () => {
  beforeEach(() => vi.resetAllMocks());

  it("reports a precise per-id summary on partial failure", async () => {
    const regs = [
      makeRegistration({ id: "r-1", status: "submitted" }),
      makeRegistration({ id: "r-2", status: "rejected" }),
    ];
    const client = createTestQueryClient();
    client.setQueryData(queryKeys.divisions.registrations(DIVISION_ID), regs);
    vi.mocked(registrationsApi.listRegistrations).mockResolvedValue(regs);
    vi.mocked(registrationsApi.approveRegistration).mockImplementation((id: string) =>
      id === "r-1"
        ? Promise.resolve({ registrationId: id, status: "approved", participantId: "p-1" })
        : Promise.reject(new Error("registration is rejected, cannot approve")),
    );

    const { result } = renderHook(() => useBulkApproveRegistrations(DIVISION_ID), {
      wrapper: wrapperWith(client),
    });

    result.current.mutate(["r-1", "r-2"]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.succeeded).toEqual(["r-1"]);
    expect(result.current.data?.failed.map((f) => f.id)).toEqual(["r-2"]);
  });
});
