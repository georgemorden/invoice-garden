import { describe, expect, it } from "vitest";
import { BOTANICAL_PLANT_DETAIL_ITEMS, BOTANICAL_PLANT_GROWTH_ITEMS, getSafeProgress } from "./botanicalPlantProgressGeometry";

describe("botanical growth", () => {
  it("clamps incomplete, complete and invalid progress", () => {
    expect(getSafeProgress(0, 6)).toBe(0);
    expect(getSafeProgress(3, 6)).toBe(0.5);
    expect(getSafeProgress(6, 6)).toBe(1);
    expect(getSafeProgress(9, 6)).toBe(1);
    expect(getSafeProgress(-1, 6)).toBe(0);
    expect(getSafeProgress(1, 0)).toBe(0);
    expect(getSafeProgress(NaN, 6)).toBe(0);
    expect(getSafeProgress(1, Infinity)).toBe(0);
  });

  it("reveals each leaf only after its attachment point has grown", () => {
    for (const leaf of BOTANICAL_PLANT_GROWTH_ITEMS.filter((item) => item.revealAt >= 0)) {
      expect(0.1 + 0.9 * leaf.revealAt).toBeGreaterThanOrEqual(leaf.stemDistance - 1e-9);
      expect(9 * (1 - leaf.revealAt)).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps the sprout visible at zero with distinct, finite stem attachments", () => {
    const seeds = BOTANICAL_PLANT_GROWTH_ITEMS.filter((leaf) => leaf.revealAt < 0);
    expect(seeds).toHaveLength(2);
    for (const leaf of [...BOTANICAL_PLANT_GROWTH_ITEMS, ...BOTANICAL_PLANT_DETAIL_ITEMS]) {
      expect(Number.isFinite(leaf.y)).toBe(true);
      expect(leaf.x).toBeGreaterThan(110);
      expect(leaf.x).toBeLessThan(130);
    }
  });

  it("provides one extra leaf per detail contribution", () => {
    expect(BOTANICAL_PLANT_DETAIL_ITEMS).toHaveLength(17);
    expect(new Set(BOTANICAL_PLANT_DETAIL_ITEMS.map((leaf) => leaf.id)).size).toBe(17);
    expect(BOTANICAL_PLANT_DETAIL_ITEMS.map((leaf) => leaf.detailAt))
      .toEqual(Array.from({ length: 17 }, (_, index) => index / 17));
  });
});
