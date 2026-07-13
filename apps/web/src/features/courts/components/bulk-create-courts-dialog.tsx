"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { useBulkCreateCourts, useVenues } from "@/features/courts/use-courts";
import { errorMessage } from "@/lib/problem";

const NEW_VENUE = "__new__";

/** Creates a numbered batch of courts (e.g. Court 1–8) and assigns them to the tournament. */
export function BulkCreateCourtsDialog({
  tournamentId,
  open,
  onOpenChange,
}: {
  tournamentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const venues = useVenues();
  const bulkCreate = useBulkCreateCourts(tournamentId);

  const [venueId, setVenueId] = useState("");
  const [newVenueName, setNewVenueName] = useState("");
  const [count, setCount] = useState("8");
  const [namePrefix, setNamePrefix] = useState("Court ");
  const [startNumber, setStartNumber] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const pending = bulkCreate.isPending;

  const reset = () => {
    setVenueId("");
    setNewVenueName("");
    setCount("8");
    setNamePrefix("Court ");
    setStartNumber("1");
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const parsedCount = Number.parseInt(count, 10);
  const parsedStart = Number.parseInt(startNumber, 10);
  const previewEnd =
    Number.isFinite(parsedCount) && Number.isFinite(parsedStart) && parsedCount >= 1
      ? parsedStart + parsedCount - 1
      : null;

  const handleSubmit = async () => {
    setError(null);
    if (!venueId) {
      setError("Choose or create a venue.");
      return;
    }
    if (venueId === NEW_VENUE && !newVenueName.trim()) {
      setError("Venue name is required.");
      return;
    }
    if (!Number.isFinite(parsedCount) || parsedCount < 1 || parsedCount > 50) {
      setError("Count must be between 1 and 50.");
      return;
    }
    if (!Number.isFinite(parsedStart) || parsedStart < 1) {
      setError("Start number must be at least 1.");
      return;
    }
    if (!namePrefix.trim()) {
      setError("Name prefix is required.");
      return;
    }

    try {
      const body =
        venueId === NEW_VENUE
          ? {
              newVenueName: newVenueName.trim(),
              count: parsedCount,
              namePrefix: namePrefix.trim(),
              startNumber: parsedStart,
            }
          : {
              venueId,
              count: parsedCount,
              namePrefix: namePrefix.trim(),
              startNumber: parsedStart,
            };

      const result = await bulkCreate.mutateAsync(body);
      toast.success(`Added ${result.created.length} courts`);
      handleOpenChange(false);
    } catch (e) {
      setError(errorMessage(e, "Couldn't create courts"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Add courts in bulk</DialogTitle>
          <DialogDescription>
            Creates numbered courts and assigns them all to this tournament — e.g. Court 1 through
            Court 8.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bulk-venue">Venue</Label>
            <p className="text-muted-foreground text-xs">
              Group courts by location — e.g. &ldquo;Sports Hall A&rdquo;.
            </p>
            <Select value={venueId} onValueChange={setVenueId}>
              <SelectTrigger id="bulk-venue" aria-label="Venue">
                <SelectValue placeholder="Choose a venue" />
              </SelectTrigger>
              <SelectContent>
                {(venues.data ?? []).map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_VENUE}>+ New venue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {venueId === NEW_VENUE ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bulk-new-venue">Venue name</Label>
              <Input
                id="bulk-new-venue"
                value={newVenueName}
                onChange={(e) => setNewVenueName(e.target.value)}
                placeholder="Main Gym"
                autoFocus
              />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bulk-count">How many</Label>
              <Input
                id="bulk-count"
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bulk-start">Start at</Label>
              <Input
                id="bulk-start"
                type="number"
                min={1}
                value={startNumber}
                onChange={(e) => setStartNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bulk-prefix">Name prefix</Label>
            <Input
              id="bulk-prefix"
              value={namePrefix}
              onChange={(e) => setNamePrefix(e.target.value)}
              placeholder="Court "
            />
            {previewEnd !== null ? (
              <p className="text-muted-foreground text-xs">
                Preview: {namePrefix.trim()}
                {parsedStart}
                {parsedCount > 1 ? ` … ${namePrefix.trim()}${previewEnd}` : ""}
              </p>
            ) : null}
          </div>

          {error ? (
            <p className="border-pink bg-pink-tint text-ink rounded-2xl border-2 p-3 text-sm">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            tone="paper"
            size="sm"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="button" tone="candy" size="sm" onClick={handleSubmit} disabled={pending}>
            {pending ? <Spinner className="text-white" /> : null}
            Create courts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
