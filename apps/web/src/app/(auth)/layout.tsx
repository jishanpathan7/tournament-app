import { Suspense } from "react";

import { Brand } from "@/components/shell/brand";
import { RedirectIfAuthenticated } from "@/features/auth/require-auth";

/** Centered, chrome-free shell for auth pages (design system: forms max-w ~28rem, cream page). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <RedirectIfAuthenticated>
        <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
          <div className="mb-8">
            <Brand href="/" />
          </div>
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </RedirectIfAuthenticated>
    </Suspense>
  );
}
