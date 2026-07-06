"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Stepper } from "@/components/ui/stepper";
import { toast } from "@/components/ui/sonner";
import { OptionCard } from "@/features/tournaments/components/wizard/option-card";
import {
  FORMATS,
  PARTICIPANT_KINDS,
  SPORTS,
  VISIBILITIES,
  getFormat,
  getSport,
} from "@/features/tournaments/config";
import { useCreateTournamentFlow } from "@/features/tournaments/use-tournaments";
import { slugify, useTournamentDraft, type DivisionParticipantKind } from "@/features/tournaments/use-tournament-draft";
import {
  type BasicInfoValues,
  type DivisionsValues,
  type ScheduleValues,
  basicInfoSchema,
  divisionsSchema,
  scheduleSchema,
} from "@/features/tournaments/wizard-schemas";
import { errorMessage } from "@/lib/problem";
import { cn } from "@/lib/utils";

function divisionKinds(kinds: readonly string[]): DivisionParticipantKind[] {
  return kinds.filter((k): k is DivisionParticipantKind => k !== "squad");
}

const STEPS = ["Basics", "Sport", "Format", "Divisions", "Schedule", "Review"];

export function CreateTournamentWizard() {
  const step = useTournamentDraft((s) => s.step);
  const setStep = useTournamentDraft((s) => s.setStep);

  const goNext = () => setStep(Math.min(step + 1, STEPS.length - 1));
  const goBack = () => setStep(Math.max(step - 1, 0));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader
        eyebrow="New tournament"
        title="Create a tournament"
        actions={
          <Button asChild tone="ghost" size="sm">
            <Link href="/console/tournaments">Cancel</Link>
          </Button>
        }
      />
      <Stepper steps={STEPS} current={step} onStepClick={setStep} />
      <Card className="p-6">
        {step === 0 && <BasicInfoStep onNext={goNext} />}
        {step === 1 && <SportStep onNext={goNext} onBack={goBack} />}
        {step === 2 && <FormatStep onNext={goNext} onBack={goBack} />}
        {step === 3 && <DivisionsStep onNext={goNext} onBack={goBack} />}
        {step === 4 && <ScheduleStep onNext={goNext} onBack={goBack} />}
        {step === 5 && <ReviewStep onBack={goBack} />}
      </Card>
    </div>
  );
}

function StepNav({
  onBack,
  submitLabel = "Continue",
}: {
  onBack?: () => void;
  submitLabel?: string;
}) {
  return (
    <div className="mt-2 flex items-center justify-between">
      {onBack ? (
        <Button type="button" tone="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
      ) : (
        <span />
      )}
      <Button type="submit" tone="candy" size="sm">
        {submitLabel}
      </Button>
    </div>
  );
}

// ---- step 1: basics ----

function BasicInfoStep({ onNext }: { onNext: () => void }) {
  const draft = useTournamentDraft((s) => s.draft);
  const patch = useTournamentDraft((s) => s.patch);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, dirtyFields },
  } = useForm<BasicInfoValues>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: { name: draft.name, slug: draft.slug, visibility: draft.visibility },
  });

  // Auto-derive the slug from the name until the user edits it directly.
  const name = watch("name");
  useEffect(() => {
    if (!dirtyFields.slug) setValue("slug", slugify(name), { shouldValidate: !!name });
  }, [name, dirtyFields.slug, setValue]);

  return (
    <form
      onSubmit={handleSubmit((values) => {
        patch(values);
        onNext();
      })}
      className="flex flex-col gap-5"
      noValidate
    >
      <Field label="Tournament name" htmlFor="name" error={errors.name?.message}>
        <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
      </Field>
      <Field
        label="Your tournament's web address"
        htmlFor="slug"
        error={errors.slug?.message}
      >
        <Input id="slug" aria-invalid={!!errors.slug} {...register("slug")} />
        {watch("slug") ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-mono">{process.env.NEXT_PUBLIC_APP_URL}/t/</span>
            <span className="font-mono font-semibold text-foreground">{watch("slug")}</span>
          </p>
        ) : null}
      </Field>
      <Field label="Visibility" htmlFor="visibility" error={errors.visibility?.message}>
        <Select
          value={watch("visibility")}
          onValueChange={(v) => setValue("visibility", v as BasicInfoValues["visibility"])}
        >
          <SelectTrigger id="visibility">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VISIBILITIES.map((v) => (
              <SelectItem key={v.value} value={v.value}>
                {v.label} — {v.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <StepNav />
    </form>
  );
}

// ---- step 2: sport ----

function SportStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const draft = useTournamentDraft((s) => s.draft);
  const patch = useTournamentDraft((s) => s.patch);

  const select = (key: string) => {
    const sport = getSport(key);
    if (!sport || sport.comingSoon) return;
    // Keep divisions valid for the newly chosen sport.
    const kinds = divisionKinds(sport.participantKinds);
    const divisions = draft.divisions.map((d) =>
      kinds.includes(d.participantType) ? d : { ...d, participantType: kinds[0]! },
    );
    patch({ sportKey: key, divisions });
    onNext();
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted-foreground text-sm">Pick the sport. More are on the way.</p>
      <div role="radiogroup" aria-label="Sport" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SPORTS.map((sport) => (
          <OptionCard
            key={sport.key}
            icon={sport.icon}
            label={sport.label}
            selected={draft.sportKey === sport.key}
            disabled={sport.comingSoon}
            comingSoon={sport.comingSoon}
            onSelect={() => select(sport.key)}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Button tone="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
        <Button tone="candy" size="sm" onClick={onNext} disabled={!getSport(draft.sportKey)}>
          Continue
        </Button>
      </div>
    </div>
  );
}

// ---- step 3: format ----

type PlayerRange = "small" | "medium" | "large";

const PLAYER_RANGES: { key: PlayerRange; label: string; sublabel: string }[] = [
  { key: "small",  label: "Up to 16",  sublabel: "players / pairs" },
  { key: "medium", label: "17 – 32",   sublabel: "players / pairs" },
  { key: "large",  label: "33 or more", sublabel: "players / pairs" },
];

function recommendedFormat(range: PlayerRange | null): string | null {
  if (!range) return null;
  if (range === "small") return "round_robin";
  return "single_elim";
}

function recommendationLabel(range: PlayerRange): string {
  if (range === "small")
    return "Round Robin works great for smaller groups — everyone gets to play everyone.";
  return "Single Elimination handles large fields quickly and keeps the bracket clean.";
}

function FormatStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const draft = useTournamentDraft((s) => s.draft);
  const patch = useTournamentDraft((s) => s.patch);
  const [range, setRange] = useState<PlayerRange | null>(null);
  const rec = recommendedFormat(range);

  const select = (key: string) => {
    const format = getFormat(key);
    if (!format || format.comingSoon) return;
    patch({ format: format.key });
    onNext();
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted-foreground text-sm">How should matches be structured?</p>

      {/* Player count picker */}
      <div className="flex flex-col gap-2">
        <p className="text-2xs font-mono font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          How many players do you expect?
        </p>
        <div className="flex flex-wrap gap-2">
          {PLAYER_RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={cn(
                "flex flex-col rounded-xl border-2 px-4 py-2 text-left transition-colors",
                range === r.key
                  ? "border-candy bg-candy-tint text-candy-dark"
                  : "border-border hover:border-candy/50",
              )}
            >
              <span className="text-sm font-semibold">{r.label}</span>
              <span className="text-2xs text-muted-foreground">{r.sublabel}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recommendation callout */}
      {range && (
        <p className="rounded-xl border-2 border-mint bg-mint-tint px-4 py-2.5 text-sm text-mint-dark font-medium">
          {recommendationLabel(range)}
        </p>
      )}

      <div role="radiogroup" aria-label="Format" className="flex flex-col gap-3">
        {FORMATS.map((format) => (
          <OptionCard
            key={format.key}
            icon={format.icon}
            label={format.label}
            description={format.description}
            selected={draft.format === format.key}
            disabled={format.comingSoon}
            comingSoon={format.comingSoon}
            recommended={rec === format.key}
            onSelect={() => select(format.key)}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Button tone="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
        <Button
          tone="candy"
          size="sm"
          onClick={onNext}
          disabled={getFormat(draft.format)?.comingSoon}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

// ---- step 4: divisions ----

function DivisionsStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const draft = useTournamentDraft((s) => s.draft);
  const patch = useTournamentDraft((s) => s.patch);
  const sport = getSport(draft.sportKey);
  const kinds = divisionKinds(sport?.participantKinds ?? ["individual"]);

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DivisionsValues>({
    resolver: zodResolver(divisionsSchema),
    defaultValues: { divisions: draft.divisions },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "divisions" });

  return (
    <form
      onSubmit={handleSubmit((values) => {
        patch({ divisions: values.divisions });
        onNext();
      })}
      className="flex flex-col gap-5"
      noValidate
    >
      <p className="text-muted-foreground text-sm">
        Divisions are the brackets within your tournament (e.g. Men&apos;s Singles).
      </p>
      <div className="flex flex-col gap-3">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="border-border flex items-end gap-3 rounded-xl border-2 p-3"
          >
            <Field
              label="Name"
              htmlFor={`division-${index}`}
              error={errors.divisions?.[index]?.name?.message}
              className="flex-1"
            >
              <Input
                id={`division-${index}`}
                aria-invalid={!!errors.divisions?.[index]?.name}
                {...register(`divisions.${index}.name`)}
              />
            </Field>
            <Field label="Type" htmlFor={`division-type-${index}`} className="w-36">
              <Select
                value={watch(`divisions.${index}.participantType`)}
                onValueChange={(v) =>
                  setValue(
                    `divisions.${index}.participantType`,
                    v as DivisionsValues["divisions"][number]["participantType"],
                  )
                }
              >
                <SelectTrigger id={`division-type-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kinds.map((k) => (
                    <SelectItem key={k} value={k}>
                      {PARTICIPANT_KINDS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button
              type="button"
              tone="ghost"
              size="icon"
              aria-label={`Remove division ${index + 1}`}
              disabled={fields.length <= 1}
              onClick={() => remove(index)}
            >
              <Trash2 className="h-4 w-4" strokeWidth={2.25} />
            </Button>
          </div>
        ))}
      </div>
      {typeof errors.divisions?.message === "string" ? (
        <p className="text-pink text-2xs font-mono uppercase tracking-[0.16em]">
          {errors.divisions.message}
        </p>
      ) : null}
      <Button
        type="button"
        tone="paper"
        size="sm"
        className="self-start"
        onClick={() =>
          append({
            name: "",
            participantType: (kinds[0] ?? "individual") as DivisionsValues["divisions"][number]["participantType"],
          })
        }
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        Add division
      </Button>
      <StepNav onBack={onBack} />
    </form>
  );
}

// ---- step 5: schedule ----

function ScheduleStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const draft = useTournamentDraft((s) => s.draft);
  const patch = useTournamentDraft((s) => s.patch);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ScheduleValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: { startsAt: draft.startsAt, endsAt: draft.endsAt },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => {
        patch(values);
        onNext();
      })}
      className="flex flex-col gap-5"
      noValidate
    >
      <p className="text-muted-foreground text-sm">Optional — you can set dates later.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Starts" htmlFor="startsAt">
          <Input id="startsAt" type="date" {...register("startsAt")} />
        </Field>
        <Field label="Ends" htmlFor="endsAt" error={errors.endsAt?.message}>
          <Input id="endsAt" type="date" aria-invalid={!!errors.endsAt} {...register("endsAt")} />
        </Field>
      </div>
      <StepNav onBack={onBack} submitLabel="Review" />
    </form>
  );
}

// ---- step 6: review ----

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.18em]">
        {label}
      </span>
      <span className="text-right text-sm font-semibold">{value}</span>
    </div>
  );
}

function ReviewStep({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const draft = useTournamentDraft((s) => s.draft);
  const reset = useTournamentDraft((s) => s.reset);
  const create = useCreateTournamentFlow();

  const submit = () => {
    create.mutate(draft, {
      onSuccess: (tournament) => {
        toast.success("Tournament created");
        reset();
        router.replace(`/console/tournaments/${tournament.id}`);
      },
      onError: (error) => toast.error(errorMessage(error, "Could not create tournament")),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="divide-border divide-y">
        <ReviewRow label="Name" value={draft.name || "—"} />
        <ReviewRow label="Web address" value={draft.slug ? `${process.env.NEXT_PUBLIC_APP_URL}/t/${draft.slug}` : "—"} />
        <ReviewRow label="Visibility" value={draft.visibility} />
        <ReviewRow label="Sport" value={getSport(draft.sportKey)?.label ?? draft.sportKey} />
        <ReviewRow label="Format" value={getFormat(draft.format)?.label ?? draft.format} />
        <ReviewRow
          label="Divisions"
          value={
            draft.divisions
              .map((d) => d.name)
              .filter(Boolean)
              .join(", ") || "—"
          }
        />
        {draft.startsAt ? <ReviewRow label="Starts" value={draft.startsAt} /> : null}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <Button tone="ghost" size="sm" onClick={onBack} disabled={create.isPending}>
          Back
        </Button>
        <Button tone="candy" size="sm" onClick={submit} disabled={create.isPending}>
          {create.isPending ? <Spinner className="text-white" /> : null}
          Create tournament
        </Button>
      </div>
    </div>
  );
}
