"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { Brand } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/features/auth/use-auth-actions";
import { useSession } from "@/features/auth/use-session";

/** Minimal top bar for onboarding: brand + (when signed in) email and a sign-out escape. */
export function OnboardingHeader() {
  const { session } = useSession();
  const logout = useLogout();
  const router = useRouter();

  return (
    <header className="border-ink bg-paper/90 flex h-16 items-center justify-between border-b-2 px-4 backdrop-blur-md md:px-8">
      <Brand href="/console" />
      {session ? (
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground hidden text-sm sm:inline">{session.email}</span>
          <Button
            tone="ghost"
            size="sm"
            onClick={() => logout.mutate(undefined, { onSuccess: () => router.replace("/login") })}
          >
            <LogOut className="h-4 w-4" strokeWidth={2.25} />
            Sign out
          </Button>
        </div>
      ) : null}
    </header>
  );
}
