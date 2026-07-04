"use client";

import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Scorekeeper header — back · centered match context · LIVE badge (mockup-accurate). */
export function MatchScorekeeperHeader({
  title,
  meta,
  onBack,
}: {
  title: string;
  meta: string;
  onBack?: () => void;
}) {
  return (
    <header className="border-ink grid grid-cols-[2.75rem_1fr_auto] items-start gap-x-1 border-b-2 px-3 pb-3.5 pt-3.5">
      {onBack ? (
        <Button
          type="button"
          tone="paper"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full shadow-sticker-xs"
          onClick={onBack}
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
        </Button>
      ) : (
        <div className="h-10 w-10 shrink-0" aria-hidden />
      )}
      <div className="min-w-0 px-1 text-center">
        <h1 className="truncate text-[15px] font-bold leading-tight tracking-tight">{title}</h1>
        <p className="label text-muted-foreground mt-1 text-[10px] leading-none tracking-[0.16em]">
          {meta}
        </p>
      </div>
      <Badge tone="candy" className="mt-0.5 shrink-0 shadow-sticker-xs">
        Live
      </Badge>
    </header>
  );
}
