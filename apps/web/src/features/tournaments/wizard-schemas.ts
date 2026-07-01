import { z } from "zod";

/** Per-step validation for the create wizard. Mirrors backend constraints (name/slug). */

export const basicInfoSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  slug: z
    .string()
    .min(2, "At least 2 characters")
    .max(120)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Lowercase letters, numbers, and hyphens"),
  visibility: z.enum(["public", "unlisted", "private"]),
});

export const sportSchema = z.object({
  sportKey: z.string().min(1, "Pick a sport"),
});

export const formatSchema = z.object({
  format: z.enum(["round_robin", "single_elim", "group_knockout", "swiss", "ladder"]),
});

export const divisionSchema = z.object({
  name: z.string().min(1, "Division name is required").max(120),
  participantType: z.enum(["individual", "pair", "team"]),
});

export const divisionsSchema = z.object({
  divisions: z.array(divisionSchema).min(1, "Add at least one division"),
});

export const scheduleSchema = z
  .object({
    startsAt: z.string(),
    endsAt: z.string(),
  })
  .refine((v) => !v.startsAt || !v.endsAt || v.endsAt >= v.startsAt, {
    message: "End date can't be before the start date",
    path: ["endsAt"],
  });

export type BasicInfoValues = z.infer<typeof basicInfoSchema>;
export type SportValues = z.infer<typeof sportSchema>;
export type FormatValues = z.infer<typeof formatSchema>;
export type DivisionsValues = z.infer<typeof divisionsSchema>;
export type ScheduleValues = z.infer<typeof scheduleSchema>;
