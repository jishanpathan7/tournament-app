/// <reference types="vitest/globals" />
import "vitest";
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

// Make Vitest's `expect` aware of jest-dom matchers (toBeInTheDocument, etc.).
/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-explicit-any */
declare module "vitest" {
  interface Assertion<T = any> extends TestingLibraryMatchers<unknown, T> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, unknown> {}
}
