import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const timeline = vi.hoisted(() => ({ calls: 0 }));
vi.mock("gsap", () => {
  const chain = {
    fromTo: () => chain,
    to: () => chain,
    kill: () => {},
  };
  return {
    default: {
      timeline: () => {
        timeline.calls += 1;
        return chain;
      },
      fromTo: () => chain,
      to: () => chain,
    },
  };
});

import { CountdownOverlay, RevealOverlay } from "@/features/squads/components/draft-ceremony/index";

const info = {
  playerName: "Player A",
  skillLevel: "advanced",
  divisionName: "Mix Doubles",
  squadId: "sq-1",
  squadName: "Team A",
  squadColor: "#ff00aa",
  wheelRect: null,
};

describe("RevealOverlay", () => {
  beforeEach(() => {
    timeline.calls = 0;
  });

  it("animates once even though the parent keeps re-rendering", () => {
    // The parent rebuilds `onDone` on every render (team flash clearing, ghost
    // fly landing, timers). Depending on it restarted the timeline, so the
    // player's name popped two or three times for the room to see.
    const { rerender } = render(
      <RevealOverlay info={info} tiered speed="normal" onDone={() => {}} />,
    );
    expect(timeline.calls).toBe(1);

    for (let i = 0; i < 3; i += 1) {
      rerender(<RevealOverlay info={info} tiered speed="normal" onDone={() => {}} />);
    }

    expect(timeline.calls).toBe(1);
  });

  it("shows the drafted player and the team they went to", () => {
    const { getByText } = render(
      <RevealOverlay info={info} tiered speed="normal" onDone={() => {}} />,
    );
    expect(getByText("Player A")).toBeInTheDocument();
    expect(getByText("→ Team A")).toBeInTheDocument();
  });
});

describe("CountdownOverlay", () => {
  it("does not restart 3·2·1 when the parent re-renders", () => {
    vi.useFakeTimers();
    try {
      const onDone = vi.fn();
      const { rerender, getByText } = render(
        <CountdownOverlay speed="normal" onDone={() => onDone()} />,
      );
      expect(getByText("3")).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(700));
      // A re-render used to clear the pending timers and start the count again.
      rerender(<CountdownOverlay speed="normal" onDone={() => onDone()} />);
      act(() => vi.advanceTimersByTime(1400));

      expect(onDone).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
