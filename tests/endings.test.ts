import { describe, expect, it } from "vitest";

import { initialStats } from "../src/config";
import { resolveEnding } from "../src/endings";

describe("ending resolver", () => {
  it("prioritizes overload when the player is exhausted", () => {
    expect(resolveEnding({ ...initialStats(), energy: 30, bond: 40 })).toBe("overload");
  });

  it("recognizes the high-bond, high-risk stolen spring ending", () => {
    expect(resolveEnding({ ...initialStats(), bond: 30, risk: 16, mutual: 9 })).toBe("stolen");
  });

  it("recognizes a negative mutual pattern as a blank-page ending", () => {
    expect(resolveEnding({ ...initialStats(), bond: 20, mutual: -6 })).toBe("blank");
  });
});
