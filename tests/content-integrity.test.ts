import { describe, expect, it } from "vitest";

import { validateChapterOneContent } from "../src/content-integrity";

describe("formal content integrity", () => {
  it("accepts the complete first-chapter registry", () => {
    expect(validateChapterOneContent()).toEqual([]);
  });
});
