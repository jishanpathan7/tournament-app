"use client";

import type { DivisionResponse } from "@tournament/api-client";
import { Upload } from "lucide-react";
import { useState } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImportWizard } from "@/features/registration-ops/components/import-wizard";

export function PlayersImportPanel({
  tournamentId,
  divisions,
}: {
  tournamentId: string;
  divisions: DivisionResponse[];
}) {
  const [divisionId, setDivisionId] = useState(divisions[0]?.id ?? "");

  if (divisions.length === 0) {
    return (
      <div className="bg-ink shadow-sticker border-ink rounded-3xl border-2 p-6 text-white">
        <p className="text-sm text-white/70">Add a division before importing players.</p>
      </div>
    );
  }

  return (
    <div className="bg-ink shadow-sticker border-ink flex flex-col gap-5 rounded-3xl border-2 p-6 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-2xs font-mono font-semibold uppercase tracking-[0.2em] text-white/60">
            Import survey responses
          </p>
          <h2 className="font-serif text-2xl font-semibold tracking-tight">
            Pull players from a survey or CSV
          </h2>
        </div>
        <div className="flex min-w-[200px] flex-col gap-1.5">
          <Label className="text-xs text-white/70">Import into</Label>
          <Select value={divisionId} onValueChange={setDivisionId}>
            <SelectTrigger className="border-white/20 bg-white/10 text-white">
              <SelectValue placeholder="Choose division…" />
            </SelectTrigger>
            <SelectContent>
              {divisions.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-white/10 bg-white/5 p-4">
        <div className="mb-4 flex items-center gap-2 text-sm text-white/70">
          <Upload className="h-4 w-4" strokeWidth={2.25} />
          Upload a CSV export, map columns, preview rows, then import
        </div>
        {divisionId ? (
          <ImportWizard tournamentId={tournamentId} divisionId={divisionId} embedded />
        ) : null}
      </div>
    </div>
  );
}
