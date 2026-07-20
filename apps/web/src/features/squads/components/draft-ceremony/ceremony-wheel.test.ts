/**
 * Wheel label geometry. The draft is projected to a room, so names have to stay
 * legible at SIBL scale (~58 registrations) without labels colliding.
 *
 * A segment's usable height is its arc length at the radius where the label
 * starts, which grows with radius. So the invariant is: arc height at the text
 * start must exceed the font size. Crowded wheels buy height by pushing labels
 * outward rather than by shrinking the type.
 */

import { describe, expect, it } from "vitest";

import {
  fontSize,
  textStartRadius,
  R,
} from "@/features/squads/components/draft-ceremony/ceremony-wheel";

/** Vertical room one segment gets where its label begins. */
function arcHeightAtLabel(n: number): number {
  return (2 * Math.PI * textStartRadius(n)) / n;
}

const POOL_SIZES = [2, 4, 8, 9, 12, 13, 18, 19, 24, 28, 29, 40, 41, 50, 58, 70];

describe("wheel label geometry", () => {
  it("never lets labels collide, at any pool size", () => {
    for (const n of POOL_SIZES) {
      expect(arcHeightAtLabel(n)).toBeGreaterThan(fontSize(n));
    }
  });

  it("keeps real headroom at SIBL scale", () => {
    // 58 registrations is the actual event; leave margin, not a hairline pass.
    expect(arcHeightAtLabel(58) / fontSize(58)).toBeGreaterThan(1.2);
  });

  it("always leaves radial room for a readable label", () => {
    for (const n of POOL_SIZES) {
      const room = R - textStartRadius(n);
      // Enough for ~8 characters — a first name.
      expect(room / (fontSize(n) * 0.58)).toBeGreaterThanOrEqual(8);
    }
  });

  it("never shrinks type below the small-screen floor", () => {
    // The old curve dropped to 9px on a crowded wheel, which was unreadable
    // across a room even before projection.
    for (const n of POOL_SIZES) {
      expect(fontSize(n)).toBeGreaterThanOrEqual(12);
    }
  });

  it("pushes labels outward only as the wheel gets crowded", () => {
    // Monotonic: more slots never means a smaller start radius.
    for (let i = 1; i < POOL_SIZES.length; i++) {
      expect(textStartRadius(POOL_SIZES[i]!)).toBeGreaterThanOrEqual(
        textStartRadius(POOL_SIZES[i - 1]!),
      );
    }
  });
});
