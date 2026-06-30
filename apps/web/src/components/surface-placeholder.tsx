/** Shared placeholder for scaffolded route groups until their UI is built. */
export function SurfacePlaceholder({ surface, group }: { surface: string; group: string }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-2xs text-muted-foreground font-mono uppercase tracking-[0.28em]">
        {group}
      </p>
      <h1 className="mt-2 font-serif text-3xl">{surface}</h1>
      <p className="text-muted-foreground mt-3">
        Scaffolded route group — screens land here per the design system.
      </p>
    </main>
  );
}
