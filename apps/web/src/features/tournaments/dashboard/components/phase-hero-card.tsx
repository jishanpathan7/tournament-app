"use client";

import {
  CalendarClock,
  CheckCircle2,
  GitMerge,
  LayoutGrid,
  Radio,
  Send,
  Shuffle,
  Users,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { Spinner } from "@/components/ui/spinner";
import { GoLiveDialog } from "@/features/tournaments/dashboard/components/go-live-dialog";
import {
  STEP_META,
  type TournamentStep,
  type StepSignals,
} from "@/features/tournaments/dashboard/config";
import {
  useDivisions,
  usePublishTournament,
  useTransitionStatus,
  useTournament,
  useUpdateTournament,
} from "@/features/tournaments/use-tournaments";
import { errorMessage } from "@/lib/problem";

function HeroShell({
  step,
  title,
  children,
}: {
  step: TournamentStep;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-candy/30 bg-candy-tint/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="bg-candy flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs font-bold text-white">
            {step}
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ─── Step 1: Tournament Setup ─────────────────────────────────────────────────

function Step1Hero({ tournamentId }: { tournamentId: string }) {
  const transition = useTransitionStatus(tournamentId);
  return (
    <HeroShell step={1} title={STEP_META[1].label}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          Your tournament is in Draft — players can&apos;t register yet. Configure your details,
          then open registration to accept entries.
        </p>
        <Button
          tone="candy"
          size="sm"
          className="shrink-0"
          disabled={transition.isPending}
          onClick={() =>
            transition.mutate(
              { status: "registration" },
              {
                onSuccess: () => toast.success("Registration is now open"),
                onError: (e) => toast.error(errorMessage(e, "Couldn't open registration")),
              },
            )
          }
        >
          {transition.isPending ? (
            <Spinner className="text-white" />
          ) : (
            <Send className="h-4 w-4" strokeWidth={2.25} />
          )}
          Open registration
        </Button>
      </div>
    </HeroShell>
  );
}

// ─── Step 2: Player Registration ──────────────────────────────────────────────

function Step2Hero({ tournamentId }: { tournamentId: string }) {
  return (
    <HeroShell step={2} title={STEP_META[2].label}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          Import participants and approve them to build your roster.
        </p>
        <div className="flex gap-2">
          <Button asChild tone="paper" size="sm">
            <Link href={`/console/tournaments/${tournamentId}/players`}>
              <UserRound className="h-4 w-4" strokeWidth={2.25} />
              Manage players
            </Link>
          </Button>
        </div>
      </div>
    </HeroShell>
  );
}

// ─── Step 3: Create Teams ─────────────────────────────────────────────────────

function Step3Hero({ tournamentId, signals }: { tournamentId: string; signals: StepSignals }) {
  return (
    <HeroShell step={3} title={STEP_META[3].label}>
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">
          {signals.franchiseMode
            ? "Players are imported. Run the Draft Ceremony to assign them to teams, or go to the Team board to assign manually."
            : "Divide approved players into teams. Use auto-distribute or assign manually."}
        </p>
        <div className="flex flex-wrap gap-2">
          {signals.franchiseMode ? (
            <Button asChild tone="candy" size="sm">
              <Link href={`/console/tournaments/${tournamentId}/draft-ceremony`}>
                <GitMerge className="h-4 w-4" strokeWidth={2.25} />
                Run Draft Ceremony
              </Link>
            </Button>
          ) : null}
          <Button asChild tone={signals.franchiseMode ? "paper" : "candy"} size="sm">
            <Link href={`/console/tournaments/${tournamentId}/teams`}>
              <Users className="h-4 w-4" strokeWidth={2.25} />
              Team board
            </Link>
          </Button>
        </div>
      </div>
    </HeroShell>
  );
}

// ─── Step 4: Pair Each Team ───────────────────────────────────────────────────

function Step4Hero({ tournamentId, signals }: { tournamentId: string; signals: StepSignals }) {
  const { data: divisions = [] } = useDivisions(tournamentId);
  return (
    <HeroShell step={4} title={STEP_META[4].label}>
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">
          {signals.franchiseMode
            ? 'Open each team and use "Pair this team" to generate balanced doubles pairs within the squad.'
            : "Generate balanced doubles pairs within each team for each division."}
        </p>
        <div className="flex flex-wrap gap-2">
          {signals.franchiseMode ? (
            <Button asChild tone="candy" size="sm">
              <Link href={`/console/tournaments/${tournamentId}/teams`}>
                <GitMerge className="h-4 w-4" strokeWidth={2.25} />
                Generate Doubles Pairs
              </Link>
            </Button>
          ) : (
            divisions.map((d) => (
              <Button key={d.id} asChild tone="candy" size="sm">
                <Link href={`/console/tournaments/${tournamentId}/divisions/${d.id}/pairing`}>
                  <GitMerge className="h-4 w-4" strokeWidth={2.25} />
                  {d.name}
                </Link>
              </Button>
            ))
          )}
        </div>
      </div>
    </HeroShell>
  );
}

// ─── Step 5: Check-in & Readiness ────────────────────────────────────────────

function Step5Hero({ tournamentId }: { tournamentId: string }) {
  return (
    <HeroShell step={5} title={STEP_META[5].label}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          Mark attendance and confirm everyone is ready before generating the draw.
        </p>
        <Button asChild tone="candy" size="sm">
          <Link href={`/console/tournaments/${tournamentId}/readiness`}>
            <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />
            Manage check-in
          </Link>
        </Button>
      </div>
    </HeroShell>
  );
}

// ─── Step 6: Generate Draw ────────────────────────────────────────────────────

function Step6Hero({ tournamentId, signals }: { tournamentId: string; signals: StepSignals }) {
  return (
    <HeroShell step={6} title={STEP_META[6].label}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          {signals.franchiseMode
            ? "All pairs are published. Generate the team draw to schedule which squads face each other."
            : "Generate the bracket or round-robin draw for each division."}
        </p>
        <Button asChild tone="candy" size="sm">
          <Link href={`/console/tournaments/${tournamentId}/draws`}>
            <Shuffle className="h-4 w-4" strokeWidth={2.25} />
            {signals.franchiseMode ? "Generate Matches" : "Generate draws"}
          </Link>
        </Button>
      </div>
    </HeroShell>
  );
}

// ─── Step 7: Court Scheduling ─────────────────────────────────────────────────

function Step7Hero({ tournamentId, signals }: { tournamentId: string; signals: StepSignals }) {
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const { data: tournament } = useTournament(tournamentId);
  const update = useUpdateTournament(tournamentId);
  const autoSchedule = !!(tournament?.settings as Record<string, unknown> | undefined)?.[
    "auto_schedule"
  ];

  function toggleAutoSchedule(checked: boolean | "indeterminate") {
    if (checked === "indeterminate") return;
    update.mutate(
      { autoSchedule: checked },
      {
        onSuccess: () =>
          toast.success(checked ? "Auto-schedule enabled" : "Auto-schedule disabled"),
        onError: (e) => toast.error(errorMessage(e, "Couldn't update setting")),
      },
    );
  }

  return (
    <>
      <HeroShell step={7} title={STEP_META[7].label}>
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            Configure courts and assign matches. When ready, go live to start the tournament.
          </p>
          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <Checkbox
              id="auto-schedule-toggle"
              checked={autoSchedule}
              onCheckedChange={toggleAutoSchedule}
              disabled={update.isPending}
            />
            <Label htmlFor="auto-schedule-toggle" className="cursor-pointer text-sm">
              Auto-schedule — assign next match when a court frees up
            </Label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild tone="paper" size="sm">
              <Link href={`/console/tournaments/${tournamentId}/courts`}>
                <LayoutGrid className="h-4 w-4" strokeWidth={2.25} />
                Courts
              </Link>
            </Button>
            <Button asChild tone="paper" size="sm">
              <Link href={`/console/tournaments/${tournamentId}/schedule`}>
                <CalendarClock className="h-4 w-4" strokeWidth={2.25} />
                Schedule
              </Link>
            </Button>
            <Button tone="candy" size="sm" onClick={() => setGoLiveOpen(true)}>
              <Radio className="h-4 w-4" strokeWidth={2.25} />
              Go live
            </Button>
          </div>
        </div>
      </HeroShell>
      <GoLiveDialog
        tournamentId={tournamentId}
        open={goLiveOpen}
        onOpenChange={setGoLiveOpen}
        signals={signals}
      />
    </>
  );
}

// ─── Step 8: Live ─────────────────────────────────────────────────────────────

function Step8Hero({ tournamentId }: { tournamentId: string }) {
  const transition = useTransitionStatus(tournamentId);
  return (
    <HeroShell step={8} title={STEP_META[8].label}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          Tournament is live. Monitor courts, score matches, and track standings.
        </p>
        <Button
          tone="paper"
          size="sm"
          disabled={transition.isPending}
          onClick={() =>
            transition.mutate(
              { status: "completed" },
              {
                onSuccess: () => toast.success("Tournament marked as completed"),
                onError: (e) => toast.error(errorMessage(e, "Couldn't complete tournament")),
              },
            )
          }
        >
          {transition.isPending ? (
            <Spinner />
          ) : (
            <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />
          )}
          End tournament
        </Button>
      </div>
    </HeroShell>
  );
}

// ─── Step 9: Results ─────────────────────────────────────────────────────────

function Step9Hero({
  tournamentId,
  resultsPublishedAt,
}: {
  tournamentId: string;
  resultsPublishedAt: string | null;
}) {
  const transition = useTransitionStatus(tournamentId);
  const publish = usePublishTournament(tournamentId);
  const published = !!resultsPublishedAt;

  return (
    <HeroShell step={9} title={STEP_META[9].label}>
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">
          {published
            ? "Results are published and visible on the public tournament page."
            : "Review match results, then publish standings to the public tournament page."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild tone="paper" size="sm">
            <Link href={`/console/tournaments/${tournamentId}/matches`}>
              <GitMerge className="h-4 w-4" strokeWidth={2.25} />
              Match results
            </Link>
          </Button>
          {!published ? (
            <Button
              tone="candy"
              size="sm"
              disabled={publish.isPending}
              onClick={() =>
                publish.mutate(
                  { artifacts: ["results"] },
                  {
                    onSuccess: () => toast.success("Results published to public page"),
                    onError: (e) => toast.error(errorMessage(e, "Couldn't publish results")),
                  },
                )
              }
            >
              {publish.isPending ? (
                <Spinner className="text-white" />
              ) : (
                <Send className="h-4 w-4" strokeWidth={2.25} />
              )}
              Publish results
            </Button>
          ) : (
            <Button
              tone="paper"
              size="sm"
              disabled={transition.isPending}
              onClick={() =>
                transition.mutate(
                  { status: "archived" },
                  {
                    onSuccess: () => toast.success("Tournament archived"),
                    onError: (e) => toast.error(errorMessage(e, "Couldn't archive tournament")),
                  },
                )
              }
            >
              Archive
            </Button>
          )}
        </div>
      </div>
    </HeroShell>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function PhaseHeroCard({
  tournamentId,
  step,
  signals,
  canManage,
  resultsPublishedAt,
}: {
  tournamentId: string;
  step: TournamentStep;
  signals: StepSignals;
  canManage: boolean;
  resultsPublishedAt: string | null;
}) {
  if (!canManage) return null;

  switch (step) {
    case 1:
      return <Step1Hero tournamentId={tournamentId} />;
    case 2:
      return <Step2Hero tournamentId={tournamentId} />;
    case 3:
      return <Step3Hero tournamentId={tournamentId} signals={signals} />;
    case 4:
      return <Step4Hero tournamentId={tournamentId} signals={signals} />;
    case 5:
      return <Step5Hero tournamentId={tournamentId} />;
    case 6:
      return <Step6Hero tournamentId={tournamentId} signals={signals} />;
    case 7:
      return <Step7Hero tournamentId={tournamentId} signals={signals} />;
    case 8:
      return <Step8Hero tournamentId={tournamentId} />;
    case 9:
      return <Step9Hero tournamentId={tournamentId} resultsPublishedAt={resultsPublishedAt} />;
    case 10:
      return null;
  }
}
