"use client";

import type { MatchView, ParticipantResponse } from "@tournament/api-client";
import { Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import * as scoringApi from "@/features/scoring/scoring-api";
import { useScoreMatch } from "@/features/scoring/use-matches";
import {
  buildScorePayload,
  previewWinnerFromGames,
  scoreFormFromResult,
  type GameScore,
  type ResultType,
  type ScoreFormValues,
  validateScoreForm,
} from "@/features/matches/config";
import { rulesFromSportConfig } from "@/features/matches/badminton-scoring";
import { ApiError, errorMessage } from "@/lib/problem";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

/**
 * Score submission for singles/doubles/walkovers/retirements. Structural checks only —
 * every real rule (win-by-2, point caps, who actually won) is decided by the backend
 * Sport Profile; a 422 comes back with a precise reason if the entered score is illegal.
 */
export function ScoreEntryForm({
  match,
  tournamentId,
  participantsById,
  onSuccess,
  variant = "default",
}: {
  match: MatchView;
  tournamentId: string;
  participantsById: Map<string, ParticipantResponse>;
  onSuccess?: () => void;
  variant?: "default" | "hero";
}) {
  const queryClient = useQueryClient();
  const rules = rulesFromSportConfig(match.sportConfig);
  const isHero = variant === "hero";
  const [values, setValues] = useState<ScoreFormValues>(() =>
    scoreFormFromResult(match, rules.bestOf),
  );
  const [etag, setEtag] = useState<string | null>(null);
  const [fetchingEtag, setFetchingEtag] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const score = useScoreMatch(match.id, tournamentId);

  const refreshEtag = () => {
    setFetchingEtag(true);
    return scoringApi.getMatchEtag(match.id).then((tag) => {
      setEtag(tag);
      setFetchingEtag(false);
      return tag;
    });
  };

  useEffect(() => {
    setValues(scoreFormFromResult(match, rules.bestOf));
    // Status-only updates (scheduled → live) must not wipe in-progress score entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when persisted result changes
  }, [match.id, JSON.stringify(match.resultPayload), rules.bestOf]);

  useEffect(() => {
    let alive = true;
    setFetchingEtag(true);
    scoringApi.getMatchEtag(match.id).then((tag) => {
      if (alive) {
        setEtag(tag);
        setFetchingEtag(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [match.id]);

  const sideLabel = (i: 0 | 1) =>
    participantsById.get(match.sides[i]?.participantId ?? "")?.displayName ?? `Side ${i + 1}`;

  const sideLabels = useMemo(
    () => [sideLabel(0), sideLabel(1)] as [string, string],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sideLabel depends on match + map
    [match.sides, participantsById],
  );

  const updateGame = (index: number, side: keyof GameScore, raw: string) => {
    const parsed = raw === "" ? null : Number(raw);
    setValues((s) => ({
      ...s,
      resultType: "normal",
      games: s.games.map((g, i) => (i === index ? { ...g, [side]: parsed } : g)),
    }));
  };

  const addGame = () =>
    setValues((s) =>
      s.games.length >= rules.bestOf ? s : { ...s, games: [...s.games, { a: null, b: null }] },
    );
  const removeGame = (index: number) =>
    setValues((s) => ({ ...s, games: s.games.filter((_, i) => i !== index) }));

  const setResultType = (resultType: ResultType) => setValues((s) => ({ ...s, resultType }));

  const filledGames = values.games.filter((g) => g.a !== null && g.b !== null).length;
  const winnerPreview =
    values.resultType === "normal" || values.resultType === "retirement"
      ? previewWinnerFromGames(values.games, sideLabels)
      : values.winnerSide !== null
        ? sideLabels[values.winnerSide]
        : null;

  const submit = () => {
    const validation = validateScoreForm(values);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    score.mutate(
      { payload: buildScorePayload(values), ifMatch: etag },
      {
        onSuccess: () => {
          toast.success("Score submitted");
          onSuccess?.();
        },
        onError: (e) => {
          if (e instanceof ApiError && e.status === 412) {
            setError("This match was updated elsewhere — refreshing…");
            void refreshEtag();
            void queryClient.invalidateQueries({ queryKey: queryKeys.matches.detail(match.id) });
            void queryClient.invalidateQueries({
              queryKey: queryKeys.tournaments.matches(tournamentId),
            });
          } else {
            setError(errorMessage(e, "Couldn't submit score"));
          }
        },
      },
    );
  };

  const showGames = values.resultType === "normal" || values.resultType === "retirement";
  const inputClass = isHero
    ? "h-14 w-full text-center text-3xl font-bold tabular-nums"
    : "w-20 text-center";

  return (
    <form
      className={cn("flex flex-col gap-4", isHero && "pb-2")}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {isHero ? (
        <div className="border-ink bg-card flex items-center justify-between rounded-2xl border-2 px-4 py-3">
          <span className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.14em]">
            Best of {rules.bestOf}
          </span>
          <span className="font-mono text-sm font-semibold tabular-nums">
            Game {Math.min(filledGames + 1, rules.bestOf)} of {rules.bestOf}
          </span>
        </div>
      ) : null}

      {showGames ? (
        <div className="flex flex-col gap-3">
          {values.games.map((game, i) => (
            <div key={i} className="flex flex-col gap-2">
              {isHero ? (
                <p className="text-muted-foreground text-center text-xs font-semibold uppercase tracking-wide">
                  Game {i + 1}
                </p>
              ) : (
                <span className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.14em]">
                  Game {i + 1}
                </span>
              )}
              <div
                className={cn(
                  "flex items-center gap-2",
                  isHero && "grid grid-cols-[1fr_auto_1fr] items-end gap-3",
                )}
              >
                <div className={cn(isHero && "flex flex-col items-center gap-1")}>
                  {isHero ? (
                    <span className="text-muted-foreground max-w-full truncate text-xs font-medium">
                      {sideLabel(0)}
                    </span>
                  ) : null}
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={game.a ?? ""}
                    onChange={(e) => updateGame(i, "a", e.target.value)}
                    aria-label={`Game ${i + 1}, ${sideLabel(0)} score`}
                    className={inputClass}
                    autoFocus={i === 0 && isHero}
                  />
                </div>
                <span className="text-muted-foreground pb-2 text-center font-bold" aria-hidden>
                  –
                </span>
                <div className={cn(isHero && "flex flex-col items-center gap-1")}>
                  {isHero ? (
                    <span className="text-muted-foreground max-w-full truncate text-xs font-medium">
                      {sideLabel(1)}
                    </span>
                  ) : null}
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={game.b ?? ""}
                    onChange={(e) => updateGame(i, "b", e.target.value)}
                    aria-label={`Game ${i + 1}, ${sideLabel(1)} score`}
                    className={inputClass}
                  />
                </div>
                {!isHero && values.games.length > 1 ? (
                  <Button
                    type="button"
                    tone="ghost"
                    size="icon-sm"
                    onClick={() => removeGame(i)}
                    aria-label={`Remove game ${i + 1}`}
                  >
                    <X className="h-4 w-4" strokeWidth={2.25} />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          <Button
            type="button"
            tone="paper"
            size="sm"
            onClick={addGame}
            className="self-start"
            disabled={values.games.length >= rules.bestOf}
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            Add game
          </Button>
        </div>
      ) : null}

      {values.resultType === "retirement" ? (
        <Field label="Who retired?" htmlFor="retired-side">
          <div className="flex gap-2" id="retired-side">
            {([0, 1] as const).map((side) => (
              <Button
                key={side}
                type="button"
                tone={values.retiredSide === side ? "candy" : "paper"}
                size={isHero ? "md" : "sm"}
                onClick={() => setValues((s) => ({ ...s, retiredSide: side }))}
              >
                {sideLabel(side)}
              </Button>
            ))}
          </div>
        </Field>
      ) : null}

      {(values.resultType === "walkover" || values.resultType === "no_show") && (
        <Field label="Who wins?" htmlFor="winner-side">
          <div className="flex gap-2" id="winner-side">
            {([0, 1] as const).map((side) => (
              <Button
                key={side}
                type="button"
                tone={values.winnerSide === side ? "candy" : "paper"}
                size={isHero ? "md" : "sm"}
                onClick={() => setValues((s) => ({ ...s, winnerSide: side }))}
              >
                {sideLabel(side)}
              </Button>
            ))}
          </div>
        </Field>
      )}

      {isHero ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            tone={values.resultType === "walkover" ? "candy" : "paper"}
            size="sm"
            onClick={() => setResultType("walkover")}
          >
            Walkover
          </Button>
          <Button
            type="button"
            tone={values.resultType === "retirement" ? "candy" : "paper"}
            size="sm"
            onClick={() => setResultType("retirement")}
          >
            Retirement
          </Button>
          <Button
            type="button"
            tone={values.resultType === "no_show" ? "candy" : "paper"}
            size="sm"
            onClick={() => setResultType("no_show")}
          >
            No show
          </Button>
          {values.resultType !== "normal" ? (
            <Button type="button" tone="ghost" size="sm" onClick={() => setResultType("normal")}>
              Final score
            </Button>
          ) : null}
        </div>
      ) : null}

      {winnerPreview ? (
        <p className="border-mint bg-mint-tint text-mint-dark rounded-2xl border-2 px-4 py-3 text-sm font-semibold">
          Winner preview: {winnerPreview}
        </p>
      ) : null}

      {error ? (
        <p
          className="border-pink bg-pink-tint text-ink rounded-2xl border-2 p-3 text-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className={cn(isHero && "border-ink bg-card sticky bottom-0 -mx-1 border-t-2 pt-3")}>
        <Button
          type="submit"
          tone="candy"
          className={cn(isHero && "w-full")}
          disabled={score.isPending || fetchingEtag}
        >
          {score.isPending ? <Spinner className="text-white" /> : null}
          {match.status === "completed" ? "Save correction" : "Finish match"}
        </Button>
      </div>
    </form>
  );
}
