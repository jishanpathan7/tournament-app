"use client";

import type { MatchView, ParticipantResponse } from "@tournament/api-client";
import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as scoringApi from "@/features/scoring/scoring-api";
import { useScoreMatch } from "@/features/scoring/use-matches";
import {
  buildScorePayload,
  emptyScoreForm,
  RESULT_TYPES,
  type GameScore,
  type ResultType,
  type ScoreFormValues,
  validateScoreForm,
} from "@/features/matches/config";
import { rulesFromSportConfig } from "@/features/matches/badminton-scoring";
import { ApiError, errorMessage } from "@/lib/problem";

/**
 * Score submission for singles/doubles/walkovers/retirements. Structural checks only —
 * every real rule (win-by-2, point caps, who actually won) is decided by the backend
 * Sport Profile; a 422 comes back with a precise reason if the entered score is illegal.
 * Guards against a stale overwrite via `If-Match` (fetched fresh when the form mounts).
 */
export function ScoreEntryForm({
  match,
  tournamentId,
  participantsById,
  onSuccess,
}: {
  match: MatchView;
  tournamentId: string;
  participantsById: Map<string, ParticipantResponse>;
  onSuccess?: () => void;
}) {
  const rules = rulesFromSportConfig(match.sportConfig);
  const [values, setValues] = useState<ScoreFormValues>(() => emptyScoreForm(rules.bestOf));
  const [etag, setEtag] = useState<string | null>(null);
  const [fetchingEtag, setFetchingEtag] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const score = useScoreMatch(match.id, tournamentId);

  useEffect(() => {
    setValues(emptyScoreForm(rules.bestOf));
  }, [match.id, rules.bestOf]);

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

  const updateGame = (index: number, side: keyof GameScore, raw: string) => {
    const parsed = raw === "" ? null : Number(raw);
    setValues((s) => ({
      ...s,
      games: s.games.map((g, i) => (i === index ? { ...g, [side]: parsed } : g)),
    }));
  };

  const addGame = () =>
    setValues((s) =>
      s.games.length >= rules.bestOf
        ? s
        : { ...s, games: [...s.games, { a: null, b: null }] },
    );
  const removeGame = (index: number) =>
    setValues((s) => ({ ...s, games: s.games.filter((_, i) => i !== index) }));

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
            setError(
              "This match was updated elsewhere — refresh to see the latest state, then try again.",
            );
          } else {
            setError(errorMessage(e, "Couldn't submit score"));
          }
        },
      },
    );
  };

  const showGames = values.resultType === "normal" || values.resultType === "retirement";

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Tabs
        value={values.resultType}
        onValueChange={(v) => setValues((s) => ({ ...s, resultType: v as ResultType }))}
      >
        <TabsList>
          {RESULT_TYPES.map((rt) => (
            <TabsTrigger key={rt.value} value={rt.value}>
              {rt.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {showGames ? (
        <div className="flex flex-col gap-2">
          {values.games.map((game, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-muted-foreground w-16 shrink-0 text-2xs font-mono uppercase tracking-[0.14em]">
                Game {i + 1}
              </span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={game.a ?? ""}
                onChange={(e) => updateGame(i, "a", e.target.value)}
                aria-label={`Game ${i + 1}, ${sideLabel(0)} score`}
                className="w-20 text-center"
                autoFocus={i === 0}
              />
              <span className="text-muted-foreground" aria-hidden>
                –
              </span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={game.b ?? ""}
                onChange={(e) => updateGame(i, "b", e.target.value)}
                aria-label={`Game ${i + 1}, ${sideLabel(1)} score`}
                className="w-20 text-center"
              />
              {values.games.length > 1 ? (
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
                size="sm"
                onClick={() => setValues((s) => ({ ...s, retiredSide: side }))}
              >
                {sideLabel(side)}
              </Button>
            ))}
          </div>
        </Field>
      ) : null}

      {values.resultType === "walkover" || values.resultType === "no_show" ? (
        <Field label="Who wins?" htmlFor="winner-side">
          <div className="flex gap-2" id="winner-side">
            {([0, 1] as const).map((side) => (
              <Button
                key={side}
                type="button"
                tone={values.winnerSide === side ? "candy" : "paper"}
                size="sm"
                onClick={() => setValues((s) => ({ ...s, winnerSide: side }))}
              >
                {sideLabel(side)}
              </Button>
            ))}
          </div>
        </Field>
      ) : null}

      {error ? (
        <p className="border-pink bg-pink-tint text-ink rounded-2xl border-2 p-3 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" tone="candy" disabled={score.isPending || fetchingEtag}>
        {score.isPending ? <Spinner className="text-white" /> : null}
        Submit result
      </Button>
    </form>
  );
}
