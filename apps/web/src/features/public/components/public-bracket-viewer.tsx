"use client";

import { Network, Share2, Trophy } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { PublicBracketBoard } from "@/features/public/components/public-bracket-board";
import { PublicRoundRobinFixtures } from "@/features/public/components/public-round-robin-fixtures";
import { usePublicTournamentContext } from "@/features/public/components/public-tournament-provider";
import {
  usePublicDivisions,
  usePublicMatches,
  usePublicParticipants,
  usePublicStages,
} from "@/features/public/use-public-tournament";
import { getFormat } from "@/features/tournaments/config";

function WinnerShareDialog({
  open,
  onOpenChange,
  championName,
  divisionName,
  tournamentName,
  slug,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  championName: string;
  divisionName: string;
  tournamentName: string;
  slug: string;
}) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/t/${slug}/bracket`;
  const shareText = `🏆 ${championName} wins ${divisionName} at ${tournamentName}! See the full bracket at ${url}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const nativeShare = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({ title: `${tournamentName} — Results`, text: shareText });
    } catch {
      // user cancelled
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Share result</DialogTitle>
        </DialogHeader>
        <div className="border-ink bg-candy-tint shadow-sticker-candy flex flex-col items-center gap-3 rounded-3xl border-2 p-8 text-center">
          <Trophy className="text-candy-dark h-10 w-10" strokeWidth={2} aria-hidden />
          <p className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.22em]">
            {divisionName} · Champion
          </p>
          <p className="font-serif text-3xl font-bold leading-tight">{championName}</p>
          <p className="text-muted-foreground text-xs">{tournamentName}</p>
          <p className="text-muted-foreground font-mono text-xs">{url}</p>
        </div>
        <div className="flex flex-col gap-2">
          {"share" in navigator ? (
            <Button tone="candy" onClick={() => void nativeShare()} className="w-full">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          ) : null}
          <Button tone="paper" onClick={() => void copyToClipboard()} className="w-full">
            Copy share text
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Picks a stage/division (when there's more than one) and renders the right board
 * for its format — single elimination gets the tree view, everything else gets
 * grouped fixtures. Supports both formats named in the spec from one page. */
export function PublicBracketViewer({ slug }: { slug: string }) {
  const { tournament } = usePublicTournamentContext();
  const divisions = usePublicDivisions(slug);
  const stages = usePublicStages(slug);
  const matches = usePublicMatches(slug);
  const participants = usePublicParticipants(slug);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const divisionsById = useMemo(
    () => new Map((divisions.data ?? []).map((d) => [d.id, d])),
    [divisions.data],
  );
  const participantsById = useMemo(
    () => new Map((participants.data ?? []).map((p) => [p.id, p])),
    [participants.data],
  );
  const drawnStages = (stages.data ?? []).filter((s) => s.drawn);
  const activeStage = drawnStages.find((s) => s.id === selectedStageId) ?? drawnStages[0] ?? null;
  const stageMatches = useMemo(
    () => (matches.data ?? []).filter((m) => m.stageId === activeStage?.id),
    [matches.data, activeStage],
  );

  const loading =
    divisions.isLoading || stages.isLoading || matches.isLoading || participants.isLoading;

  // Detect champion from the final match (single-elim only) — must be before early returns
  const champion = useMemo(() => {
    if (activeStage?.type !== "single_elim") return null;
    const sortedMatches = [...stageMatches].sort((a, b) => (b.roundSeq ?? 0) - (a.roundSeq ?? 0));
    const finalMatch = sortedMatches[0];
    if (!finalMatch) return null;
    if (finalMatch.status !== "completed" && finalMatch.status !== "walkover") return null;
    const winnerSide = finalMatch.sides.find((s) => s.outcome === "win");
    if (!winnerSide) return null;
    return participantsById.get(winnerSide.participantId)?.displayName ?? null;
  }, [activeStage, stageMatches, participantsById]);

  if (loading) {
    return <Skeleton className="h-96 rounded-2xl" />;
  }
  if (matches.isError) {
    return <ErrorState error={matches.error} onRetry={() => matches.refetch()} />;
  }
  if (drawnStages.length === 0) {
    return (
      <EmptyState
        icon={Network}
        title="No bracket yet"
        description="The draw hasn't been published for this tournament yet."
        className="py-16"
      />
    );
  }

  const activeDivisionName = activeStage
    ? (divisionsById.get(activeStage.divisionId)?.name ?? "Division")
    : "Division";

  return (
    <div className="flex flex-col gap-4">
      {champion ? (
        <div className="border-candy bg-candy-tint flex items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <Trophy className="text-candy-dark h-5 w-5 shrink-0" strokeWidth={2.25} />
            <p className="text-sm font-semibold">
              <span className="text-candy-dark">{champion}</span>
              <span className="text-muted-foreground ml-1.5 font-normal">
                wins {activeDivisionName}
              </span>
            </p>
          </div>
          <Button tone="paper" size="sm" onClick={() => setShareOpen(true)}>
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </div>
      ) : null}
      {champion ? (
        <WinnerShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          championName={champion}
          divisionName={activeDivisionName}
          tournamentName={tournament.name}
          slug={slug}
        />
      ) : null}
      {drawnStages.length > 1 ? (
        <Select value={activeStage?.id} onValueChange={setSelectedStageId}>
          <SelectTrigger className="w-64" aria-label="Choose a division">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {drawnStages.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                {divisionsById.get(stage.divisionId)?.name ?? "Division"} ·{" "}
                {getFormat(stage.type)?.label ?? stage.type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {activeStage?.type === "single_elim" ? (
        <PublicBracketBoard
          slug={slug}
          matches={stageMatches}
          participantsById={participantsById}
        />
      ) : (
        <PublicRoundRobinFixtures
          slug={slug}
          matches={stageMatches}
          participantsById={participantsById}
        />
      )}
    </div>
  );
}
