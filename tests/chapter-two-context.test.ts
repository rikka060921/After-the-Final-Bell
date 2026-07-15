import { describe, expect, it } from "vitest";

import { initialStats } from "../src/config";
import { initializeChapterOne } from "../src/chapter-one/opening";
import { initializeChapterTwo } from "../src/chapter-two/opening";
import { chooseResultFraming } from "../src/chapter-two/result";
import { sendAsyncMessage } from "../src/chapter-two/message";
import { resultReaction, messagePrelude, busPrelude } from "../src/chapter-two/context";
import type { OpeningProfile } from "../src/types";

function state() {
  const profile: OpeningProfile = {
    createdAt: "2026-07-15T00:00:00.000Z",
    playerName: "陈舟",
    mode: "story",
    endingId: "alliance",
    stats: initialStats(),
    notebook: { slots: ["solution", "solution", "solution", "message", "message", "blank"], committed: true },
    promises: [],
    decisionIds: [],
    summary: []
  };
  const first = initializeChapterOne(profile);
  first.chapterOne.phase = "complete";
  first.chapterOne.exam.resolved = true;
  first.chapterOne.exam.band = "失常";
  first.chapterOne.exam.effectiveScore = 35;
  first.progress.facts.push("chapter-one-complete");
  return initializeChapterTwo(first.chapterOne, first.progress, { ...initialStats(), stress: 80 });
}

describe("chapter two narrative context", () => {
  it("reflects score band and family pressure in the result reaction", () => {
    const chapterTwo = state();
    expect(resultReaction(chapterTwo)).toContain("下滑");
  });

  it("carries the chosen framing into the message and bus prelude", () => {
    const chapterTwo = state();
    const progress = { facts: ["chapter-one-complete"], tendencies: { listening: 0, explanation: 0, responsibility: 0, avoidance: 0, control: 0, defiance: 0 }, academic: { mastery: 40, speed: 40, stability: 40, falseMastery: 0, sleepDebt: 0 } };
    const framed = chooseResultFraming(chapterTwo, progress, initialStats(), "pressure-first");
    expect(messagePrelude(framed.chapterTwo)).toContain("疲惫");
    const messaged = sendAsyncMessage(framed.chapterTwo, framed.progress, framed.stats, "promise-solve");
    expect(busPrelude(messaged.chapterTwo)).toContain("解决");
  });
});
