import { skillWeight } from "@tournament/shared";

import { Button } from "@/components/ui/button";
import { HealthStatus } from "@/features/health/health-status";

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
      <header>
        <p className="text-2xs text-muted-foreground font-mono uppercase tracking-[0.28em]">
          Development foundation
        </p>
        <h1 className="mt-2 font-serif text-4xl">Tournament Platform</h1>
        <p className="text-muted-foreground mt-3">
          Local baseline — Next.js&nbsp;15 web talking to the FastAPI backend, themed with the Candy
          Sticker design system.
        </p>
      </header>

      <HealthStatus />

      <section className="border-ink bg-card shadow-sticker-md rounded-2xl border-2 p-6">
        <h2 className="font-serif text-xl">Workspace wiring</h2>
        <p className="mt-2 text-sm">
          Imported from <code className="font-mono">@tournament/shared</code>: an advanced
          player&apos;s skill weight is <b>{skillWeight("advanced")}</b>.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button tone="candy">Primary action</Button>
          <Button tone="paper">Secondary</Button>
          <Button tone="mint">Success</Button>
          <Button tone="pink">Destructive</Button>
        </div>
      </section>
    </main>
  );
}
