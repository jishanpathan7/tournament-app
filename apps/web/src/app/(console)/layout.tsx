import { AppShell } from "@/components/shell/app-shell";
import { RequireAuth } from "@/features/auth/require-auth";

/** Organizer console: auth-gated, wrapped in the app shell (sidebar + topbar + content). */
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
