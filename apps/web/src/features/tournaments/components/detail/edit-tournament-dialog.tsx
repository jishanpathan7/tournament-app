"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { TournamentResponse } from "@tournament/api-client";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { MATCH_FORMATS, VISIBILITIES } from "@/features/tournaments/config";
import { useUpdateTournament } from "@/features/tournaments/use-tournaments";
import { errorMessage } from "@/lib/problem";

const editSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(200),
    venueName: z.string().max(300),
    visibility: z.enum(["public", "unlisted", "private"]),
    startsAt: z.string(),
    endsAt: z.string(),
    bestOf: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  })
  .refine((v) => !v.startsAt || !v.endsAt || v.endsAt >= v.startsAt, {
    message: "End date can't be before the start date",
    path: ["endsAt"],
  });

type EditValues = z.infer<typeof editSchema>;

const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const toIso = (date: string) => (date ? new Date(`${date}T00:00:00Z`).toISOString() : null);

/** Edit core tournament details (name, visibility, dates). Uses the clear-vs-null API contract. */
export function EditTournamentDialog({
  tournament,
  open,
  onOpenChange,
}: {
  tournament: TournamentResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateTournament(tournament.id);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: tournament.name,
      venueName: tournament.venueName ?? "",
      visibility: tournament.visibility as EditValues["visibility"],
      startsAt: dateInput(tournament.startsAt),
      endsAt: dateInput(tournament.endsAt),
      bestOf: ((tournament.settings?.sportConfig as { bestOf?: number } | undefined)?.bestOf ??
        3) as 1 | 3 | 5,
    },
  });

  const onSubmit = handleSubmit((values) => {
    const existingSettings = (tournament.settings ?? {}) as Record<string, unknown>;
    const existingSportConfig = (existingSettings.sportConfig ?? {}) as Record<string, unknown>;
    update.mutate(
      {
        name: values.name,
        visibility: values.visibility,
        startsAt: toIso(values.startsAt),
        endsAt: toIso(values.endsAt),
        settings: {
          ...existingSettings,
          sportConfig: { ...existingSportConfig, bestOf: values.bestOf },
          venue_name: values.venueName || null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Tournament updated");
          onOpenChange(false);
        },
        onError: (error) => toast.error(errorMessage(error, "Update failed")),
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Edit tournament</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="Name" htmlFor="edit-name" error={errors.name?.message}>
            <Input id="edit-name" aria-invalid={!!errors.name} {...register("name")} />
          </Field>
          <Field label="Venue" htmlFor="edit-venue" error={errors.venueName?.message}>
            <Input
              id="edit-venue"
              placeholder="e.g. Badminton Hall, 123 Main St"
              aria-invalid={!!errors.venueName}
              {...register("venueName")}
            />
          </Field>
          <Field label="Visibility" htmlFor="edit-visibility">
            <Select
              value={watch("visibility")}
              onValueChange={(v) => setValue("visibility", v as EditValues["visibility"])}
            >
              <SelectTrigger id="edit-visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIBILITIES.map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Match format" htmlFor="edit-best-of">
            <Select
              value={String(watch("bestOf"))}
              onValueChange={(v) => setValue("bestOf", Number(v) as 1 | 3 | 5)}
            >
              <SelectTrigger id="edit-best-of">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATCH_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={String(f.value)}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Starts" htmlFor="edit-starts">
              <Input id="edit-starts" type="date" {...register("startsAt")} />
            </Field>
            <Field label="Ends" htmlFor="edit-ends" error={errors.endsAt?.message}>
              <Input
                id="edit-ends"
                type="date"
                aria-invalid={!!errors.endsAt}
                {...register("endsAt")}
              />
            </Field>
          </div>
          <DialogFooter className="mt-2">
            <Button type="button" tone="paper" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" tone="candy" size="sm" disabled={update.isPending}>
              {update.isPending ? <Spinner className="text-white" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
