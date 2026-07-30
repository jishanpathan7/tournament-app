"use client";

import type { PublicDivisionView } from "@tournament/api-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Spinner } from "@/components/ui/spinner";
import { isRegistrationOpen } from "@/features/public/config";
import * as publicApi from "@/features/public/public-api";
import { PublicApiError } from "@/features/public/public-api";
import { usePublicTournament } from "@/features/public/use-public-tournament";
import { errorMessage } from "@/lib/problem";

const registerSchema = z.object({
  divisionId: z.string().min(1, "Please choose a division"),
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  email: z.string().email("Enter a valid email").max(254).or(z.literal("")).optional(),
  skill: z.enum(["beginner", "intermediate", "advanced", ""]).optional(),
  partner: z.string().max(100, "Name is too long").optional(),
});
type RegisterValues = z.infer<typeof registerSchema>;

const SKILL_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

/** Self-service registration form for participants — no login required. */
export function PublicRegisterForm({ slug }: { slug: string }) {
  const router = useRouter();
  const tournament = usePublicTournament(slug);
  const divisions = useQuery({
    queryKey: ["public", slug, "divisions"],
    queryFn: () => publicApi.listDivisions(slug),
    enabled: !!slug,
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { divisionId: "", name: "", email: "", skill: "", partner: "" },
  });

  const submit = useMutation({
    mutationFn: (values: RegisterValues) =>
      publicApi.submitRegistration(slug, values.divisionId, {
        name: values.name.trim(),
        email: values.email?.trim() || null,
        skillLevel: values.skill || null,
        preferredPartnerName: values.partner?.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Registration submitted — check your email for confirmation.");
      router.push(`/t/${slug}`);
    },
    onError: (err) => {
      if (err instanceof PublicApiError && err.status === 422) {
        toast.error("Registration is closed or the form was invalid.");
        return;
      }
      toast.error(errorMessage(err));
    },
  });

  if (tournament.isLoading || divisions.isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner />
      </div>
    );
  }

  if (tournament.isError || !tournament.data) {
    return <p className="text-muted-foreground py-16 text-center">Tournament not found.</p>;
  }

  const open = isRegistrationOpen(tournament.data.status);
  const divisionList = divisions.data ?? [];

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Link href={`/t/${slug}`} className="text-muted-foreground text-sm hover:underline">
        ← Back to {tournament.data.name}
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-bold">Register</h1>
      <p className="text-muted-foreground mt-2">
        {open
          ? "Submit your entry — an organizer will review it."
          : "Registration is not open for this tournament."}
      </p>

      {!open ? null : (
        <form
          className="border-ink bg-card shadow-sticker mt-8 flex flex-col gap-5 rounded-2xl border-2 p-4 sm:p-6"
          onSubmit={handleSubmit((values) => submit.mutate(values))}
          noValidate
        >
          <Field label="Division" htmlFor="reg-division" error={errors.divisionId?.message}>
            <Controller
              name="divisionId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="reg-division"
                    aria-label="Division"
                    aria-invalid={!!errors.divisionId}
                  >
                    <SelectValue placeholder="Choose a division" />
                  </SelectTrigger>
                  <SelectContent>
                    {divisionList.map((d: PublicDivisionView) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} ({d.participantType})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Your name" htmlFor="reg-name" error={errors.name?.message}>
            <Input id="reg-name" aria-invalid={!!errors.name} {...register("name")} />
          </Field>
          <Field label="Email" htmlFor="reg-email" error={errors.email?.message}>
            <Input
              id="reg-email"
              type="email"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
          </Field>
          <Field label="Skill level" htmlFor="reg-skill" error={errors.skill?.message}>
            <Controller
              name="skill"
              control={control}
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger id="reg-skill" aria-label="Skill level">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {SKILL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field
            label="Preferred partner name"
            htmlFor="reg-partner"
            error={errors.partner?.message}
          >
            <Input id="reg-partner" placeholder="Optional — doubles" {...register("partner")} />
          </Field>
          <Button type="submit" size="lg" disabled={submit.isPending}>
            {submit.isPending ? <Spinner className="h-5 w-5" /> : "Submit registration"}
          </Button>
        </form>
      )}
    </div>
  );
}
