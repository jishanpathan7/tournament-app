import { beforeEach, describe, expect, it, vi } from "vitest";

import { PublicParticipantsList } from "@/features/public/components/public-participants-list";
import { makePublicDivision, makePublicParticipant } from "@/test/fixtures";
import { renderWithProviders, screen } from "@/test/test-utils";

vi.mock("@/features/public/public-api");
import * as publicApi from "@/features/public/public-api";

const SLUG = "linklane-league-2026";

describe("PublicParticipantsList", () => {
  beforeEach(() => vi.resetAllMocks());

  it("lists each person once, not again inside their pair", async () => {
    // The API returns every layer on purpose — the bracket resolves its sides
    // against the same list — so this page is what collapses them.
    vi.mocked(publicApi.listDivisions).mockResolvedValue([makePublicDivision({ id: "div-1" })]);
    vi.mocked(publicApi.listParticipants).mockResolvedValue([
      makePublicParticipant({ id: "i-1", divisionId: "div-1", displayName: "Vibhu Banka" }),
      makePublicParticipant({ id: "i-2", divisionId: "div-1", displayName: "Anurag Jaiswal" }),
      makePublicParticipant({
        id: "pair-1",
        divisionId: "div-1",
        kind: "pair",
        displayName: "Vibhu Banka / Anurag Jaiswal",
      }),
    ]);

    renderWithProviders(<PublicParticipantsList slug={SLUG} />);

    expect(await screen.findByText("Vibhu Banka")).toBeInTheDocument();
    expect(screen.getByText("Anurag Jaiswal")).toBeInTheDocument();
    expect(screen.queryByText("Vibhu Banka / Anurag Jaiswal")).not.toBeInTheDocument();
  });

  it("keeps a pairs-only division, which has nothing to collapse into", async () => {
    vi.mocked(publicApi.listDivisions).mockResolvedValue([makePublicDivision({ id: "div-2" })]);
    vi.mocked(publicApi.listParticipants).mockResolvedValue([
      makePublicParticipant({
        id: "pair-9",
        divisionId: "div-2",
        kind: "pair",
        displayName: "Adarsh / Sudeep K",
      }),
    ]);

    renderWithProviders(<PublicParticipantsList slug={SLUG} />);

    expect(await screen.findByText("Adarsh / Sudeep K")).toBeInTheDocument();
  });
});
