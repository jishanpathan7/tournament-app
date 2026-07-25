"use client";

import type { ParticipantResponse } from "@tournament/api-client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { useUpdateParticipant } from "@/features/registrations/use-registrations";

const schema = z.object({
  displayName: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").or(z.literal("")),
  phone: z.string(),
  gender: z.string(),
  skillLevel: z.enum(["beginner", "intermediate", "advanced", ""]),
  partnerPreference: z.string(),
});

type FormValues = z.infer<typeof schema>;

export function EditPlayerDialog({
  participant,
  divisionId,
  open,
  onOpenChange,
}: {
  participant: ParticipantResponse | null;
  divisionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateParticipant(divisionId);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: "",
      email: "",
      phone: "",
      gender: "",
      skillLevel: "",
      partnerPreference: "",
    },
  });

  useEffect(() => {
    if (participant && open) {
      form.reset({
        displayName: participant.displayName ?? "",
        email: participant.email ?? "",
        phone: participant.phone ?? "",
        gender: participant.gender ?? "",
        skillLevel: (participant.skillLevel as FormValues["skillLevel"]) ?? "",
        partnerPreference: participant.partnerPreference ?? "",
      });
    }
  }, [participant, open, form]);

  if (!participant) return null;

  async function onSubmit(values: FormValues) {
    if (!participant) return;
    await update.mutateAsync(
      {
        participantId: participant.id,
        data: {
          displayName: values.displayName || undefined,
          email: values.email || undefined,
          phone: values.phone || undefined,
          gender: values.gender || undefined,
          skillLevel: (values.skillLevel as "beginner" | "intermediate" | "advanced") || undefined,
          partnerPreference: values.partnerPreference || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Player updated");
          onOpenChange(false);
        },
        onError: () => {
          toast.error("Failed to update player");
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit player</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ep-name">Name</Label>
            <Input id="ep-name" {...form.register("displayName")} />
            {form.formState.errors.displayName ? (
              <p className="text-pink text-xs">{form.formState.errors.displayName.message}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ep-email">Email</Label>
            <Input id="ep-email" type="email" {...form.register("email")} />
            {form.formState.errors.email ? (
              <p className="text-pink text-xs">{form.formState.errors.email.message}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ep-phone">Phone</Label>
              <Input id="ep-phone" type="tel" {...form.register("phone")} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Gender</Label>
              <Select
                value={form.watch("gender")}
                onValueChange={(v) => form.setValue("gender", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Non-binary">Non-binary</SelectItem>
                  <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Skill level</Label>
              <Select
                value={form.watch("skillLevel")}
                onValueChange={(v) => form.setValue("skillLevel", v as FormValues["skillLevel"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ep-partner">Partner preference</Label>
              <Input id="ep-partner" {...form.register("partnerPreference")} />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              tone="paper"
              onClick={() => onOpenChange(false)}
              disabled={update.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" tone="candy" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
