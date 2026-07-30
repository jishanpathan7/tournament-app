"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { Brand } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
import { registerScrollTrigger } from "@/lib/motion";
registerScrollTrigger();

const NAV_ITEMS = [
  { label: "Features", href: "#features" },
  { label: "Sports", href: "#sports" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Live demo", href: "#live-demo" },
] as const;

export function MarketingNav() {
  const headerRef = useRef<HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const el = headerRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        start: "top -60",
        onUpdate(self) {
          const progress = Math.min(self.scroll() / 120, 1);
          gsap.set(el, {
            boxShadow: `0 ${progress * 8}px ${progress * 24}px rgba(0,0,0,${progress * 0.08})`,
          });
        },
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <header
      ref={headerRef}
      className="border-ink/10 bg-paper/90 sticky top-0 z-50 border-b backdrop-blur-md"
    >
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
          <Button tone="ghost" size="sm" className="hidden md:inline-flex" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button tone="candy" size="sm" asChild>
            <Link href="/register">Get started</Link>
          </Button>
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="text-ink -mr-1 rounded-md p-1.5 md:hidden"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" strokeWidth={2.25} />
            ) : (
              <Menu className="h-5 w-5" strokeWidth={2.25} />
            )}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <nav
          className="border-ink/10 bg-paper/95 absolute left-0 right-0 border-b px-4 pb-4 pt-2 md:hidden"
          aria-label="Marketing mobile"
        >
          <ul className="flex flex-col">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-foreground/80 hover:text-foreground block py-3 text-sm font-medium transition-colors"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="border-ink/10 border-t pt-3">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="text-foreground/80 hover:text-foreground block py-3 text-sm font-medium transition-colors"
              >
                Sign in
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
