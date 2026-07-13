"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { usePairCreationMode } from "@/features/tournaments/use-pair-creation-mode";
import { useUpdateTournament } from "@/features/tournaments/use-tournaments";
import { errorMessage } from "@/lib/problem";
import { cn } from "@/lib/utils";

const OPTIONS = [
  {
    value: "auto",
    label: "Automatically",
    description: "Playlane generates fair pairs using player skills.",
    recommended: true,
  },
  {
    value: "manual",
    label: "Manually",
    description: "Team captains create their own doubles pairs.",
    recommended: false,
  },
] as const;

export function PairingModeCard({ tournamentId }: { tournamentId: string }) {
  const { mode } = usePairCreationMode(tournamentId);
  const update = useUpdateTournament(tournamentId);

  function setMode(value: "auto" | "manual") {
    update.mutate(
      { pairCreationMode: value },
      {
        onSuccess: () =>
          toast.success(value === "manual" ? "Manual pairing enabled" : "Auto pairing enabled"),
        onError: (e) => toast.error(errorMessage(e, "Couldn't update setting")),
      },
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Pair Creation Mode</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-muted-foreground mb-1 text-sm">
          How should doubles pairs be created within each franchise team?
        </p>
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={update.isPending}
            onClick={() => setMode(opt.value)}
            className={cn(
              "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
              mode === opt.value
                ? "border-candy bg-candy/5"
                : "hover:border-muted hover:bg-muted/40 border-transparent",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                mode === opt.value ? "border-candy" : "border-muted-foreground/40",
              )}
            >
              {mode === opt.value && <span className="bg-candy h-2 w-2 rounded-full" />}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">
                {opt.label}
                {opt.recommended && (
                  <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                    (Recommended)
                  </span>
                )}
              </span>
              <span className="text-muted-foreground text-xs">{opt.description}</span>
            </span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
