"use client";

import type { TournamentRole } from "@tournament/api-client";
import { Check, Copy, Mail } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

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

export function InviteMemberDialog({
  tournamentId,
  open,
  onOpenChange,
}: {
  tournamentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TournamentRole>("organizer");
  const [copied, setCopied] = useState(false);
  const invite = useInviteMember(tournamentId);
  const generateLink = useGenerateInviteLink(tournamentId);

  const selectedRole = ROLE_OPTIONS.find((o) => o.value === role)!;

  function handleEmailInvite(e: React.FormEvent) {
    e.preventDefault();
    invite.mutate(
      { email, tournamentRole: role },
      {
        onSuccess: () => {
          onOpenChange(false);
          setEmail("");
          setRole("organizer");
        },
      },
    );
  }

  function handleCopyLink() {
    generateLink.mutate(role, {
      onSuccess: (data) => {
        const url = `${window.location.origin}/join?token=${data.token}`;
        void navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
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
            {/* Responsibility description */}
            <p className="text-muted-foreground text-xs">
              <span className="text-foreground font-medium">{selectedRole.label}:</span>{" "}
              {selectedRole.responsibility.toLowerCase()}. Access: {selectedRole.access}.
            </p>
          </div>

          {/* Email invite */}
          <form onSubmit={handleEmailInvite} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Send invite by email</Label>
              <div className="flex gap-2">
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
                <Button type="submit" disabled={invite.isPending || !email} className="shrink-0">
                  {invite.isPending ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  <span className="ml-2">Send</span>
                </Button>
              </div>
            </div>
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
