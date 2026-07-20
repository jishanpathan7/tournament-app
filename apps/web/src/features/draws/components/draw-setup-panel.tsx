"use client";

import type { StageResponse } from "@tournament/api-client";
import { AlertTriangle, CheckCircle2, Lock, Shuffle, Trash2, Trophy, XCircle } from "lucide-react";
import { useState } from "react";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { AdvanceToKnockoutDialog } from "@/features/draws/components/advance-to-knockout-dialog";
import { ClearDrawDialog } from "@/features/draws/components/clear-draw-dialog";
import { evaluateDrawReadiness } from "@/features/draws/config";
import { GenerateDrawDialog } from "@/features/draws/components/generate-draw-dialog";
import {
  getFormat,
  getScoringPreset,
  MATCH_FORMATS,
  SCORING_RULE_PRESETS,
} from "@/features/tournaments/config";
import { useUpdateStageConfig } from "@/features/tournaments/use-tournaments";
import { errorMessage } from "@/lib/problem";

/** Draw Setup: format + participant-count preview, a readiness checklist, warnings to
 * review before committing, and the generate/regenerate actions. All the actual decisions
 * (can this be drawn? can this be cleared?) are re-validated server-side — this only
 * previews them so the organizer isn't surprised by a 409/422. */
export function DrawSetupPanel({
  stage,
  divisionId,
  tournamentId,
  approvedCount,
  canManage,
  tournamentSlug,
  isFranchise = false,
}: {
  stage: StageResponse;
  divisionId: string;
  tournamentId: string;
  approvedCount: number;
  canManage: boolean;
  tournamentSlug?: string;
  /** Teams compete here — fixtures come from the team draw, not this panel. */
  isFranchise?: boolean;
}) {
  const [generateOpen, setGenerateOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const updateConfig = useUpdateStageConfig(stage.id, divisionId);

  const format = getFormat(stage.type);
  const stageConfig = stage.config as Record<string, unknown>;
  const stageBestOf = stageConfig.bestOf as number | undefined;
  const stagePointsPerSet = stageConfig.pointsPerSet as number | undefined;
  const activeScoringPreset = getScoringPreset(stagePointsPerSet);
  const readiness = evaluateDrawReadiness({
    approvedCount,
    format: stage.type,
    alreadyDrawn: stage.drawn,
  });
  const Icon = format?.icon ?? Shuffle;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="border-ink bg-candy-tint text-candy-dark shadow-sticker-xs flex h-10 w-10 items-center justify-center rounded-full border-2">
            <Icon className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div className="flex flex-col gap-0.5">
            <CardTitle className="text-lg">{format?.label ?? stage.type}</CardTitle>
            <span className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.16em]">
              Stage {stage.seq + 1}
            </span>
            {format?.description ? (
              <p className="text-muted-foreground mt-1 max-w-sm text-xs leading-snug">
                {format.description}
              </p>
            ) : null}
          </div>
        </div>
        <Badge tone={stage.drawn ? "mint" : "muted"}>{stage.drawn ? "Drawn" : "Not drawn"}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold">{approvedCount}</span>
            <span className="text-muted-foreground">
              approved participant{approvedCount === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canManage && !stage.locked ? (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">Match format</span>
                <Select
                  value={String(stageBestOf ?? "")}
                  onValueChange={(v) => {
                    updateConfig.mutate(
                      { bestOf: Number(v) },
                      {
                        onSuccess: () => toast.success("Match format updated"),
                        onError: (e) => toast.error(errorMessage(e, "Couldn't update format")),
                      },
                    );
                  }}
                >
                  <SelectTrigger className="h-7 w-32 text-xs">
                    <SelectValue placeholder="Default (Bo3)" />
                  </SelectTrigger>
                  <SelectContent>
                    {MATCH_FORMATS.map((f) => (
                      <SelectItem key={f.value} value={String(f.value)} className="text-xs">
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : stageBestOf ? (
              <Badge tone="muted">Best of {stageBestOf}</Badge>
            ) : null}
            {canManage && !stage.locked ? (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">Scoring rules</span>
                <Select
                  value={activeScoringPreset?.id ?? ""}
                  onValueChange={(v) => {
                    const preset = SCORING_RULE_PRESETS.find((p) => p.id === v);
                    if (!preset) return;
                    updateConfig.mutate(
                      {
                        pointsPerSet: preset.pointsPerSet,
                        winBy: preset.winBy,
                        maxPoints: preset.maxPoints,
                      },
                      {
                        onSuccess: () => toast.success("Scoring rules updated"),
                        onError: (e) =>
                          toast.error(errorMessage(e, "Couldn't update scoring rules")),
                      },
                    );
                  }}
                >
                  <SelectTrigger className="h-7 w-44 text-xs">
                    <SelectValue placeholder="Default (to 21)" />
                  </SelectTrigger>
                  <SelectContent>
                    {SCORING_RULE_PRESETS.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : activeScoringPreset ? (
              <Badge tone="muted">To {activeScoringPreset.pointsPerSet}</Badge>
            ) : null}
          </div>
        </div>

        {isFranchise ? (
          <p className="text-muted-foreground text-sm">
            Teams compete in this division, so fixtures are created by the team draw above. These
            settings apply to every match played inside a fixture.
          </p>
        ) : null}

        {isFranchise ? null : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {readiness.reasons.map((reason) => (
              <li key={reason} className="text-pink-dark flex items-start gap-2">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} />
                {reason}
              </li>
            ))}
            {readiness.ready ? (
              <li className="text-mint-dark flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} />
                Ready to generate
              </li>
            ) : null}
            {readiness.warnings.map((warning) => (
              <li key={warning} className="text-muted-foreground flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} />
                {warning}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {canManage && !isFranchise ? (
            <>
              {!stage.drawn ? (
                <Button
                  tone="candy"
                  size="sm"
                  disabled={!readiness.ready}
                  onClick={() => setGenerateOpen(true)}
                >
                  <Shuffle className="h-4 w-4" strokeWidth={2.25} />
                  Generate draw
                </Button>
              ) : stage.locked ? (
                <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                  <Lock className="h-4 w-4" strokeWidth={2.25} />
                  Locked — matches have been scored
                </span>
              ) : (
                <Button tone="paper" size="sm" onClick={() => setClearOpen(true)}>
                  <Trash2 className="h-4 w-4" strokeWidth={2.25} />
                  Clear &amp; regenerate
                </Button>
              )}
            </>
          ) : null}
          {stage.drawn && stage.type === "round_robin" && canManage ? (
            <Button tone="paper" size="sm" onClick={() => setAdvanceOpen(true)}>
              <Trophy className="h-4 w-4" strokeWidth={2.25} />
              Advance to Knockout
            </Button>
          ) : null}
          {stage.drawn && tournamentSlug ? (
            <Button asChild tone="ghost" size="sm">
              <Link href={`/t/${tournamentSlug}/bracket`} target="_blank">
                Preview bracket ↗
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>

      <GenerateDrawDialog
        stageId={stage.id}
        divisionId={divisionId}
        tournamentId={tournamentId}
        format={stage.type}
        readiness={readiness}
        open={generateOpen}
        onOpenChange={setGenerateOpen}
      />
      <ClearDrawDialog
        stageId={stage.id}
        divisionId={divisionId}
        tournamentId={tournamentId}
        open={clearOpen}
        onOpenChange={setClearOpen}
      />
      <AdvanceToKnockoutDialog
        stageId={stage.id}
        divisionId={divisionId}
        tournamentId={tournamentId}
        open={advanceOpen}
        onOpenChange={setAdvanceOpen}
      />
    </Card>
  );
}
