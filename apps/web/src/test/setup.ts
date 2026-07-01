import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/** Shared Next router + search-param mocks — controlled via test-utils helpers. */
const { routerMock, searchParamsRef } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  },
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/console/tournaments",
  useSearchParams: () => searchParamsRef.current,
  useParams: () => ({}),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// Expose for assertions + control (see test-utils `getRouterMock` / `setSearchParams`).
(globalThis as unknown as { __routerMock: typeof routerMock }).__routerMock = routerMock;
(globalThis as unknown as { __setSearchParams: (q: string) => void }).__setSearchParams = (q) => {
  searchParamsRef.current = new URLSearchParams(q);
};

afterEach(() => {
  cleanup();
  searchParamsRef.current = new URLSearchParams();
});

// jsdom lacks these; Radix (Select/Dialog/Popover) and cmdk rely on them.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as MediaQueryList;
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture = vi.fn(() => false);
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();
