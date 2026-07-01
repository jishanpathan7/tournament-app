"use client";

import { LogOut, Settings, User } from "lucide-react";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback, initials } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLogout } from "@/features/auth/use-auth-actions";
import { useSession } from "@/features/auth/use-session";

export function UserMenu() {
  const router = useRouter();
  const { session } = useSession();
  const logout = useLogout();

  if (!session) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="focus-visible:border-candy rounded-full outline-none"
        aria-label="Account menu"
      >
        <Avatar className="shadow-sticker-xs">
          <AvatarFallback>{initials(session.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="normal-case tracking-normal">
          <span className="text-foreground block truncate font-sans text-sm font-semibold normal-case tracking-normal">
            {session.name}
          </span>
          <span className="text-muted-foreground block truncate font-sans text-xs font-normal normal-case tracking-normal">
            {session.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/console/settings/profile")}>
          <User className="h-4 w-4" strokeWidth={2.25} />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/console/settings")}>
          <Settings className="h-4 w-4" strokeWidth={2.25} />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => logout.mutate(undefined, { onSuccess: () => router.replace("/login") })}
          className="text-pink-dark focus:bg-pink-tint focus:text-pink-dark"
        >
          <LogOut className="h-4 w-4" strokeWidth={2.25} />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
