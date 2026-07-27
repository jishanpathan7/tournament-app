"use client";

import type { TournamentRole } from "@tournament/api-client";
import { Check, Copy, Mail } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

import { useGenerateInviteLink, useInviteMember } from "../use-tournament-members";

interface RoleOption {
  value: TournamentRole;
  label: string;
  responsibility: string;
  access: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    value: "tournament_admin",
    label: "Tournament Admin",
    responsibility: "Full control",
    access: "Draw · registrations · schedule · scoring · settings",
  },
  {
    value: "organizer",
    label: "Organizer",
    responsibility: "Manages the event day-to-day",
    access: "Draw · registrations · schedule · scoring",
  },
  {
    value: "court_manager",
    label: "Court Manager",
    responsibility: "Assigns courts and manages the schedule",
    access: "Schedule · court assignments",
  },
  {
    value: "checkin_staff",
    label: "Check-in Staff",
    responsibility: "Checks in players at the door",
    access: "Check-in console only",
  },
  {
    value: "scorekeeper",
    label: "Scorekeeper",
    responsibility: "Enters match scores",
    access: "Live scoring tab only",
  },
  {
    value: "viewer",
    label: "Viewer",
    responsibility: "Can see everything, change nothing",
    access: "Read-only",
  },
];

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

function extractEmails(raw: string): string[] {
  return [...new Set((raw.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase()))];
}

export function InviteMemberDialog({
  tournamentId,
  open,
  onOpenChange,
}: {
  tournamentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [emailsRaw, setEmailsRaw] = useState("");
  const [role, setRole] = useState<TournamentRole>("organizer");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const invite = useInviteMember(tournamentId);
  const generateLink = useGenerateInviteLink(tournamentId);

  const selectedRole = ROLE_OPTIONS.find((o) => o.value === role)!;
  const parsedEmails = extractEmails(emailsRaw);
  const hasEmails = parsedEmails.length > 0;

  async function handleEmailInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!hasEmails) return;
    setSending(true);
    let ok = 0;
    let failed = 0;
    for (const email of parsedEmails) {
      await new Promise<void>((resolve) => {
        invite.mutate(
          { email, tournamentRole: role },
          {
            onSuccess: () => {
              ok++;
              resolve();
            },
            onError: () => {
              failed++;
              resolve();
            },
          },
        );
      });
    }
    setSending(false);
    if (ok > 0) {
      toast.success(ok === 1 ? "Invite sent" : `${ok} invite${ok === 1 ? "" : "s"} sent`);
    }
    if (failed > 0) {
      toast.error(`${failed} invite${failed === 1 ? "" : "s"} failed`);
    }
    if (ok > 0) {
      onOpenChange(false);
      setEmailsRaw("");
      setRole("organizer");
    }
  }

  function handleCopyLink() {
    generateLink.mutate(role, {
      onSuccess: (data) => {
        const url = `${window.location.origin}/join?token=${data.token}`;
        const onCopied = () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        };
        if (navigator.clipboard) {
          navigator.clipboard
            .writeText(url)
            .then(onCopied)
            .catch(() => {
              toast.error("Couldn't copy to clipboard", { description: url });
            });
        } else {
          // Fallback for browsers without clipboard API
          const ta = document.createElement("textarea");
          ta.value = url;
          ta.style.cssText = "position:fixed;left:-9999px;top:-9999px";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          try {
            document.execCommand("copy");
            onCopied();
          } catch {
            toast.error("Couldn't copy to clipboard", { description: url });
          }
          document.body.removeChild(ta);
        }
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add staff</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Role picker */}
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">What will they do?</Label>
            <Select value={role} onValueChange={(v) => setRole(v as TournamentRole)}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-muted-foreground ml-2 text-xs">{opt.responsibility}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              <span className="text-foreground font-medium">{selectedRole.label}:</span>{" "}
              {selectedRole.responsibility.toLowerCase()}. Access: {selectedRole.access}.
            </p>
          </div>

          {/* Email invite — supports single address or comma/newline-separated bulk paste */}
          <form onSubmit={handleEmailInvite} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Send invite by email</Label>
              <textarea
                id="invite-email"
                rows={3}
                placeholder={"colleague@example.com\nOr paste multiple, comma-separated"}
                value={emailsRaw}
                onChange={(e) => setEmailsRaw(e.target.value)}
                autoFocus
                className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {parsedEmails.length > 1 && (
                <p className="text-muted-foreground text-xs">
                  {parsedEmails.length} addresses detected
                </p>
              )}
            </div>
            <Button type="submit" disabled={sending || !hasEmails} className="w-full">
              {sending ? <Spinner className="mr-2 h-4 w-4" /> : <Mail className="mr-2 h-4 w-4" />}
              {sending
                ? "Sending…"
                : parsedEmails.length > 1
                  ? `Send ${parsedEmails.length} invites`
                  : "Send invite"}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs">or</span>
            <div className="bg-border h-px flex-1" />
          </div>

          {/* Copy link */}
          <div className="space-y-1.5">
            <Label>Copy invite link</Label>
            <p className="text-muted-foreground text-xs">
              Share a link anyone can use to join with this role. Expires in 7 days.
            </p>
            <Button
              type="button"
              tone="paper"
              className="w-full"
              onClick={handleCopyLink}
              disabled={generateLink.isPending || copied}
            >
              {generateLink.isPending ? (
                <Spinner className="mr-2 h-4 w-4" />
              ) : copied ? (
                <Check className="text-mint mr-2 h-4 w-4" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {copied ? "Copied!" : "Copy invite link"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
