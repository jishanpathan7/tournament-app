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
import {
  useAssignCourt,
  useCreateCourt,
  useCreateVenue,
  useVenues,
} from "@/features/courts/use-courts";
import { errorMessage } from "@/lib/problem";

const NEW_VENUE = "__new__";

/** Creates a court (and its venue, if new) and immediately assigns it to this
 * tournament — the common path when setting up courts for the first time. */
export function CreateCourtDialog({
  tournamentId,
  open,
  onOpenChange,
}: {
  tournamentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const venues = useVenues();
  const createVenue = useCreateVenue();
  const createCourt = useCreateCourt();
  const assignCourt = useAssignCourt(tournamentId);

  const [venueId, setVenueId] = useState<string>("");
  const [newVenueName, setNewVenueName] = useState("");
  const [courtName, setCourtName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pending = createVenue.isPending || createCourt.isPending || assignCourt.isPending;

  const reset = () => {
    setVenueId("");
    setNewVenueName("");
    setCourtName("");
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!courtName.trim()) {
      setError("Court name is required.");
      return;
    }
    if (!venueId) {
      setError("Choose or create a venue.");
      return;
    }
    if (venueId === NEW_VENUE && !newVenueName.trim()) {
      setError("Venue name is required.");
      return;
    }

    try {
      const resolvedVenueId =
        venueId === NEW_VENUE
          ? (await createVenue.mutateAsync({ name: newVenueName.trim() })).id
          : venueId;
      const court = await createCourt.mutateAsync({
        venueId: resolvedVenueId,
        name: courtName.trim(),
      });
      await assignCourt.mutateAsync({ courtId: court.id });
      toast.success(`${court.name} added`);
      handleOpenChange(false);
    } catch (e) {
      setError(errorMessage(e, "Couldn't create court"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Add court</DialogTitle>
          <DialogDescription>
            Creates the court and assigns it to this tournament.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="venue">Venue</Label>
            <p className="text-muted-foreground text-xs">
              Group courts by location — e.g. &ldquo;Sports Hall A&rdquo;.
            </p>
            <Select value={venueId} onValueChange={setVenueId}>
              <SelectTrigger id="venue" aria-label="Venue">
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
              <Label htmlFor="new-venue-name">Venue name</Label>
              <Input
                id="new-venue-name"
                value={newVenueName}
                onChange={(e) => setNewVenueName(e.target.value)}
                placeholder="Main Gym"
                autoFocus
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="court-name">Court name</Label>
            <Input
              id="court-name"
              value={courtName}
              onChange={(e) => setCourtName(e.target.value)}
              placeholder="Court 1"
            />
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
            Add court
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
