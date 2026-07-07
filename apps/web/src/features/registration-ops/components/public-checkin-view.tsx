"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { ErrorState } from "@/components/common/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import {
  CheckInApiError,
  confirmPublicCheckIn,
  getPublicCheckInSession,
} from "@/features/registration-ops/checkin-link-api";
import { errorMessage } from "@/lib/problem";

/** Public self check-in — pick your name, confirm once. */
export function PublicCheckInView({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const session = useQuery({
    queryKey: ["checkin", token, "session"],
    queryFn: () => getPublicCheckInSession(token),
    retry: false,
  });

  const confirm = useMutation({
    mutationFn: (participantId: string) => confirmPublicCheckIn(token, participantId),
    onSuccess: () => {
      setDone(true);
      void queryClient.invalidateQueries({ queryKey: ["checkin", token, "session"] });
      toast.success("You're checked in!");
    },
    onError: (err) => toast.error(errorMessage(err, "Check-in failed")),
  });

  const filtered = useMemo(() => {
    const list = session.data?.participants ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => p.displayName.toLowerCase().includes(q));
  }, [session.data?.participants, query]);

  if (session.isLoading) {
    return (
      <div className="grid flex-1 place-items-center p-8">
        <Spinner />
      </div>
    );
  }

  if (session.isError || !session.data) {
    return (
      <div className="flex flex-1 flex-col justify-center p-6">
        <ErrorState
          error={session.error}
          title={
            session.error instanceof CheckInApiError
              ? "Link invalid or expired"
              : "Couldn't open check-in"
          }
        />
      </div>
    );
  }

  const data = session.data;
  const selected = data.participants.find((p) => p.id === selectedId) ?? null;

  if (done || selected?.attendance === "checked_in") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <div className="bg-mint border-ink flex h-16 w-16 items-center justify-center rounded-full border-2">
          <Check className="h-8 w-8" strokeWidth={2.5} />
        </div>
        <h1 className="font-serif text-2xl font-bold">Checked in</h1>
        <p className="text-muted-foreground text-sm">
          {selected?.displayName ?? "You're all set"} — {data.tournamentName}, {data.divisionName}.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
          Check-in
        </p>
        <h1 className="mt-1 font-serif text-2xl font-bold">{data.tournamentName}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{data.divisionName}</p>
      </div>

      <div className="relative">
        <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find your name…"
          className="pl-9"
          autoComplete="off"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">No matching names.</p>
        ) : (
          filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.id)}
              className={`border-ink flex items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                selectedId === p.id ? "bg-candy-tint border-candy" : "bg-card hover:bg-muted/40"
              }`}
            >
              <span className="font-medium">{p.displayName}</span>
              {p.attendance === "checked_in" ? (
                <Badge tone="mint">Done</Badge>
              ) : selectedId === p.id ? (
                <Badge tone="candy">Selected</Badge>
              ) : null}
            </button>
          ))
        )}
      </div>

      <Button
        tone="mint"
        size="lg"
        className="w-full"
        disabled={!selectedId || confirm.isPending || selected?.attendance === "checked_in"}
        onClick={() => selectedId && confirm.mutate(selectedId)}
      >
        {confirm.isPending ? <Spinner className="h-4 w-4" /> : "Confirm check-in"}
      </Button>
    </div>
  );
}
