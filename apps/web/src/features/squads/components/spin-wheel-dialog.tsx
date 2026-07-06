"use client";

import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SquadView, UnassignedRegistrationView } from "@/features/squads/types";

// ── Wheel colours (cycling) ───────────────────────────────────────────────────

const SEGMENT_COLORS = [
  "#f87171", // red-400
  "#fb923c", // orange-400
  "#facc15", // yellow-400
  "#4ade80", // green-400
  "#38bdf8", // sky-400
  "#818cf8", // indigo-400
  "#e879f9", // fuchsia-400
  "#f472b6", // pink-400
  "#2dd4bf", // teal-400
  "#a3e635", // lime-400
  "#c084fc", // purple-400
  "#fdba74", // orange-300
];

// ── SVG helpers ───────────────────────────────────────────────────────────────

const CX = 160;
const CY = 160;
const R = 148;
const INNER_R = 28;

function polarToXY(angleDeg: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function segmentPath(startDeg: number, endDeg: number): string {
  const s = polarToXY(startDeg, R);
  const e = polarToXY(endDeg, R);
  const si = polarToXY(startDeg, INNER_R);
  const ei = polarToXY(endDeg, INNER_R);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${si.x} ${si.y}`,
    `L ${s.x} ${s.y}`,
    `A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y}`,
    `L ${ei.x} ${ei.y}`,
    `A ${INNER_R} ${INNER_R} 0 ${large} 0 ${si.x} ${si.y}`,
    "Z",
  ].join(" ");
}

// ── Skill level grouping ──────────────────────────────────────────────────────

const SKILL_ORDER = ["advanced", "intermediate", "beginner", null] as const;

function skillLabel(s: string | null): string {
  if (!s) return "No level";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function uniqueSkills(entries: UnassignedRegistrationView[]): (string | null)[] {
  const seen = new Set<string>();
  const out: (string | null)[] = [];
  for (const e of entries) {
    const k = e.skillLevel ?? "__null__";
    if (!seen.has(k)) {
      seen.add(k);
      out.push(e.skillLevel);
    }
  }
  return SKILL_ORDER.filter((s) => out.includes(s));
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unassigned: UnassignedRegistrationView[];
  squads: SquadView[];
  onAssign: (registrationId: string, squadId: string) => void;
  assigning: boolean;
}

export function SpinWheelDialog({
  open,
  onOpenChange,
  unassigned,
  squads,
  onAssign,
  assigning,
}: Props) {
  const skills = uniqueSkills(unassigned);
  const [filter, setFilter] = useState<string | null>(skills[0] ?? null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [landedIndex, setLandedIndex] = useState<number | null>(null);
  const rotationRef = useRef(rotation);
  rotationRef.current = rotation;

  // Reset dismissed + filter when dialog opens/closes
  useEffect(() => {
    if (open) {
      setDismissed(new Set());
      setFilter(skills[0] ?? null);
      setLandedIndex(null);
      setRotation(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pool = unassigned.filter(
    (u) => !dismissed.has(u.registrationId) && u.skillLevel === filter,
  );

  const n = pool.length;
  const segAngle = n > 0 ? 360 / n : 360;

  function spin() {
    if (spinning || n === 0) return;
    const targetIdx = Math.floor(Math.random() * n);
    // Angle so that the middle of target segment faces the top pointer (0°)
    const targetMidAngle = targetIdx * segAngle + segAngle / 2;
    // We need (rotation + targetMidAngle) % 360 === 0 → final = 360 - targetMidAngle + k*360
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const finalRotation =
      Math.ceil(rotationRef.current / 360) * 360 +
      extraSpins * 360 +
      (360 - (targetMidAngle % 360));
    setLandedIndex(null);
    setSpinning(true);
    setRotation(finalRotation);
    setTimeout(() => {
      setSpinning(false);
      setLandedIndex(targetIdx);
    }, 4000);
  }

  function handleAssign(squadId: string) {
    if (landedIndex === null) return;
    const player = pool[landedIndex];
    if (!player) return;
    onAssign(player.registrationId, squadId);
    setDismissed((prev) => new Set([...prev, player.registrationId]));
    setLandedIndex(null);
  }

  const landedPlayer = landedIndex !== null ? pool[landedIndex] : null;
  const remaining = unassigned.filter(
    (u) => !dismissed.has(u.registrationId) && u.skillLevel === filter,
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-lg">Spin to assign</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-6">
          {/* Skill filter tabs */}
          {skills.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => {
                const count = unassigned.filter(
                  (u) => u.skillLevel === s && !dismissed.has(u.registrationId),
                ).length;
                return (
                  <button
                    key={s ?? "__null__"}
                    onClick={() => {
                      setFilter(s);
                      setLandedIndex(null);
                    }}
                    className={[
                      "rounded-full px-3 py-1 text-xs font-semibold border transition-colors",
                      filter === s
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-muted-foreground border-border hover:border-foreground/40",
                    ].join(" ")}
                  >
                    {skillLabel(s)} <span className="opacity-60">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex gap-6 items-start">
            {/* Wheel */}
            <div className="relative shrink-0">
              {/* Pointer */}
              <div
                className="absolute left-1/2 -translate-x-1/2 top-0 z-10"
                style={{ width: 0, height: 0, borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: "22px solid hsl(var(--foreground))" }}
              />

              <svg
                width={CX * 2}
                height={CY * 2}
                viewBox={`0 0 ${CX * 2} ${CY * 2}`}
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning ? "transform 4s cubic-bezier(0.17,0.67,0.12,0.99)" : "none",
                  willChange: "transform",
                }}
              >
                {n === 0 ? (
                  <circle cx={CX} cy={CY} r={R} fill="hsl(var(--muted))" />
                ) : (
                  pool.map((player, i) => {
                    const start = i * segAngle;
                    const end = start + segAngle;
                    const mid = start + segAngle / 2;
                    const textPos = polarToXY(mid, (R + INNER_R) / 2);
                    const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length]!;
                    const isLanded = landedIndex === i;
                    return (
                      <g key={player.registrationId}>
                        <path
                          d={segmentPath(start, end)}
                          fill={color}
                          stroke="white"
                          strokeWidth={2}
                          opacity={isLanded ? 1 : 0.85}
                        />
                        <text
                          x={textPos.x}
                          y={textPos.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          transform={`rotate(${mid}, ${textPos.x}, ${textPos.y})`}
                          fontSize={n > 16 ? 7 : n > 10 ? 8.5 : 10}
                          fontWeight="600"
                          fill="white"
                          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
                        >
                          {player.displayName.length > 12
                            ? player.displayName.slice(0, 11) + "…"
                            : player.displayName}
                        </text>
                      </g>
                    );
                  })
                )}
                {/* Centre hub */}
                <circle cx={CX} cy={CY} r={INNER_R} fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth={2} />
              </svg>
            </div>

            {/* Right panel */}
            <div className="flex flex-1 flex-col gap-4 min-w-0">
              {n === 0 ? (
                <p className="text-muted-foreground text-sm">
                  All {skillLabel(filter)} players assigned.
                </p>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {remaining} player{remaining !== 1 ? "s" : ""} remaining
                    </p>
                    <Button
                      tone="candy"
                      size="sm"
                      onClick={spin}
                      disabled={spinning || n === 0}
                      className="w-full"
                    >
                      {spinning ? "Spinning…" : landedPlayer ? "Spin again" : "Spin!"}
                    </Button>
                  </div>

                  {landedPlayer && (
                    <div className="rounded-xl border-2 border-candy/40 bg-candy-tint/20 p-4">
                      <p className="text-xs text-muted-foreground mb-1 font-mono uppercase tracking-wider">Landed on</p>
                      <p className="font-bold text-lg leading-tight">{landedPlayer.displayName}</p>
                      {landedPlayer.skillLevel && (
                        <Badge tone="yellow" className="mt-1 text-xs">{skillLabel(landedPlayer.skillLevel)}</Badge>
                      )}
                      <div className="mt-3 flex flex-col gap-2">
                        <p className="text-xs text-muted-foreground">Assign to team:</p>
                        {squads.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No teams yet — create teams first.</p>
                        ) : (
                          squads.map((sq) => (
                            <Button
                              key={sq.id}
                              tone="paper"
                              size="sm"
                              disabled={assigning}
                              onClick={() => handleAssign(sq.id)}
                              className="justify-start"
                            >
                              {sq.name}
                              <span className="ml-auto text-muted-foreground text-xs">{sq.memberCount}</span>
                            </Button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
