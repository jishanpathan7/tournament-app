const STEPS = [
  {
    step: "01",
    title: "Create & import",
    description: "Set up your tournament, divisions, and import your roster in minutes.",
  },
  {
    step: "02",
    title: "Pair & seed",
    description: "Generate fair draws with smart pairing — review, tweak, and publish.",
  },
  {
    step: "03",
    title: "Run live",
    description: "Assign courts, enter scores, and keep players and fans updated in real time.",
  },
  {
    step: "04",
    title: "Publish results",
    description: "Standings, brackets, and exports — shareable the moment the final point lands.",
  },
] as const;

export function MarketingSteps() {
  return (
    <section id="how-it-works" className="bg-muted/30 py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="max-w-2xl">
          <p className="text-yellow font-mono text-xs font-semibold uppercase tracking-[0.28em]">
            How it works
          </p>
          <h2 className="font-serif mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Four steps to a{" "}
            <span className="text-candy italic">flawless event.</span>
          </h2>
        </div>
        <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ step, title, description }) => (
            <li key={step} className="relative">
              <span className="text-candy font-mono text-sm font-bold">{step}</span>
              <h3 className="mt-2 text-lg font-semibold">{title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
