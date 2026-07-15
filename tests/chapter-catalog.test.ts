import { describe, expect, it } from "vitest";

import { CHAPTER_CATALOG, availableChapters, chapterAvailability } from "../src/chapter-catalog";

describe("chapter catalog", () => {
  it("unlocks the first chapter from the prologue fact", () => {
    const chapterOne = CHAPTER_CATALOG.find((chapter) => chapter.id === "chapter-one")!;
    expect(chapterAvailability([], chapterOne)).toBe("locked");
    expect(chapterAvailability(["prologue-complete"], chapterOne)).toBe("available");
  });

  it("keeps the next chapter visible but clearly in development", () => {
    const chapters = availableChapters(["prologue-complete", "chapter-one-complete"]);
    expect(chapters.map((chapter) => chapter.id)).toContain("chapter-two");
    expect(chapters.find((chapter) => chapter.id === "chapter-two")?.availability).toBe("in-development");
  });

  it("unlocks the third-chapter hook only after the second chapter completes", () => {
    const chapterThree = CHAPTER_CATALOG.find((chapter) => chapter.id === "chapter-three")!;
    expect(chapterAvailability(["chapter-one-complete"], chapterThree)).toBe("locked");
    expect(chapterAvailability(["chapter-two-complete"], chapterThree)).toBe("in-development");
  });
});
