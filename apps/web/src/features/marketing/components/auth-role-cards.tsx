import Link from "next/link";
import { Eye, LayoutDashboard, Smartphone } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

const ROLES = [
  {
    title: "Organizer",
    description: "Full control · desktop",
    href: "/register",
    icon: LayoutDashboard,
  },
  {
    title: "Player",
    description: "Schedule & scores · mobile",
    href: "/portal",
    icon: Smartphone,
  },
  {
    title: "Public Viewer",
    description: "Live scores · no login",
    href: "/search",
    icon: Eye,
  },
] as const;

/** Role exploration cards below auth forms. */
export function AuthRoleCards() {
  return (
    <div>
      <div className="relative my-6 flex items-center gap-3">
        <div className="border-ink/20 h-px flex-1 border-t" />
        <span className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.24em]">
          Or explore as
        </span>
        <div className="border-ink/20 h-px flex-1 border-t" />
      </div>
      <div className="grid gap-3">
        {ROLES.map(({ title, description, href, icon: Icon }) => (
          <Link key={href} href={href} className="group block outline-none">
            <Card className="group-hover:shadow-sticker-md transition-[transform,box-shadow] duration-150 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5">
              <CardContent className="flex items-center gap-4 p-4">
                <span className="bg-mint border-ink shadow-sticker-xs flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2">
                  <Icon className="h-5 w-5" strokeWidth={2.25} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{title}</span>
                  <span className="text-muted-foreground text-sm">{description}</span>
                </span>
                <span className="text-candy-dark text-sm font-semibold opacity-0 transition-opacity group-hover:opacity-100">
                  →
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
