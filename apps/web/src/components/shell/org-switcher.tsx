"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { useSession } from "@/features/auth/use-session";
import { useSwitchOrg } from "@/features/orgs/use-orgs";
import { errorMessage } from "@/lib/problem";
import { cn } from "@/lib/utils";

/** Active-org control (design system §13): current org + switch, create, and manage. */
export function OrgSwitcher() {
  const { session } = useSession();
  const switchOrg = useSwitchOrg();
  const router = useRouter();

  const orgs = session?.organizations ?? [];
  const active = orgs.find((o) => o.id === session?.activeOrganizationId) ?? orgs[0];

  if (!active) return null;

  // Show at most a handful inline; deep lists go to the full selector.
  const inlineOrgs = orgs.slice(0, 6);
  const hasMore = orgs.length > inlineOrgs.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="border-ink bg-card hover:bg-muted focus-visible:border-candy shadow-sticker-xs flex h-9 max-w-[13rem] items-center gap-2 rounded-full border-2 px-3 text-sm font-semibold outline-none transition-colors disabled:opacity-60"
        disabled={switchOrg.isPending}
      >
        {switchOrg.isPending ? <Spinner /> : null}
        <span className="truncate">{active.name}</span>
        <ChevronsUpDown className="text-muted-foreground h-4 w-4 shrink-0" strokeWidth={2.25} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        {inlineOrgs.map((org) => {
          const isActive = org.id === active.id;
          return (
            <DropdownMenuItem
              key={org.id}
              onSelect={() => {
                if (!isActive)
                  switchOrg.mutate(org.id, {
                    onError: (e) => toast.error(errorMessage(e, "Couldn't switch organization")),
                  });
              }}
              className="justify-between"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{org.name}</span>
                <span className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.16em]">
                  {org.role}
                </span>
              </span>
              <Check
                className={cn("text-candy h-4 w-4 shrink-0", !isActive && "opacity-0")}
                strokeWidth={2.5}
              />
            </DropdownMenuItem>
          );
        })}
        {hasMore ? (
          <DropdownMenuItem onSelect={() => router.push("/select-organization")}>
            View all organizations
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/onboarding")}>
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Create organization
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/console/settings">Organization settings</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
