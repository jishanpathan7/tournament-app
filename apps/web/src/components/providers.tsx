"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AUTH_EXPIRED_EVENT } from "@/lib/api";
import { createQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

/** Reacts to an unrecoverable session (refresh failed) by clearing it and bouncing to login. */
function AuthExpiredListener({ onExpire }: { onExpire: () => void }) {
  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpire);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpire);
  }, [onExpire]);
  return null;
}

/**
 * App-wide client providers: theme (Candy Sticker is light-only — the provider is wired
 * for the future but forced to light), server-state (TanStack Query), tooltip context,
 * toasts, and the auth-expiry redirect. Mounted once in the root layout.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const router = useRouter();

  return (
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster />
          <AuthExpiredListener
            onExpire={() => {
              queryClient.setQueryData(queryKeys.session, null);
              router.replace("/login");
            }}
          />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
