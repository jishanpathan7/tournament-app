"use client";

import type { ScheduleQueueView, StageResponse } from "@tournament/api-client";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  LayoutGrid,
  Medal,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFranchiseStandings } from "@/features/franchise-ties/use-franchise-ties";
import { usePublicPlayerStats } from "@/features/public/use-public-tournament";
import { deriveMatchProgress, type DashboardAlert } from "@/features/tournaments/dashboard/config";
import { useTournament } from "@/features/tournaments/use-tournaments";
import type { useTournamentDashboard } from "@/features/tournaments/dashboard/use-tournament-dashboard";

type DashboardData = ReturnType<typeof useTournamentDashboard>;

// ─── Stat tile ───────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  tone?: "mint" | "candy" | "pink" | "yellow" | "muted";
}) {
  const toneClass =
    tone === "mint"
      ? "text-mint-dark"
      : tone === "candy"
        ? "text-candy-dark"
        : tone === "pink"
          ? "text-pink-dark"
          : tone === "yellow"
            ? "text-yellow-600"
            : "text-muted-foreground";

  return (
    <div className="border-border bg-card flex flex-col gap-1 rounded-xl border p-4">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${toneClass}`} strokeWidth={2.25} />
        <span className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.16em]">
          {label}
        </span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      {sub ? <p className="text-muted-foreground text-xs">{sub}</p> : null}
    </div>
  );
}

// ─── Current match card ───────────────────────────────────────────────────────

function CurrentMatchCard({
  tournamentId,
  queue,
  participantsById,
}: {
  tournamentId: string;
  queue: ScheduleQueueView | undefined;
  participantsById: DashboardData["participantsById"];
}) {
  const activeCourts = (queue?.courts ?? []).filter((c) => c.currentMatch !== null);

  function sideNames(match: NonNullable<(typeof activeCourts)[number]["currentMatch"]>) {
    const a = match.sides[0];
    const b = match.sides[1];
    const nameA = (a ? participantsById.get(a.participantId)?.displayName : null) ?? "TBD";
    const nameB = (b ? participantsById.get(b.participantId)?.displayName : null) ?? "TBD";
    return `${nameA} vs ${nameB}`;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Swords className="h-4 w-4" strokeWidth={2.25} />
          Live now
        </CardTitle>
        <Link
          href={`/console/tournaments/${tournamentId}/live`}
          className="text-candy-dark text-xs font-semibold"
        >
          Full view →
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {activeCourts.length === 0 ? (
          <p className="text-muted-foreground text-sm">No matches in progress</p>
        ) : (
          activeCourts.slice(0, 3).map((c) => (
            <div
              key={c.court.id}
              className="border-border flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <span className="text-muted-foreground shrink-0 font-mono text-xs">
                {c.court.name}
              </span>
              <span className="truncate font-semibold">
                {c.currentMatch ? sideNames(c.currentMatch) : "—"}
              </span>
              {c.isDelayed ? (
                <Badge tone="pink" className="text-2xs shrink-0">
                  Delayed
                </Badge>
              ) : (
                <Badge tone="mint" className="text-2xs shrink-0">
                  Live
                </Badge>
              )}
            </div>
          ))
        )}
        {activeCourts.length > 3 ? (
          <p className="text-muted-foreground text-xs">
            +{activeCourts.length - 3} more courts active
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ─── Bracket progress ─────────────────────────────────────────────────────────

function BracketProgressCard({
  tournamentId,
  matches,
  stages,
}: {
  tournamentId: string;
  matches: DashboardData["matches"]["data"];
  stages: StageResponse[];
}) {
  const progress = deriveMatchProgress(matches ?? []);
  const koStage = stages.find((s) => s.type === "single_elimination");
  const rrStage = stages.find((s) => s.type === "round_robin");
  const activeStage = koStage ?? rrStage;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4" strokeWidth={2.25} />
          Bracket
        </CardTitle>
        {activeStage ? (
          <Link
            href={`/console/tournaments/${tournamentId}/draws`}
            className="text-candy-dark text-xs font-semibold"
          >
            Brackets →
          </Link>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {activeStage ? (
          <Badge tone={koStage ? "candy" : "mint"} className="w-fit">
            {koStage ? "Knockout" : "Round Robin"}
          </Badge>
        ) : null}
        <div>
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="text-muted-foreground">Matches complete</span>
            <span className="font-mono tabular-nums">
              {progress.terminal}/{progress.total}
            </span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="bg-mint h-full rounded-full transition-all"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <p className="text-muted-foreground mt-1 text-right text-xs">{progress.pct}% done</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Alerts card ──────────────────────────────────────────────────────────────

function AlertsCard({ alerts }: { alerts: DashboardAlert[] }) {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-green-600" strokeWidth={2.25} />
            Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">All clear</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-yellow-500" strokeWidth={2.25} />
          Alerts
          <Badge tone="pink">{alerts.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {alerts.map((a) => (
          <div key={a.id} className="flex items-start gap-2 text-sm">
            <AlertTriangle
              className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                a.tone === "error"
                  ? "text-pink-dark"
                  : a.tone === "warning"
                    ? "text-yellow-500"
                    : "text-muted-foreground"
              }`}
              strokeWidth={2.25}
            />
            {a.href ? (
              <Link href={a.href} className="hover:underline">
                {a.message}
              </Link>
            ) : (
              <span>{a.message}</span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Top team & player ────────────────────────────────────────────────────────

function TopTeamCard({ stages }: { stages: StageResponse[] }) {
  const rrStage = stages.find((s) => s.type === "round_robin");
  const { data, isLoading } = useFranchiseStandings(rrStage?.id);

  if (!rrStage) return null;
  if (isLoading) return <Skeleton className="h-28 rounded-xl" />;
  const top = data?.rows[0];
  if (!top) return null;

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-3">
          <div className="bg-candy/10 flex h-10 w-10 items-center justify-center rounded-full">
            <Trophy className="text-candy-dark h-5 w-5" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.14em]">
              Top Team
            </p>
            <p className="text-lg font-bold">{top.squadName}</p>
            <p className="text-muted-foreground text-xs">
              {top.points} pts · {top.won}W {top.drawn}D {top.lost}L
            </p>
          </div>
          <Medal className="ml-auto h-6 w-6 text-yellow-500" />
        </div>
      </CardContent>
    </Card>
  );
}

function TopPlayerCard({ tournamentId }: { tournamentId: string }) {
  const { data: tournament } = useTournament(tournamentId);
  const slug = tournament?.slug;
  const { data, isLoading } = usePublicPlayerStats(slug ?? "");

  if (!slug) return null;
  if (isLoading) return <Skeleton className="h-28 rounded-xl" />;
  const top = data?.rows[0];
  if (!top) return null;

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-3">
          <div className="bg-mint/10 flex h-10 w-10 items-center justify-center rounded-full">
            <Users className="text-mint-dark h-5 w-5" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.14em]">
              Top Player
            </p>
            <p className="text-lg font-bold">{top.displayName}</p>
            <p className="text-muted-foreground text-xs">
              {(top.winRate * 100).toFixed(0)}% win rate · {top.won}W {top.lost}L
              {top.squadName ? ` · ${top.squadName}` : ""}
            </p>
          </div>
          <Medal className="ml-auto h-6 w-6 text-slate-400" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Activity feed ────────────────────────────────────────────────────────────

function ActivityFeed({ activity }: { activity: DashboardData["activity"] }) {
  const events = activity.data ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" strokeWidth={2.25} />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-sm">No recent activity</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.slice(0, 8).map((e) => (
              <li key={e.id} className="flex items-start gap-2 text-sm">
                <span className="bg-muted mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
                <span className="capitalize">
                  {e.action.replace(/_/g, " ")} {e.entity.replace(/_/g, " ")}
                </span>
                <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                  {new Date(e.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function OpsCommandCenter({
  tournamentId,
  data,
}: {
  tournamentId: string;
  data: DashboardData;
}) {
  const { tournament, matches, queue, stages, alerts, activity, readiness, registrationTotals } =
    data;

  const t = tournament.data;
  const q = queue.data;
  const stagesArr = stages.data ?? [];

  const activeCourts = (q?.courts ?? []).filter((c) => c.currentMatch !== null).length;
  const freeCourts = (q?.courts ?? []).filter((c) => c.currentMatch === null).length;
  const totalCourts = (q?.courts ?? []).length;

  const approved = registrationTotals?.approved ?? 0;
  const checkedIn = readiness.data?.totalCheckedIn ?? 0;

  const statusLabel = t?.status?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? "—";

  return (
    <div className="flex flex-col gap-6">
      {/* Stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Status"
          value={statusLabel}
          icon={CheckCircle2}
          tone={t?.status === "live" ? "mint" : "muted"}
        />
        <StatTile
          label="Participants"
          value={approved}
          sub={`${registrationTotals?.pending ?? 0} pending`}
          icon={Users}
          tone="candy"
        />
        <StatTile
          label="Checked In"
          value={checkedIn}
          sub={approved > 0 ? `${Math.round((checkedIn / approved) * 100)}% of approved` : ""}
          icon={CheckCircle2}
          tone="mint"
        />
        <StatTile
          label="Courts"
          value={totalCourts > 0 ? `${activeCourts} active` : "—"}
          sub={totalCourts > 0 ? `${freeCourts} free` : "No courts configured"}
          icon={LayoutGrid}
          tone={activeCourts > 0 ? "yellow" : "muted"}
        />
      </div>

      {/* Mid grid: live matches, bracket, alerts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <CurrentMatchCard
          tournamentId={tournamentId}
          queue={q}
          participantsById={data.participantsById}
        />
        <BracketProgressCard
          tournamentId={tournamentId}
          matches={matches.data}
          stages={stagesArr}
        />
        <AlertsCard alerts={alerts} />
      </div>

      {/* Bottom: top team, top player, activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <TopTeamCard stages={stagesArr} />
        <TopPlayerCard tournamentId={tournamentId} />
        <ActivityFeed activity={activity} />
      </div>
    </div>
  );
}
