"use client";

import {
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
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
import { useTournament } from "@/features/tournaments/use-tournaments";
import { GoLiveDialog } from "@/features/tournaments/dashboard/components/go-live-dialog";
import {
  STEP_META,
  type TournamentStep,
  type StepSignals,
} from "@/features/tournaments/dashboard/config";
import type { TournamentReadinessView } from "@tournament/api-client";
import {
  useDivisions,
  usePublishTournament,
  useTransitionStatus,
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

// ─── Shared: Registration link box ───────────────────────────────────────────

function RegistrationLinkBox({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/t/${slug}/register`;

  function copyLink() {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="bg-background rounded-lg border p-3">
      <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
        Registration link
      </p>
      <div className="flex items-center gap-2">
        <code className="text-foreground bg-muted min-w-0 flex-1 truncate rounded px-2 py-1.5 text-xs">
          {url}
        </code>
        <Button tone="paper" size="sm" className="shrink-0" onClick={copyLink}>
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-600" strokeWidth={2.5} />
          ) : (
            <Copy className="h-3.5 w-3.5" strokeWidth={2.25} />
          )}
          {copied ? "Copied!" : "Copy"}
        </Button>
        <Button asChild tone="paper" size="sm" className="shrink-0">
          <Link href={`/t/${slug}/register`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} />
            Open
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ─── Step 1: Tournament Setup ─────────────────────────────────────────────────

function Step1Hero({ tournamentId }: { tournamentId: string }) {
  const transition = useTransitionStatus(tournamentId);
  const { data: tournament } = useTournament(tournamentId);
  const { data: divisions } = useDivisions(tournamentId);
  const hasDivisions = (divisions?.length ?? 0) > 0;
  const [justOpened, setJustOpened] = useState(false);

  if (justOpened && tournament?.slug) {
    return (
      <HeroShell step={1} title={STEP_META[1].label}>
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <CheckCircle2 className="text-good h-4 w-4 shrink-0" strokeWidth={2.25} />
            Registration is now open — share the link with your players.
          </p>
          <RegistrationLinkBox slug={tournament.slug} />
        </div>
      </HeroShell>
    );
  }

  return (
    <HeroShell step={1} title={STEP_META[1].label}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          Your tournament is in Draft — players can&apos;t register yet. Add your details, then open
          registration to accept entries.
        </p>
        {hasDivisions ? (
          <Button
            tone="candy"
            size="sm"
            className="shrink-0"
            disabled={transition.isPending}
            onClick={() =>
              transition.mutate(
                { status: "registration" },
                {
                  onSuccess: () => {
                    toast.success("Registration is now open");
                    setJustOpened(true);
                  },
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
        ) : (
          <Button asChild tone="paper" size="sm" className="shrink-0">
            <Link href={`/console/tournaments/${tournamentId}/setup`}>Add a division first →</Link>
          </Button>
        )}
      </div>
    </HeroShell>
  );
}

// ─── Step 2: Player Registration ──────────────────────────────────────────────

function Step2Hero({ tournamentId }: { tournamentId: string }) {
  const { data: tournament } = useTournament(tournamentId);
  return (
    <HeroShell step={2} title={STEP_META[2].label}>
      <div className="flex flex-col gap-3">
        {tournament?.slug ? <RegistrationLinkBox slug={tournament.slug} /> : null}
        <div className="flex gap-2">
          <Button asChild tone="paper" size="sm">
            <Link href={`/console/tournaments/${tournamentId}/players`}>
              <UserRound className="h-4 w-4" strokeWidth={2.25} />
              Manage participants
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
            ? "Players are imported. Assign them to teams on the Setup tab, or run the draft ceremony."
            : "Divide approved players into teams. Use auto-distribute or assign manually on Setup."}
        </p>
        <div className="flex flex-wrap gap-2">
          {signals.franchiseMode ? (
            <Button asChild tone="candy" size="sm">
              <Link href={`/console/tournaments/${tournamentId}/draft-ceremony`}>
                <GitMerge className="h-4 w-4" strokeWidth={2.25} />
                Run draft ceremony
              </Link>
            </Button>
          ) : null}
          <Button asChild tone={signals.franchiseMode ? "paper" : "candy"} size="sm">
            <Link href={`/console/tournaments/${tournamentId}/teams`}>
              <Users className="h-4 w-4" strokeWidth={2.25} />
              Teams
            </Link>
          </Button>
          {signals.franchiseMode ? (
            <Button asChild tone="paper" size="sm">
              <Link href={`/console/tournaments/${tournamentId}/setup`}>Pairing settings →</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </HeroShell>
  );
}

// ─── Step 4: Pair Each Team ───────────────────────────────────────────────────

function Step4Hero({
  tournamentId,
  signals,
  readiness,
}: {
  tournamentId: string;
  signals: StepSignals;
  readiness: TournamentReadinessView | undefined;
}) {
  const { data: divisions = [] } = useDivisions(tournamentId);

  const pairedByDivisionId = new Map(
    (readiness?.divisions ?? []).map((d) => [d.divisionId, d.unpairedEntrants === 0]),
  );

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
            divisions.map((d) => {
              const done = pairedByDivisionId.get(d.id) ?? false;
              return (
                <Button key={d.id} asChild tone={done ? "paper" : "candy"} size="sm">
                  <Link href={`/console/tournaments/${tournamentId}/divisions/${d.id}/pairing`}>
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" strokeWidth={2.25} />
                    ) : (
                      <Circle className="h-4 w-4" strokeWidth={2.25} />
                    )}
                    {d.name}
                  </Link>
                </Button>
              );
            })
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
          <Link href={`/console/tournaments/${tournamentId}/players`}>
            <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />
            Open check-in
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
            ? "All pairs are locked. Generate brackets to schedule which teams face each other."
            : "Generate round-robin or knockout brackets for each event."}
        </p>
        <Button asChild tone="candy" size="sm">
          <Link href={`/console/tournaments/${tournamentId}/draws`}>
            <Shuffle className="h-4 w-4" strokeWidth={2.25} />
            Build brackets
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
              View matches
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
              Share results
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
  readiness,
  canManage,
  resultsPublishedAt,
}: {
  tournamentId: string;
  step: TournamentStep;
  signals: StepSignals;
  readiness: TournamentReadinessView | undefined;
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
      return <Step4Hero tournamentId={tournamentId} signals={signals} readiness={readiness} />;
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
