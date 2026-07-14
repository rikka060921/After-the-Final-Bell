import { describe, expect, it } from "vitest";

import { initialStats } from "../src/config";
import { applyStatEffects } from "../src/state";

describe("stat effects", () => {
  it("allows hidden mutual support to become negative", () => {
    const result = applyStatEffects(initialStats(), { mutual: -8 });
    expect(result.stats.mutual).toBe(-8);
  });

  it("clamps visible stats and hidden mutual support to their valid ranges", () => {
    const result = applyStatEffects(initialStats(), {
      study: 1000,
      energy: -1000,
      mutual: -1000
    });
    expect(result.stats.study).toBe(100);
    expect(result.stats.energy).toBe(0);
    expect(result.stats.mutual).toBe(-30);
  });

  it("derives rebellion from high pressure and low agency", () => {
    const stats = { ...initialStats(), stress: 73, agency: 40 };
    const result = applyStatEffects(stats, { bond: 1 });
    expect(result.stats.rebellion).toBe(stats.rebellion + 3);
    expect(result.changes).toContainEqual({ key: "rebellion", delta: 3 });
  });
});
