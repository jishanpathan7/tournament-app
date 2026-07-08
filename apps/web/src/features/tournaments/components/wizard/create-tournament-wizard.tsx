"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

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
import { FORMATS, SPORTS, VISIBILITIES, getFormat, getSport } from "@/features/tournaments/config";
import { useCreateTournamentFlow } from "@/features/tournaments/use-tournaments";
import {
  divisionsFromEventType,
  slugify,
  useTournamentDraft,
  type EventTypePreset,
} from "@/features/tournaments/use-tournament-draft";
import {
  eventTypeSchema,
  quickEventSchema,
  type EventTypeValues,
} from "@/features/tournaments/wizard-schemas";
import { env } from "@/lib/env";
import { errorMessage } from "@/lib/problem";
import { cn } from "@/lib/utils";

const STEPS = ["Your event", "How they'll compete", "Review"];

const EVENT_TYPES: { key: EventTypePreset; label: string; description: string }[] = [
  { key: "singles", label: "Singles", description: "One player per entry." },
  { key: "doubles", label: "Doubles", description: "Players register individually, then pair up." },
  {
    key: "both",
    label: "Singles & doubles",
    description: "Run both events in one tournament.",
  },
];

export function CreateTournamentWizard() {
  const step = useTournamentDraft((s) => s.step);
  const setStep = useTournamentDraft((s) => s.setStep);

  const goNext = () => setStep(Math.min(step + 1, STEPS.length - 1));
  const goBack = () => setStep(Math.max(step - 1, 0));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader
        eyebrow="New tournament"
        title="Create your event"
        description="Three quick steps — we'll handle the technical setup."
        actions={
          <Button asChild tone="ghost" size="sm">
            <Link href="/console/tournaments">Cancel</Link>
          </Button>
        }
      />
      <Stepper steps={STEPS} current={step} onStepClick={setStep} />
      <Card className="p-6">
        {step === 0 && <QuickEventStep onNext={goNext} />}
        {step === 1 && <EventTypeStep onNext={goNext} onBack={goBack} />}
        {step === 2 && <ReviewStep onBack={goBack} />}
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

function QuickEventStep({ onNext }: { onNext: () => void }) {
  const draft = useTournamentDraft((s) => s.draft);
  const patch = useTournamentDraft((s) => s.patch);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(quickEventSchema),
    defaultValues: {
      name: draft.name,
      slug: draft.slug,
      visibility: draft.visibility,
      sportKey: draft.sportKey,
      format: draft.format,
      startsAt: draft.startsAt,
      endsAt: draft.endsAt,
    },
  });

  const name = watch("name");
  useEffect(() => {
    if (name) setValue("slug", slugify(name), { shouldValidate: true });
  }, [name, setValue]);

  return (
    <form
      onSubmit={handleSubmit((values) => {
        patch({
          name: values.name,
          slug: values.slug,
          visibility: values.visibility,
          sportKey: values.sportKey,
          format: values.format,
          startsAt: values.startsAt ?? "",
          endsAt: values.endsAt ?? "",
        });
        onNext();
      })}
      className="flex flex-col gap-5"
      noValidate
    >
      <Field label="Tournament name" htmlFor="name" error={errors.name?.message}>
        <Input id="name" placeholder="SIBL Badminton 2026" {...register("name")} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Event date (optional)" htmlFor="startsAt">
          <Input id="startsAt" type="date" {...register("startsAt")} />
        </Field>
        <Field label="End date (optional)" htmlFor="endsAt">
          <Input id="endsAt" type="date" {...register("endsAt")} />
        </Field>
      </div>

      <button
        type="button"
        className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm font-semibold"
        onClick={() => setAdvancedOpen((v) => !v)}
      >
        <ChevronDown className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-180")} />
        More options
      </button>

      {advancedOpen ? (
        <div className="flex flex-col gap-4 rounded-xl border-2 border-dashed p-4">
          <Field label="Public link" htmlFor="slug" error={errors.slug?.message}>
            <div className="flex flex-col gap-1">
              <Input id="slug" {...register("slug")} />
              <p className="text-muted-foreground text-xs">
                {env.appUrl}/t/{watch("slug") || "your-event"}
              </p>
            </div>
          </Field>
          <Field label="Who can see it" htmlFor="visibility">
            <Select
              value={watch("visibility")}
              onValueChange={(v) =>
                setValue("visibility", v as typeof draft.visibility, { shouldValidate: true })
              }
            >
              <SelectTrigger id="visibility">
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
          <Field label="Sport" htmlFor="sport-badminton">
            <div
              className="grid gap-2 sm:grid-cols-2"
              role="group"
              aria-labelledby="sport-badminton"
            >
              {SPORTS.map((sport) => (
                <OptionCard
                  key={sport.key}
                  selected={watch("sportKey") === sport.key}
                  disabled={sport.comingSoon}
                  label={sport.label}
                  description={sport.comingSoon ? "Coming soon" : "Available now"}
                  comingSoon={sport.comingSoon}
                  onSelect={() => setValue("sportKey", sport.key)}
                />
              ))}
            </div>
          </Field>
          <Field label="Bracket format" htmlFor="format-rr">
            <div className="grid gap-2" role="group" aria-labelledby="format-rr">
              {FORMATS.map((format) => (
                <OptionCard
                  key={format.key}
                  selected={watch("format") === format.key}
                  disabled={format.comingSoon}
                  label={format.label}
                  description={format.description}
                  comingSoon={format.comingSoon}
                  onSelect={() => setValue("format", format.key)}
                />
              ))}
            </div>
          </Field>
        </div>
      ) : null}

      <StepNav submitLabel="Continue" />
    </form>
  );
}

function EventTypeStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const draft = useTournamentDraft((s) => s.draft);
  const patch = useTournamentDraft((s) => s.patch);

  const { handleSubmit, watch, setValue } = useForm<EventTypeValues>({
    resolver: zodResolver(eventTypeSchema),
    defaultValues: { eventType: draft.eventType },
  });

  const selected = watch("eventType");

  return (
    <form
      onSubmit={handleSubmit((values) => {
        patch({
          eventType: values.eventType,
          divisions: divisionsFromEventType(values.eventType),
        });
        onNext();
      })}
      className="flex flex-col gap-5"
      noValidate
    >
      <p className="text-muted-foreground text-sm">
        Pick what players will compete in. We&apos;ll set up the right categories automatically.
      </p>
      <div className="grid gap-3">
        {EVENT_TYPES.map((opt) => (
          <OptionCard
            key={opt.key}
            selected={selected === opt.key}
            label={opt.label}
            description={opt.description}
            onSelect={() => setValue("eventType", opt.key)}
          />
        ))}
      </div>
      <StepNav onBack={onBack} />
    </form>
  );
}

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

  const eventLabel = EVENT_TYPES.find((e) => e.key === draft.eventType)?.label ?? draft.eventType;

  const submit = () => {
    create.mutate(draft, {
      onSuccess: (tournament) => {
        toast.success("Tournament created — open registration when you're ready");
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
        <ReviewRow label="Event types" value={eventLabel} />
        <ReviewRow label="Sport" value={getSport(draft.sportKey)?.label ?? draft.sportKey} />
        <ReviewRow label="Format" value={getFormat(draft.format)?.label ?? draft.format} />
        {draft.startsAt ? <ReviewRow label="Date" value={draft.startsAt} /> : null}
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
