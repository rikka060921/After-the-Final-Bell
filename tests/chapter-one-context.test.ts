import { describe, expect, it } from "vitest";

import { initialStats, defaultNotebookState } from "../src/config";
import { deriveChapterOneContext } from "../src/chapter-one/context";
import { initializeChapterOne } from "../src/chapter-one/opening";
import { createOpeningProfile } from "../src/opening-profile";
import type { OpeningProfile } from "../src/types";

function profile(): OpeningProfile {
  return createOpeningProfile({
    playerName: "陈舟",
    mode: "story",
    endingId: "alliance",
    stats: initialStats(),
    notebook: defaultNotebookState(),
    promises: [],
    decisionIds: [],
    createdAt: "2026-07-15T00:00:00.000Z"
  });
}

describe("chapter one contextual echoes", () => {
  it("keeps the opening week free of an invented prior event", () => {
    const initialized = initializeChapterOne(profile());
    const context = deriveChapterOneContext(initialized.chapterOne, initialized.progress);
    expect(context.prompt).toContain("有限的空档");
    expect(context.echoLines.join(" ")).toContain("序章留下的承诺");
  });

  it("writes the seat route and Liang favor into week two", () => {
    const initialized = initializeChapterOne(profile());
    initialized.chapterOne.currentWeek = 2;
    initialized.progress.facts.push("seat-route:noticed");
    initialized.chapterOne.relationships.liangFavor = 1;
    const context = deriveChapterOneContext(initialized.chapterOne, initialized.progress);
    expect(context.pressure.join(" ")).toContain("郭祺");
    expect(context.echoLines.join(" ")).toContain("梁硕");
  });

  it("lets communication and page handling change the final week", () => {
    const initialized = initializeChapterOne(profile());
    initialized.chapterOne.currentWeek = 4;
    initialized.chapterOne.relationships.guoSuspicion = 4;
    initialized.progress.facts.push(
      "first-communication-pattern:control",
      "page17-state:torn"
    );
    const context = deriveChapterOneContext(initialized.chapterOne, initialized.progress);
    expect(context.prompt).toContain("前三周");
    expect(context.pressure.join(" ")).toContain("残片");
    expect(context.echoLines.join(" ")).toContain("命令式");
  });
});
