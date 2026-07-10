"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { ErrorState } from "@/components/common/error-state";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import {
  buildScorekeeperMeta,
  buildScorekeeperTitle,
  CourtScorekeeperPanel,
} from "@/features/scoring/components/court-scorekeeper-panel";
import { MatchScorekeeperHeader } from "@/features/scoring/components/match-scorekeeper-header";
import { rulesFromSportConfig } from "@/features/matches/badminton-scoring";
import * as publicScorekeeperApi from "@/features/scoring/public-scorekeeper-api";
import {
  ScorekeeperApiError,
  type ScorekeeperSession,
} from "@/features/scoring/public-scorekeeper-api";
import { errorMessage } from "@/lib/problem";

function PublicScorekeeperScoring({
  token,
  data,
  initialEtag,
}: {
  token: string;
  data: ScorekeeperSession;
  initialEtag: string | null;
}) {
  const match = data.match;
  const rules = rulesFromSportConfig(data.sportConfig);
  const labelA = match.sideLabels[0] ?? "Side 1";
  const labelB = match.sideLabels[1] ?? "Side 2";
  const headerTitle = buildScorekeeperTitle(
    match.groupName,
    match.roundLabel,
    `${labelA} vs ${labelB}`,
  );
  const headerMeta = buildScorekeeperMeta(match.courtName, rules);

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const etag = initialEtag;
  const scoringStartedRef = useRef(match.matchStatus === "live");

  const markLive = useCallback(async () => {
    if (scoringStartedRef.current || match.matchStatus !== "scheduled") return;
    scoringStartedRef.current = true;
    try {
      await publicScorekeeperApi.startMatch(token, etag);
    } catch (err) {
      scoringStartedRef.current = false;
      toast.error(errorMessage(err, "Couldn't start match"));
      throw err;
    }
  }, [token, etag, match.matchStatus]);

  // Umpire lands directly on scoring — mark live as soon as they open the link.
  useEffect(() => {
    void markLive().catch(() => {});
  }, [markLive]);

  if (done || match.matchStatus === "completed") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <h1 className="font-serif text-2xl font-bold">Match Recorded</h1>
        <p className="text-muted-foreground text-sm">
          {labelA} vs {labelB} — saved to {data.tournamentName}.
          <span className="text-muted-foreground mt-2 block text-xs">
            you can close this tab now
          </span>
        </p>
      </div>
    );
  }

  const handleScoringStart = () => {
    void markLive().catch(() => {});
  };

  const handleSubmit = async (payload: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      await publicScorekeeperApi.submitScore(token, payload, etag ?? initialEtag);
      toast.success("Match result saved");
      setDone(true);
    } catch (err) {
      if (err instanceof ScorekeeperApiError && err.status === 412) {
        toast.error("Score changed elsewhere — refresh and try again.");
        return;
      }
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <MatchScorekeeperHeader title={headerTitle} meta={headerMeta} />
      <CourtScorekeeperPanel
        labelA={labelA}
        labelB={labelB}
        rules={rules}
        submitting={submitting}
        fetchingEtag={false}
        onSubmit={handleSubmit}
        onComplete={() => setDone(true)}
        onScoringStart={handleScoringStart}
      />
    </>
  );
}

/** Public scorekeeper — one match per token, lands directly on the mobile scoring UI. */
export function PublicScorekeeperView({ token }: { token: string }) {
  const session = useQuery({
    queryKey: ["scorekeeper", token, "session"],
    queryFn: () => publicScorekeeperApi.getSession(token),
    retry: false,
  });

  if (session.isLoading) {
    return (
      <div className="grid flex-1 place-items-center">
        <Spinner />
      </div>
    );
  }

  if (session.isError || !session.data) {
    return (
      <div className="flex flex-1 flex-col justify-center p-4">
        <ErrorState
          error={session.error}
          title={
            session.error instanceof ScorekeeperApiError
              ? "Link invalid or expired"
              : "Couldn't open scorekeeper"
          }
        />
      </div>
    );
  }

  const { session: data, etag: initialEtag } = session.data;
  return <PublicScorekeeperScoring token={token} data={data} initialEtag={initialEtag} />;
}
