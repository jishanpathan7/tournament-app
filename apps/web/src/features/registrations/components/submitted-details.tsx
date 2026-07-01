function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((v) =>
        typeof v === "object" && v !== null && "name" in v
          ? String((v as { name: unknown }).name)
          : renderValue(v),
      )
      .join(", ");
  }
  return JSON.stringify(value);
}

/**
 * Renders whatever the entrant submitted (`formResponse`) generically — the backend
 * treats it as opaque JSON, so the UI doesn't assume a sport-specific shape either.
 * `players`/`teamName` get a friendlier pass (surfaced elsewhere too, via
 * `formResponseSummary`), everything else is a plain label/value row.
 */
export function SubmittedDetails({ formResponse }: { formResponse: Record<string, unknown> }) {
  const entries = Object.entries(formResponse).filter(([, v]) => v !== undefined);
  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">No additional details were submitted.</p>;
  }
  return (
    <dl className="flex flex-col gap-3">
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.16em]">
            {humanizeKey(key)}
          </dt>
          <dd className="text-sm">{renderValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
