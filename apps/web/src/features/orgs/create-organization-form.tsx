"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { uploadOrgLogo } from "@/features/orgs/orgs-api";
import { COUNTRIES, SPORTS, TIMEZONES, guessTimezone } from "@/features/orgs/onboarding-config";
import { useCreateOrg, useUpdateActiveOrg } from "@/features/orgs/use-orgs";
import { slugify } from "@/features/tournaments/use-tournament-draft";
import { ApiError, errorMessage } from "@/lib/problem";

const schema = z.object({
  name: z.string().min(1, "Organization name is required").max(200),
  slug: z
    .string()
    .min(2, "At least 2 characters")
    .max(120)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Lowercase letters, numbers, and hyphens"),
  defaultSport: z.string().min(1, "Pick a default sport"),
  country: z.string().min(1, "Pick a country"),
  timezone: z.string().min(1, "Pick a timezone"),
});

type Values = z.infer<typeof schema>;
const MAX_LOGO = 5 * 1024 * 1024;

/**
 * First-run org setup. Creates the org (owner + active), best-effort uploads the optional
 * logo, then patches timezone + branding (country/sport/logo). On success → dashboard.
 */
export function CreateOrganizationForm() {
  const router = useRouter();
  const createOrg = useCreateOrg();
  const patchOrg = useUpdateActiveOrg();
  const [logo, setLogo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, dirtyFields },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      slug: "",
      defaultSport: "badminton",
      country: "IN",
      timezone: guessTimezone(),
    },
  });

  const name = watch("name");
  useEffect(() => {
    if (!dirtyFields.slug) setValue("slug", slugify(name), { shouldValidate: !!name });
  }, [name, dirtyFields.slug, setValue]);

  useEffect(() => {
    if (!logo) return setPreview(null);
    const url = URL.createObjectURL(logo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logo]);

  const onLogo = (file: File | null) => {
    if (file && file.size > MAX_LOGO) {
      toast.error("Logo must be under 5 MB");
      return;
    }
    setLogo(file);
  };

  const onSubmit = handleSubmit(async (values) => {
    setBusy(true);
    try {
      await createOrg.mutateAsync({ name: values.name, slug: values.slug });
      let logoUrl: string | null = null;
      if (logo) {
        try {
          logoUrl = await uploadOrgLogo(logo);
        } catch {
          toast.error("Couldn't upload the logo — you can add it later in Settings.");
        }
      }
      await patchOrg.mutateAsync({
        timezone: values.timezone,
        branding: { country: values.country, defaultSport: values.defaultSport, logoUrl },
      });
      toast.success("Organization created");
      router.replace("/console");
    } catch (error) {
      if (error instanceof ApiError && error.isConflict) {
        setError("slug", { message: "That slug is taken — try another" });
      } else {
        toast.error(errorMessage(error, "Couldn't create organization"));
      }
      setBusy(false);
    }
  });

  return (
    <Card>
      <CardHeader>
        <p className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.28em]">
          Step 1 of 1
        </p>
        <CardTitle className="text-2xl">Create your organization</CardTitle>
        <CardDescription>This is your workspace for running tournaments.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          <Field label="Organization name" htmlFor="org-name" error={errors.name?.message}>
            <Input id="org-name" aria-invalid={!!errors.name} {...register("name")} />
          </Field>
          <Field
            label="URL slug"
            htmlFor="org-slug"
            error={errors.slug?.message}
            helper="Used in public links."
          >
            <Input id="org-slug" aria-invalid={!!errors.slug} {...register("slug")} />
          </Field>

          <Field label="Logo (optional)" htmlFor="org-logo">
            <div className="flex items-center gap-3">
              <div className="border-ink bg-muted flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="Logo preview" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus
                    className="text-muted-foreground h-5 w-5"
                    strokeWidth={2}
                    aria-hidden
                  />
                )}
              </div>
              <input
                id="org-logo"
                type="file"
                accept="image/*"
                onChange={(e) => onLogo(e.target.files?.[0] ?? null)}
                className="text-muted-foreground file:border-ink file:bg-card text-sm file:mr-3 file:rounded-full file:border-2 file:px-3 file:py-1.5 file:text-sm file:font-semibold"
              />
              {logo ? (
                <Button
                  type="button"
                  tone="ghost"
                  size="icon-sm"
                  aria-label="Remove logo"
                  onClick={() => onLogo(null)}
                >
                  <X className="h-4 w-4" strokeWidth={2.25} />
                </Button>
              ) : null}
            </div>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Default sport" htmlFor="org-sport" error={errors.defaultSport?.message}>
              <Select
                value={watch("defaultSport")}
                onValueChange={(v) => setValue("defaultSport", v, { shouldValidate: true })}
              >
                <SelectTrigger id="org-sport">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPORTS.map((s) => (
                    <SelectItem key={s.key} value={s.key} disabled={s.comingSoon}>
                      {s.label}
                      {s.comingSoon ? " (soon)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Country" htmlFor="org-country" error={errors.country?.message}>
              <Select
                value={watch("country")}
                onValueChange={(v) => setValue("country", v, { shouldValidate: true })}
              >
                <SelectTrigger id="org-country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Timezone" htmlFor="org-tz" error={errors.timezone?.message}>
            <Select
              value={watch("timezone")}
              onValueChange={(v) => setValue("timezone", v, { shouldValidate: true })}
            >
              <SelectTrigger id="org-tz">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Button type="submit" tone="candy" disabled={busy} className="mt-1 w-full">
            {busy ? <Spinner className="text-white" /> : null}
            Create organization
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
