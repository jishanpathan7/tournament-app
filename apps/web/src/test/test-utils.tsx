import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import * as React from "react";

import { TooltipProvider } from "@/components/ui/tooltip";

/** Query client tuned for tests: no retries, no caching between tests. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function Providers({
  children,
  client,
}: {
  children: React.ReactNode;
  client?: QueryClient;
}) {
  const queryClient = client ?? createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}

/** Render a UI tree inside the app's client providers (Query + Tooltip). */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: RenderOptions & { client?: QueryClient },
) {
  const client = options?.client ?? createTestQueryClient();
  return {
    client,
    ...render(ui, {
      wrapper: ({ children }) => <Providers client={client}>{children}</Providers>,
      ...options,
    }),
  };
}

/** The shared Next router mock (push/replace/... ) for navigation assertions. */
export function getRouterMock() {
  return (globalThis as unknown as { __routerMock: Record<string, ReturnType<typeof vi.fn>> })
    .__routerMock;
}

/** Set the mocked `useSearchParams` query (e.g. "token=abc"). Reset after each test. */
export function setSearchParams(query: string) {
  (globalThis as unknown as { __setSearchParams: (q: string) => void }).__setSearchParams(query);
}

export * from "@testing-library/react";
