"use client";

import type { StageResponse } from "@tournament/api-client";
import { AlertTriangle, CheckCircle2, Lock, Shuffle, Trash2, XCircle } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClearDrawDialog } from "@/features/draws/components/clear-draw-dialog";
import { evaluateDrawReadiness } from "@/features/draws/config";
import { GenerateDrawDialog } from "@/features/draws/components/generate-draw-dialog";
import { getFormat } from "@/features/tournaments/config";

/** Draw Setup: format + participant-count preview, a readiness checklist, warnings to
 * review before committing, and the generate/regenerate actions. All the actual decisions
 * (can this be drawn? can this be cleared?) are re-validated server-side — this only
 * previews them so the organizer isn't surprised by a 409/422. */
export function DrawSetupPanel({
  stage,
  divisionId,
  approvedCount,
  canManage,
}: {
  stage: StageResponse;
  divisionId: string;
  approvedCount: number;
  canManage: boolean;
}) {
  const [generateOpen, setGenerateOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

  const format = getFormat(stage.type);
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
          <div className="flex flex-col">
            <CardTitle className="text-lg">{format?.label ?? stage.type}</CardTitle>
            <span className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.16em]">
              Stage {stage.seq + 1}
            </span>
          </div>
        </div>
        <Badge tone={stage.drawn ? "mint" : "muted"}>{stage.drawn ? "Drawn" : "Not drawn"}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold">{approvedCount}</span>
          <span className="text-muted-foreground">
            approved participant{approvedCount === 1 ? "" : "s"}
          </span>
        </div>

        <ul className="flex flex-col gap-1.5 text-sm">
          {readiness.reasons.map((reason) => (
            <li key={reason} className="flex items-start gap-2 text-pink-dark">
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

        {canManage ? (
          <div className="flex items-center gap-2">
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
          </div>
        ) : null}
      </CardContent>

      <GenerateDrawDialog
        stageId={stage.id}
        divisionId={divisionId}
        format={stage.type}
        readiness={readiness}
        open={generateOpen}
        onOpenChange={setGenerateOpen}
      />
      <ClearDrawDialog
        stageId={stage.id}
        divisionId={divisionId}
        open={clearOpen}
        onOpenChange={setClearOpen}
      />
    </Card>
  );
}
