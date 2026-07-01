import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import { renderWithProviders, screen } from "@/test/test-utils";

describe("Button", () => {
  it("renders its label and handles clicks", async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <Button tone="candy" onClick={onClick}>
        Save
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toBeInTheDocument();
    btn.click();
    expect(onClick).toHaveBeenCalledOnce();
  });
});
