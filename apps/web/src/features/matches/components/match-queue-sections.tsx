"use client";

import type {
  CourtView,
  MatchView,
  ParticipantResponse,
  StageResponse,
} from "@tournament/api-client";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MatchCard } from "@/features/matches/components/match-card";
import {
  groupMatchesByOpsSection,
  stepFocusId,
  type OpsMatchSections,
} from "@/features/matches/config";
import { useMatchCenterStore } from "@/stores/match-center-store";
import { cn } from "@/lib/utils";

const VIRTUALIZE_THRESHOLD = 30;

type SectionKey = keyof OpsMatchSections;

const SECTION_META: Record<
  SectionKey,
  {
    title: string;
    defaultOpen: boolean;
    accent: string;
    badge: "mint" | "yellow" | "muted" | "pink";
  }
> = {
  live: {
    title: "Live now",
    defaultOpen: true,
    accent: "border-l-mint bg-mint-tint/40",
    badge: "mint",
  },
  upNext: {
    title: "Up next",
    defaultOpen: true,
    accent: "border-l-yellow bg-yellow-tint/50",
    badge: "yellow",
  },
  waiting: {
    title: "Waiting for court",
    defaultOpen: true,
    accent: "border-l-ink/20 bg-card",
    badge: "muted",
  },
  delayed: {
    title: "Delayed",
    defaultOpen: true,
    accent: "border-l-pink bg-pink-tint/40",
    badge: "pink",
  },
  recentlyFinished: {
    title: "Recently finished",
    defaultOpen: false,
    accent: "border-l-ink/10 bg-muted/30",
    badge: "muted",
  },
};

function VirtualMatchList({
  matches,
  participantsById,
  stagesById,
  courtsById,
  focusedMatchId,
  onOpen,
  onPrimaryAction,
}: {
  matches: MatchView[];
  participantsById: Map<string, ParticipantResponse>;
  stagesById: Map<string, StageResponse>;
  courtsById: Map<string, CourtView>;
  focusedMatchId: string | null;
  onOpen: (matchId: string) => void;
  onPrimaryAction: (matchId: string) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: matches.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 96,
    overscan: 6,
  });

  return (
    <div ref={parentRef} className="max-h-[480px] overflow-y-auto">
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((item) => {
          const match = matches[item.index]!;
          return (
            <div
              key={match.id}
              className="absolute left-0 top-0 w-full pb-2"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <MatchCard
                match={match}
                participantsById={participantsById}
                stagesById={stagesById}
                courtsById={courtsById}
                focused={focusedMatchId === match.id}
                onOpen={onOpen}
                onPrimaryAction={onPrimaryAction}
                nested
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MatchSection({
  sectionKey,
  matches,
  participantsById,
  stagesById,
  courtsById,
  focusedMatchId,
  onOpen,
  onPrimaryAction,
}: {
  sectionKey: SectionKey;
  matches: MatchView[];
  participantsById: Map<string, ParticipantResponse>;
  stagesById: Map<string, StageResponse>;
  courtsById: Map<string, CourtView>;
  focusedMatchId: string | null;
  onOpen: (matchId: string) => void;
  onPrimaryAction: (matchId: string) => void;
}) {
  const meta = SECTION_META[sectionKey];
  const [open, setOpen] = useState(meta.defaultOpen);

  if (matches.length === 0) return null;

  return (
    <Card className="border-ink shadow-sticker-xs overflow-hidden border-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "border-ink/10 flex w-full items-center gap-3 border-b border-l-4 px-4 py-3 text-left transition-colors",
          meta.accent,
          open ? "border-b" : "border-b-transparent",
        )}
      >
        <span className="border-ink/20 bg-card flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border">
          <ChevronDown
            className={cn(
              "text-muted-foreground h-4 w-4 transition-transform",
              !open && "-rotate-90",
            )}
            aria-hidden
          />
        </span>
        <h3 className="font-serif text-base font-semibold tracking-tight">{meta.title}</h3>
        <Badge tone={meta.badge} className="ml-auto tabular-nums">
          {matches.length}
        </Badge>
      </button>
      {open ? (
        <CardContent className="flex flex-col gap-2 p-3">
          {matches.length > VIRTUALIZE_THRESHOLD ? (
            <VirtualMatchList
              matches={matches}
              participantsById={participantsById}
              stagesById={stagesById}
              courtsById={courtsById}
              focusedMatchId={focusedMatchId}
              onOpen={onOpen}
              onPrimaryAction={onPrimaryAction}
            />
          ) : (
            matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                participantsById={participantsById}
                stagesById={stagesById}
                courtsById={courtsById}
                focused={focusedMatchId === match.id}
                onOpen={onOpen}
                onPrimaryAction={onPrimaryAction}
                nested
              />
            ))
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}

export function MatchQueueSections({
  matches,
  participantsById,
  stagesById,
  courtsById,
  onOpen,
  onPrimaryAction,
}: {
  matches: MatchView[];
  participantsById: Map<string, ParticipantResponse>;
  stagesById: Map<string, StageResponse>;
  courtsById: Map<string, CourtView>;
  onOpen: (matchId: string) => void;
  onPrimaryAction: (matchId: string) => void;
}) {
  const sections = groupMatchesByOpsSection(matches);
  const focusedMatchId = useMatchCenterStore((s) => s.focusedMatchId);
  const setFocusedMatchId = useMatchCenterStore((s) => s.setFocusedMatchId);

  const orderedIds = [
    ...sections.live,
    ...sections.upNext,
    ...sections.waiting,
    ...sections.delayed,
    ...sections.recentlyFinished,
  ].map((m) => m.id);

  useEffect(() => {
    if (focusedMatchId === null && orderedIds.length > 0) {
      setFocusedMatchId(orderedIds[0]!);
    }
  }, [focusedMatchId, orderedIds, setFocusedMatchId]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const next = stepFocusId(orderedIds, focusedMatchId, e.key === "ArrowDown" ? 1 : -1);
    if (next) setFocusedMatchId(next);
  };

  return (
    <div className="flex flex-col gap-3 outline-none" tabIndex={0} onKeyDown={handleKeyDown}>
      {(Object.keys(SECTION_META) as SectionKey[]).map((key) => (
        <MatchSection
          key={key}
          sectionKey={key}
          matches={sections[key]}
          participantsById={participantsById}
          stagesById={stagesById}
          courtsById={courtsById}
          focusedMatchId={focusedMatchId}
          onOpen={onOpen}
          onPrimaryAction={onPrimaryAction}
        />
      ))}
    </div>
  );
}
