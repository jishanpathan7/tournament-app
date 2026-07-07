import { cn } from "@/lib/utils";

/** Right panel wrapper for auth pages — cream background, centered form column. */
export function AuthFormShell({
  eyebrow,
  title,
  description,
  children,
  footer,
  className,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-background flex flex-1 flex-col items-center justify-center px-4 py-10 md:min-h-screen md:w-[42%] md:px-8",
        className,
      )}
    >
      <div className="w-full max-w-md">
        <header className="mb-8">
          <p className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.28em]">
            {eyebrow}
          </p>
          <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight md:text-3xl">
            {title}
          </h2>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{description}</p>
        </header>
        {children}
        {footer ? <div className="mt-8">{footer}</div> : null}
      </div>
    </div>
  );
}
