"use client";

import { CheckCircle2, ChevronDown, GitMerge, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SquadColumn } from "@/features/squads/components/squad-column";
import { SquadPairingFooter } from "@/features/squads/components/squad-pairing-footer";
import { SkillBar } from "@/features/squads/components/skill-bar";
import type { SquadPairingStatus } from "@/features/squads/config";
import { squadBorderTint } from "@/features/squads/config";
import type { SquadView } from "@/features/squads/types";
import { cn } from "@/lib/utils";

function PairingStatusBadge({
  status,
  pairCount,
}: {
  status: SquadPairingStatus;
  pairCount: number;
}) {
  if (status === "loading") {
    return (
      <span className="text-muted-foreground flex items-center gap-1 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking pairs…
      </span>
    );
  }
  if (status === "published") {
    return (
      <Badge tone="mint" className="text-2xs">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        {pairCount} pairs locked
      </Badge>
    );
  }
  if (status === "draft") {
    return (
      <Badge tone="yellow" className="text-2xs">
        {pairCount} pairs · draft
      </Badge>
    );
  }
  return (
    <Badge tone="muted" className="text-2xs">
      No pairs yet
    </Badge>
  );
}

function PairingActionButton({
  status,
  canManage,
  memberCount,
  onOpen,
}: {
  status: SquadPairingStatus;
  canManage: boolean;
  memberCount: number;
  onOpen: () => void;
}) {
  if (status === "loading" || !canManage || memberCount < 2) return null;

  if (status === "published") {
    return (
      <Button tone="ghost" size="sm" onClick={onOpen} className="h-8 shrink-0 px-2 text-xs">
        View pairs
      </Button>
    );
  }
  if (status === "draft") {
    return (
      <Button tone="paper" size="sm" onClick={onOpen} className="h-8 shrink-0 px-2 text-xs">
        Review &amp; lock
      </Button>
    );
  }
  return (
    <Button tone="candy" size="sm" onClick={onOpen} className="h-8 shrink-0 px-2 text-xs">
      <GitMerge className="h-3.5 w-3.5" />
      Generate pairs
    </Button>
  );
}

/** Collapsible team card — collapsed by default for fast scanning at scale. */
export function SquadCard({
  squad,
  expanded,
  onToggleExpand,
  canManage,
  divisionId,
  pairingStatus,
  pairCount,
  highlightAssign,
  onAssign,
  onRemove,
  onSetCaptain,
  onRename,
  onOpenPairing,
  onDelete,
  deleteLoading,
}: {
  squad: SquadView;
  expanded: boolean;
  onToggleExpand: () => void;
  canManage: boolean;
  divisionId: string | null;
  pairingStatus: SquadPairingStatus;
  pairCount: number;
  highlightAssign: boolean;
  onAssign: () => void;
  onRemove: (registrationId: string) => void;
  onSetCaptain: (registrationId: string) => void;
  onRename: (name: string) => void;
  onOpenPairing: () => void;
  onDelete?: () => void;
  deleteLoading?: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(squad.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const borderTint = squadBorderTint(squad.sortOrder);

  function commitRename() {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== squad.name) onRename(trimmed);
    setEditingName(false);
  }

  if (expanded) {
    return (
      <>
        {onDelete ? (
          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            title={`Delete ${squad.name}?`}
            description={
              squad.memberCount > 0
                ? `${squad.memberCount} player${squad.memberCount === 1 ? "" : "s"} will return to the unassigned pool.`
                : "This team has no players and will be permanently removed."
            }
            confirmLabel="Delete team"
            confirmTone="pink"
            loading={deleteLoading}
            onConfirm={() => {
              onDelete();
              setConfirmDelete(false);
            }}
          />
        ) : null}
        <div
          className={cn(
            "border-ink shadow-sticker-xs flex flex-col overflow-hidden rounded-2xl border-2 border-l-4",
            borderTint,
          )}
        >
          <div className="border-ink/10 flex items-center justify-between gap-2 border-b px-3 py-2">
            <div className="min-w-0 flex-1">
              {editingName && canManage ? (
                <Input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") {
                      setNameDraft(squad.name);
                      setEditingName(false);
                    }
                  }}
                  className="h-8 text-sm font-semibold"
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  className={cn(
                    "truncate text-left font-serif text-base font-semibold",
                    canManage && "hover:underline",
                  )}
                  onClick={() => canManage && setEditingName(true)}
                  disabled={!canManage}
                >
                  {squad.name}
                </button>
              )}
              <p className="text-muted-foreground text-xs">
                {squad.memberCount} players · skill {squad.totalSkillWeight.toFixed(1)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {highlightAssign && canManage ? (
                <Button tone="candy" size="sm" onClick={onAssign} className="h-8 px-2 text-xs">
                  Assign here
                </Button>
              ) : null}
              {canManage && onDelete ? (
                <Button
                  tone="ghost"
                  size="icon-sm"
                  onClick={() => setConfirmDelete(true)}
                  aria-label="Delete team"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
              <Button
                tone="ghost"
                size="icon-sm"
                onClick={onToggleExpand}
                aria-label="Collapse team"
                aria-expanded
              >
                <ChevronDown className="h-4 w-4 rotate-180" />
              </Button>
            </div>
          </div>

          {squad.memberCount > 4 ? (
            <div className="border-ink/10 border-b px-3 py-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search players…"
                className="h-8 text-sm"
              />
            </div>
          ) : null}

          <SquadColumn
            squad={squad}
            canManage={canManage}
            highlightAssign={highlightAssign}
            searchQuery={searchQuery}
            hideHeader
            onAssign={onAssign}
            onRemove={onRemove}
            onSetCaptain={onSetCaptain}
            onRename={onRename}
          />

          {divisionId ? (
            <SquadPairingFooter
              squad={squad}
              divisionId={divisionId}
              canManage={canManage}
              onOpen={onOpenPairing}
            />
          ) : null}
        </div>
      </>
    );
  }

  return (
    <div
      className={cn(
        "border-ink bg-card shadow-sticker-xs flex flex-col overflow-hidden rounded-2xl border-2 border-l-4",
        borderTint,
        highlightAssign && canManage && "ring-candy ring-2 ring-offset-2",
      )}
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-serif text-lg font-semibold">{squad.name}</h3>
            <p className="text-muted-foreground text-xs">
              {squad.memberCount} players · skill {squad.totalSkillWeight.toFixed(1)}
            </p>
          </div>
          <Button
            tone="ghost"
            size="icon-sm"
            onClick={onToggleExpand}
            aria-label="Expand team"
            aria-expanded={false}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

        <SkillBar members={squad.members} />

        <div className="flex items-center justify-between gap-2">
          <PairingStatusBadge status={pairingStatus} pairCount={pairCount} />
          <div className="flex items-center gap-1.5">
            {highlightAssign && canManage ? (
              <Button tone="candy" size="sm" onClick={onAssign} className="h-8 px-2 text-xs">
                Assign here
              </Button>
            ) : null}
            <PairingActionButton
              status={pairingStatus}
              canManage={canManage}
              memberCount={squad.memberCount}
              onOpen={onOpenPairing}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
