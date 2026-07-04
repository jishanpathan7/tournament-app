import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function MarketingCtaBanner() {
  return (
    <section id="live-demo" className="bg-ink text-paper py-20">
      <div className="mx-auto max-w-6xl px-4 text-center md:px-8">
        <h2 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">
          Your next tournament,{" "}
          <span className="text-candy italic">handled.</span>
        </h2>
        <p className="text-paper/70 mx-auto mt-4 max-w-xl text-lg">
          Start free — no credit card. Or browse live public scores right now.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button tone="candy" size="lg" asChild>
            <Link href="/register">
              Create your event
              <ArrowRight className="h-5 w-5" strokeWidth={2.25} />
            </Link>
          </Button>
          <Button
            tone="paper"
            size="lg"
            asChild
            className="border-paper/20 bg-paper/10 text-paper hover:bg-paper/20"
          >
            <Link href="/search">Browse live scores</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
