import { MarketingCtaBanner } from "@/features/marketing/components/marketing-cta-banner";
import { MarketingFeaturesGrid } from "@/features/marketing/components/marketing-features-grid";
import { MarketingFooter } from "@/features/marketing/components/marketing-footer";
import { MarketingHero } from "@/features/marketing/components/marketing-hero";
import { MarketingNav } from "@/features/marketing/components/marketing-nav";
import { MarketingSportsStrip } from "@/features/marketing/components/marketing-sports-strip";
import { MarketingSteps } from "@/features/marketing/components/marketing-steps";

/** Guest marketing home page. */
export function LandingPage() {
  return (
    <div className="bg-background min-h-screen">
      <MarketingNav />
      <main>
        <MarketingHero />
        <MarketingSportsStrip />
        <MarketingFeaturesGrid />
        <MarketingSteps />
        <MarketingCtaBanner />
      </main>
      <MarketingFooter />
    </div>
  );
}
