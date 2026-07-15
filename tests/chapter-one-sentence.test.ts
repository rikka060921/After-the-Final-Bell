import { describe, expect, it } from "vitest";

import { defaultLongTermProgress } from "../src/chapter-one/persistence";
import {
  SENTENCE_FRAGMENTS,
  assembleSentence,
  availableSentenceFragments,
  validateSentenceSelection
} from "../src/chapter-one/sentence";

describe("chapter one sentence assembly", () => {
  it("always exposes a valid two-part sentence", () => {
    const progress = defaultLongTermProgress();
    const open = availableSentenceFragments(progress, "open")[0]!;
    const close = availableSentenceFragments(progress, "close")[0]!;
    const validation = validateSentenceSelection(progress, [open.id, close.id]);
    expect(validation.ok).toBe(true);
    expect(assembleSentence(validation.fragments)).toMatch(/。$/);
  });

  it("rejects contradictory privacy and control fragments", () => {
    const progress = defaultLongTermProgress();
    progress.tendencies.listening = 3;
    const validation = validateSentenceSelection(progress, [
      "open-privacy",
      "middle-order",
      "close-note"
    ]);
    expect(validation.ok).toBe(false);
  });

  it("keeps all fragments explicit and free of the protected student's name", () => {
    expect(SENTENCE_FRAGMENTS.map((fragment) => fragment.text).join(" ")).not.toContain("宋嘉禾");
  });
});
