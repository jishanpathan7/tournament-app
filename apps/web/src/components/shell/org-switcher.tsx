"use client";

import { Check, ChevronsUpDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useSession } from "@/features/auth/use-session";
import { useSwitchOrg } from "@/features/orgs/use-orgs";
import { cn } from "@/lib/utils";

/** Active-org control (design system §13): current org + dropdown to switch between memberships. */
export function OrgSwitcher() {
  const { session } = useSession();
  const switchOrg = useSwitchOrg();

  const orgs = session?.organizations ?? [];
  const active = orgs.find((o) => o.id === session?.activeOrganizationId) ?? orgs[0];

  if (!active) return null;

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
        {orgs.map((org) => {
          const isActive = org.id === active.id;
          return (
            <DropdownMenuItem
              key={org.id}
              onSelect={() => {
                if (!isActive) switchOrg.mutate(org.id);
              }}
              className="justify-between"
            >
              <span className="flex flex-col">
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
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/console/settings">Organization settings</a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
