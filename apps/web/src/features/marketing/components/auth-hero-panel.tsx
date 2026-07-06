import Link from "next/link";
import { Feather, Gamepad2, Swords, Trophy } from "lucide-react";

import { Brand } from "@/components/shell/brand";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

const SPORTS = [
  { label: "Badminton", icon: Feather },
  { label: "Cricket", icon: Trophy },
  { label: "Chess", icon: Swords },
  { label: "Esports", icon: Gamepad2 },
] as const;

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Organizer", href: "/register" },
  { label: "Player", href: "/portal" },
  { label: "Public", href: "/search" },
] as const;

/** Shared bottom nav pill for auth hero + marketing footer. */
export function MarketingBottomNav({ className }: { className?: string }) {
  return (
    <nav
      className={cn(
        "border-paper/15 bg-ink/80 flex flex-wrap items-center gap-1 rounded-full border px-2 py-1.5 backdrop-blur-sm",
        className,
      )}
      aria-label="Site sections"
    >
      {NAV_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-paper/70 hover:text-paper rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
        >
          {link.label}
        </Link>
      ))}
      <Link
        href="/login"
        className="bg-candy text-paper border-paper/20 ml-1 rounded-full border px-3 py-1.5 text-xs font-semibold"
      >
        Sign in
      </Link>
    </nav>
  );
}

/** Left panel for auth split layout — dark hero with product story. */
export function AuthHeroPanel() {
  return (
    <div
      className="bg-ink text-paper relative flex min-h-[240px] flex-col justify-between overflow-hidden px-6 py-8 md:min-h-screen md:w-[58%] md:px-10 md:py-10 lg:px-14"
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(255,253,245,0.08) 1px, transparent 0)",
        backgroundSize: "24px 24px",
      }}
    >
      <div>
        <Brand href="/" inverted />
        <p className="text-yellow mt-10 font-mono text-xs font-semibold uppercase tracking-[0.28em]">
          Tournament operating system
        </p>
        <h1 className="mt-4 max-w-lg font-serif text-3xl font-semibold leading-tight tracking-tight md:text-4xl lg:text-[2.75rem]">
          Run any tournament like a <span className="text-candy italic">pro.</span>
        </h1>
        <p className="text-paper/75 mt-5 max-w-md text-base leading-relaxed">
          {SITE.description} From badminton today to every sport tomorrow — one platform for
          registration, draws, live scoring, and public results.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          {SPORTS.map(({ label, icon: Icon }) => (
            <span
              key={label}
              className="border-paper/20 bg-paper/5 text-paper/90 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export { NAV_LINKS };
