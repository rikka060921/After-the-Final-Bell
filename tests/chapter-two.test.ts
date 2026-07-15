import { describe, expect, it } from "vitest";

import { defaultNotebookState, initialStats } from "../src/config";
import { initializeChapterOne } from "../src/chapter-one/opening";
import { initializeChapterTwo } from "../src/chapter-two/opening";
import { chooseResultFraming } from "../src/chapter-two/result";
import { sendAsyncMessage } from "../src/chapter-two/message";
import { playBusAction } from "../src/chapter-two/bus";
import { ASYNC_MESSAGES } from "../src/chapter-two/model";
import { demoRecap, demoShareText } from "../src/demo-release";
import type { OpeningProfile } from "../src/types";

function profile(): OpeningProfile {
  return {
    createdAt: "2026-07-15T00:00:00.000Z",
    playerName: "陈舟",
    mode: "story",
    endingId: "alliance",
    stats: initialStats(),
    notebook: defaultNotebookState(),
    promises: [],
    decisionIds: [],
    summary: []
  };
}

function chapterTwoFixture() {
  const first = initializeChapterOne(profile());
  first.chapterOne.phase = "complete";
  first.chapterOne.exam.resolved = true;
  first.chapterOne.exam.band = "稳定";
  first.chapterOne.exam.effectiveScore = 61.5;
  first.progress.facts.push("chapter-one-complete");
  return {
    chapterTwo: initializeChapterTwo(first.chapterOne, first.progress, initialStats()),
    progress: first.progress,
    stats: initialStats()
  };
}

describe("chapter two domain slice", () => {
  it("starts from the completed first-chapter exam without inventing a score", () => {
    const fixture = chapterTwoFixture();
    expect(fixture.chapterTwo.phase).toBe("result-letter");
    expect(fixture.chapterTwo.resultBand).toBe("稳定");
    expect(fixture.chapterTwo.effectiveScore).toBe(61.5);
    expect(fixture.chapterTwo.familyPressure).toBeGreaterThan(0);
  });

  it("chains result framing into a bounded async message", () => {
    const fixture = chapterTwoFixture();
    const framed = chooseResultFraming(
      fixture.chapterTwo,
      fixture.progress,
      fixture.stats,
      "full-context"
    );
    expect(framed.chapterTwo.phase).toBe("async-message");
    expect(framed.progress.facts).toContain("chapter2-result:full-context");

    const messaged = sendAsyncMessage(
      framed.chapterTwo,
      framed.progress,
      framed.stats,
      "leave-space"
    );
    expect(messaged.chapterTwo.phase).toBe("bus-route");
    expect(messaged.chapterTwo.message?.wordCount).toBeLessThanOrEqual(18);
    expect(messaged.progress.facts).toContain("chapter2-message:leave-space");
  });

  it("keeps every displayed async message inside the real eighteen-character budget", () => {
    ASYNC_MESSAGES.forEach((message) => {
      expect(Array.from(message.text)).toHaveLength(message.wordCount);
      expect(message.wordCount).toBeLessThanOrEqual(18);
    });
  });

  it("resolves a breakfast route as a met or missed outcome from actions", () => {
    const fixture = chapterTwoFixture();
    const framed = chooseResultFraming(fixture.chapterTwo, fixture.progress, fixture.stats, "progress-first");
    const messaged = sendAsyncMessage(framed.chapterTwo, framed.progress, framed.stats, "leave-space");
    let current = messaged;
    current = playBusAction(current.chapterTwo, current.progress, current.stats, "buy-breakfast");
    current = playBusAction(current.chapterTwo, current.progress, current.stats, "wait");
    current = playBusAction(current.chapterTwo, current.progress, current.stats, "wait");
    current = playBusAction(current.chapterTwo, current.progress, current.stats, "wait");
    expect(current.chapterTwo.phase).toBe("complete");
    expect(["met", "missed", "late"]).toContain(current.chapterTwo.bus.outcome);
    expect(current.progress.facts.some((fact) => fact.startsWith("chapter2-bus-outcome:"))).toBe(true);
    expect(current.progress.facts).toContain("chapter-two-complete");
    expect(current.progress.facts).toContain("chapter-three-hook:cropped-page-copy");
  });

  it("does not allow a second breakfast purchase or actions after route resolution", () => {
    const fixture = chapterTwoFixture();
    const framed = chooseResultFraming(fixture.chapterTwo, fixture.progress, fixture.stats, "pressure-first");
    const messaged = sendAsyncMessage(framed.chapterTwo, framed.progress, framed.stats, "promise-solve");
    const bought = playBusAction(messaged.chapterTwo, messaged.progress, messaged.stats, "buy-breakfast");
    expect(() => playBusAction(bought.chapterTwo, bought.progress, bought.stats, "buy-breakfast")).toThrow();
  });

  it("builds a complete, shareable recap at the demo endpoint", () => {
    const fixture = chapterTwoFixture();
    const framed = chooseResultFraming(fixture.chapterTwo, fixture.progress, fixture.stats, "full-context");
    const messaged = sendAsyncMessage(framed.chapterTwo, framed.progress, framed.stats, "ask-plan");
    let current = messaged;
    while (current.chapterTwo.phase !== "complete") {
      current = playBusAction(current.chapterTwo, current.progress, current.stats, "wait");
    }
    const recap = demoRecap(current.chapterTwo);
    const shareText = demoShareText(current.chapterTwo, "陈舟");
    expect(recap.map((item) => item.label)).toEqual(["一模", "成绩单", "留言", "错峰公交"]);
    expect(shareText).toContain("公开试玩版 v0.7.0");
    expect(shareText).toContain("第17题，下一次见。");
  });
});
