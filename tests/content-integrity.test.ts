import { describe, expect, it } from "vitest";

import { validateFormalContent } from "../src/content-integrity";

describe("formal content integrity", () => {
  it("accepts the complete first-chapter registry", () => {
    expect(validateFormalContent()).toEqual([]);
  });
});
