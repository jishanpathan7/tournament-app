"use client";

import { Building2, Check, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { useSession } from "@/features/auth/use-session";
import { useSwitchOrg } from "@/features/orgs/use-orgs";
import { errorMessage } from "@/lib/problem";
import { cn } from "@/lib/utils";

/** Pick which organization to enter. Selecting switches the active org → dashboard. */
export function OrganizationSelector() {
  const router = useRouter();
  const { session } = useSession();
  const switchOrg = useSwitchOrg();

  const orgs = session?.organizations ?? [];
  const activeId = session?.activeOrganizationId ?? null;

  const enter = (id: string) => {
    if (id === activeId) {
      router.replace("/console");
      return;
    }
    switchOrg.mutate(id, {
      onSuccess: () => router.replace("/console"),
      onError: (e) => toast.error(errorMessage(e, "Couldn't switch organization")),
    });
  };

  if (orgs.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Building2}
          eyebrow="No organizations"
          title="You're not in any organization yet"
          description="Create one to get started."
          action={
            <Button asChild tone="candy">
              <Link href="/onboarding">Create organization</Link>
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <p className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.28em]">
          Choose a workspace
        </p>
        <CardTitle className="text-2xl">Select an organization</CardTitle>
        <CardDescription>Pick which organization you want to work in.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {orgs.map((org) => {
          const isActive = org.id === activeId;
          const pending = switchOrg.isPending && switchOrg.variables === org.id;
          return (
            <button
              key={org.id}
              type="button"
              disabled={switchOrg.isPending}
              onClick={() => enter(org.id)}
              className={cn(
                "border-ink bg-card ease-bouncy flex items-center justify-between gap-3 rounded-2xl border-2 p-4 text-left outline-none transition-[transform,box-shadow] duration-150",
                "hover:shadow-sticker focus-visible:border-candy hover:-translate-x-0.5 hover:-translate-y-0.5",
                isActive ? "shadow-sticker-candy" : "shadow-sticker-xs",
                switchOrg.isPending && "opacity-70",
              )}
            >
              <span className="flex items-center gap-3">
                <span className="border-ink bg-candy-tint text-candy-dark flex h-10 w-10 items-center justify-center rounded-xl border-2 font-serif text-lg font-semibold">
                  {org.name.charAt(0).toUpperCase()}
                </span>
                <span className="flex flex-col">
                  <span className="font-semibold">{org.name}</span>
                  <span className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.16em]">
                    {org.role}
                    {isActive ? " · current" : ""}
                  </span>
                </span>
              </span>
              {pending ? (
                <Spinner />
              ) : isActive ? (
                <Check className="text-candy h-5 w-5" strokeWidth={2.5} />
              ) : null}
            </button>
          );
        })}

        <Button asChild tone="paper" size="sm" className="mt-2 self-start">
          <Link href="/onboarding">
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            New organization
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
