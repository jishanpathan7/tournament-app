"use client";

import { Bell, BellOff, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useOrgSettings, useUpdateOrgSettings } from "@/features/settings/use-settings";

// ─── Accessible toggle switch (inline — no shadcn Switch dep required) ──────────────
interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
}

function Toggle({ checked, onChange, disabled, id, ariaLabel }: ToggleProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-[#1E293B]",
        "transition-colors duration-200 focus-visible:outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-[#FFFDF5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#8B5CF6]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-[#8B5CF6]" : "bg-[#E2E8F0]",
      ].join(" ")}
    >
      <span
        className={[
          "pointer-events-none block h-4 w-4 rounded-full border-2 border-[#1E293B] bg-white shadow-sm",
          "transition-transform duration-200",
          checked ? "translate-x-[22px]" : "translate-x-[2px]",
        ].join(" ")}
      />
    </button>
  );
}

// ─── Setting row ──────────────────────────────────────────────────────────────────
interface SettingRowProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: React.ReactNode;
  control: React.ReactNode;
}

function SettingRow({ id, icon, title, description, badge, control }: SettingRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-[#1E293B] bg-[#F1F5F9]">
          {icon}
        </div>
        <div className="min-w-0">
          <label
            htmlFor={id}
            className="flex cursor-pointer items-center gap-2 font-semibold text-[#1E293B]"
          >
            {title}
            {badge}
          </label>
          <p className="mt-0.5 text-sm leading-relaxed text-[#475569]">{description}</p>
        </div>
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────────
export function OrgSettingsPanel() {
  const { data: org, isLoading } = useOrgSettings();
  const { mutate: updateSettings, isPending } = useUpdateOrgSettings();

  function handleEmailsToggle(next: boolean) {
    updateSettings(
      { emailsEnabled: next },
      {
        onSuccess: () => {
          toast.success(next ? "Email notifications enabled" : "Email notifications disabled", {
            description: next
              ? "Participants will now receive emails."
              : "No emails will be sent to any participants or admins.",
          });
        },
        onError: () => {
          toast.error("Failed to update setting", {
            description: "Please try again. If the problem persists, contact support.",
          });
        },
      },
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#94A3B8]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const emailsEnabled = org?.emailsEnabled ?? true;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* ── Organisation ── */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[#8B5CF6]" />
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[#8B5CF6]">
            Organisation
          </h2>
        </div>
        <Card className="border-2 border-[#1E293B] shadow-[4px_4px_0_#1E293B]">
          <CardHeader className="pb-0">
            <CardTitle className="text-base font-semibold text-[#1E293B]">
              {org?.name ?? "—"}
            </CardTitle>
            <CardDescription className="font-mono text-xs uppercase tracking-wide text-[#94A3B8]">
              {org?.slug ?? "—"} · {org?.plan ?? "free"} plan
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-sm text-[#64748B]">
              Contact support to update your organisation name or slug.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* ── Notifications ── */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Bell className="h-4 w-4 text-[#8B5CF6]" />
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[#8B5CF6]">
            Notifications
          </h2>
        </div>
        <Card className="border-2 border-[#1E293B] shadow-[4px_4px_0_#1E293B]">
          <CardContent className="divide-y divide-[#E2E8F0] px-6 pb-2 pt-0">
            <SettingRow
              id="emails-enabled"
              icon={
                emailsEnabled ? (
                  <Bell className="h-4 w-4 text-[#8B5CF6]" />
                ) : (
                  <BellOff className="h-4 w-4 text-[#94A3B8]" />
                )
              }
              title="Email notifications"
              description={
                emailsEnabled
                  ? "Participants and admins receive registration updates, draw announcements, and scorekeeper invites."
                  : "All outbound emails are suppressed. Participants will not receive any emails from this organisation's tournaments. Account emails (verify, password reset) are unaffected."
              }
              badge={
                !emailsEnabled ? (
                  <Badge tone="pink" className="text-[10px]">
                    Off
                  </Badge>
                ) : null
              }
              control={
                <Toggle
                  id="emails-enabled"
                  checked={emailsEnabled}
                  onChange={handleEmailsToggle}
                  disabled={isPending}
                  ariaLabel="Toggle email notifications"
                />
              }
            />
          </CardContent>
        </Card>

        {!emailsEnabled && (
          <div className="mt-3 flex items-start gap-3 rounded-xl border-2 border-[#F472B6] bg-[#FCE7F3] px-4 py-3">
            <BellOff className="mt-0.5 h-4 w-4 shrink-0 text-[#DB2777]" />
            <p className="text-sm leading-relaxed text-[#9D174D]">
              <strong className="font-semibold">Emails are off</strong> — no notifications will be
              sent to participants or organizers for any tournament in this account. Enable this
              setting before your event goes live.
            </p>
          </div>
        )}
      </section>

      <Separator className="bg-[#E2E8F0]" />
      <p className="font-mono text-xs uppercase tracking-widest text-[#CBD5E1]">
        More settings coming soon — timezone, branding, and integrations.
      </p>
    </div>
  );
}
