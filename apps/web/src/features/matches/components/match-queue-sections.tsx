"use client";

import type {
  CourtView,
  MatchView,
  ParticipantResponse,
  StageResponse,
} from "@tournament/api-client";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

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

const SECTION_META: Record<SectionKey, { title: string; defaultOpen: boolean; tone: string }> = {
  live: { title: "Live now", defaultOpen: true, tone: "text-mint-dark" },
  upNext: { title: "Up next", defaultOpen: true, tone: "text-yellow-600" },
  waiting: { title: "Waiting for court", defaultOpen: true, tone: "text-muted-foreground" },
  delayed: { title: "Delayed", defaultOpen: true, tone: "text-pink-dark" },
  recentlyFinished: {
    title: "Recently finished",
    defaultOpen: false,
    tone: "text-muted-foreground",
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
    estimateSize: () => 112,
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
    <section className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
        <h3 className={cn("font-serif text-lg font-semibold tracking-tight", meta.tone)}>
          {meta.title}
        </h3>
        <span className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.14em]">
          {matches.length}
        </span>
      </button>
      {open ? (
        matches.length > VIRTUALIZE_THRESHOLD ? (
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
          <div className="flex flex-col gap-2">
            {matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                participantsById={participantsById}
                stagesById={stagesById}
                courtsById={courtsById}
                focused={focusedMatchId === match.id}
                onOpen={onOpen}
                onPrimaryAction={onPrimaryAction}
              />
            ))}
          </div>
        )
      ) : null}
    </section>
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
    <div className="flex flex-col gap-6 outline-none" tabIndex={0} onKeyDown={handleKeyDown}>
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
