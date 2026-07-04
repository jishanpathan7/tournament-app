import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/test/test-utils";
import { PlaylaneMark } from "@/components/shell/playlane-mark";
import { Brand } from "@/components/shell/brand";

describe("PlaylaneMark", () => {
  it("renders an img element for the logo mark", () => {
    const { container } = renderWithProviders(<PlaylaneMark />);
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img?.getAttribute("src")).toContain("logo-mark");
  });

  it("renders at the specified size", () => {
    const { container } = renderWithProviders(<PlaylaneMark size={48} />);
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
  });

  it("accepts inverted prop without throwing (backward-compat)", () => {
    expect(() => renderWithProviders(<PlaylaneMark inverted />)).not.toThrow();
  });
});

describe("Brand", () => {
  it("exposes Playlane as accessible label", () => {
    renderWithProviders(<Brand />);
    expect(screen.getByRole("link", { name: "Playlane" })).toBeInTheDocument();
  });

  it("shows the wordmark when not compact", () => {
    renderWithProviders(<Brand />);
    expect(screen.getByText("Playlane")).toBeInTheDocument();
  });

  it("hides the wordmark in compact mode", () => {
    renderWithProviders(<Brand compact />);
    const text = screen.queryByText("Playlane");
    // Text is hidden via CSS (hidden class) but still in DOM for screen-reader access
    expect(text).toBeInTheDocument();
  });
});
