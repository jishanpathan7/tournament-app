import { MarketingBottomNav } from "@/features/marketing/components/auth-hero-panel";
import { SITE } from "@/lib/site";

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-ink/10 border-t py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 md:px-8">
        <MarketingBottomNav />
        <p className="text-muted-foreground text-sm">
          © {year} {SITE.name}. {SITE.description}
        </p>
      </div>
    </footer>
  );
}
