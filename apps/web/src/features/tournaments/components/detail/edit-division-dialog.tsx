"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { DivisionResponse } from "@tournament/api-client";
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
import { PARTICIPANT_KINDS } from "@/features/tournaments/config";
import { useUpdateDivision } from "@/features/tournaments/use-tournaments";
import { errorMessage } from "@/lib/problem";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(160),
  participantType: z.enum(["individual", "pair", "team", "squad"]),
});

type Values = z.infer<typeof schema>;

export function EditDivisionDialog({
  tournamentId,
  division,
  open,
  onOpenChange,
}: {
  tournamentId: string;
  division: DivisionResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateDivision(tournamentId, division.id);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: division.name,
      participantType: division.participantType as Values["participantType"],
    },
  });

  const onSubmit = (values: Values) => {
    update.mutate(
      { name: values.name, participantType: values.participantType },
      {
        onSuccess: () => {
          toast.success("Division updated");
          onOpenChange(false);
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit division</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field label="Name" htmlFor="div-name" error={errors.name?.message}>
            <Input id="div-name" {...register("name")} placeholder="e.g. Mixed Doubles" />
          </Field>
          <Field label="Type" htmlFor="div-type" error={errors.participantType?.message}>
            <Select
              value={watch("participantType")}
              onValueChange={(v) =>
                setValue("participantType", v as Values["participantType"], { shouldDirty: true })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(PARTICIPANT_KINDS) as [Values["participantType"], string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button type="button" tone="paper" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" tone="candy" disabled={!isDirty || update.isPending}>
              {update.isPending ? <Spinner /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
