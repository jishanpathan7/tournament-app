import Link from "next/link";

import { Brand } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { label: "Features", href: "#features" },
  { label: "Sports", href: "#sports" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Live demo", href: "#live-demo" },
] as const;

export function MarketingNav() {
  return (
    <header className="border-ink/10 bg-paper/90 sticky top-0 z-50 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
        <Brand href="/" />
        <nav className="hidden items-center gap-6 md:flex" aria-label="Marketing">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:text-ink text-sm font-medium transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button tone="ghost" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button tone="candy" size="sm" asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
