import { describe, expect, it } from "vitest";

import { initialStats } from "../src/config";
import { defaultLongTermProgress } from "../src/chapter-one/persistence";
import {
  initializeChapterThree,
  investigateLead,
  moveTestimony,
  resolvePrivacyChoice,
  submitTestimonyOrder
} from "../src/chapter-three/domain";
import { sanitizeChapterThreeState } from "../src/chapter-three/persistence";
import type { ChapterTwoState, PrivacyChoiceId } from "../src/types";

function completedChapterTwo(): ChapterTwoState {
  return {
    schemaVersion: 1,
    phase: "complete",
    resultBand: "稳定",
    effectiveScore: 62,
    framing: "full-context",
    message: { id: "leave-space", wordCount: 18, text: "可以先不回答。我也会写好自己的计划。" },
    familyTrust: 2,
    familyPressure: 30,
    zhouDistance: 1,
    bus: {
      stopIndex: 3,
      minutes: 2,
      breakfast: true,
      delay: 0,
      resolved: true,
      outcome: "met",
      log: []
    },
    resolvedEventIds: []
  };
}

function initialized() {
  const progress = defaultLongTermProgress();
  progress.facts.push("chapter-two-complete");
  return {
    chapterThree: initializeChapterThree(completedChapterTwo(), progress),
    progress,
    stats: initialStats()
  };
}

function reachTestimonyBoard() {
  let current = initialized();
  for (const id of ["guo-route", "liang-version", "office-copy"] as const) {
    current = investigateLead(current.chapterThree, current.progress, current.stats, id);
  }
  return current;
}

describe("chapter three information board", () => {
  it("spends exactly three investigation points on distinct sources", () => {
    let current = initialized();
    current = investigateLead(current.chapterThree, current.progress, current.stats, "guo-route");
    expect(current.chapterThree.pointsLeft).toBe(2);
    expect(() => investigateLead(current.chapterThree, current.progress, current.stats, "guo-route")).toThrow(/已经核对/);
    current = investigateLead(current.chapterThree, current.progress, current.stats, "zhou-boundary");
    current = investigateLead(current.chapterThree, current.progress, current.stats, "office-copy");
    expect(current.chapterThree.phase).toBe("testimony-board");
    expect(current.chapterThree.testimonyOrder).toHaveLength(4);
    expect(current.progress.facts).toContain("chapter3-lead:zhou-boundary");
  });

  it("grades source order by provenance and allows arrow-style reordering", () => {
    const current = reachTestimonyBoard();
    let board = current.chapterThree;
    board = moveTestimony(board, "copy-time", "up");
    board = moveTestimony(board, "copy-time", "up");
    const submitted = submitTestimonyOrder(board);
    expect(submitted.testimonyOrder).toEqual(["copy-edge", "copy-time", "guo-admission", "liang-story"]);
    expect(submitted.evidenceQuality).toBe("clear");
    expect(submitted.phase).toBe("privacy-choice");
  });

  it.each([
    ["teacher-with-parties", "procedural"],
    ["stop-investigation", "protected"],
    ["expose-plan", "exposed"],
    ["take-all-blame", "absorbed"]
  ] as const)("resolves %s into a distinct %s outcome", (choice, outcome) => {
    const current = reachTestimonyBoard();
    const submitted = submitTestimonyOrder(current.chapterThree);
    const resolved = resolvePrivacyChoice(
      submitted,
      current.progress,
      current.stats,
      choice as PrivacyChoiceId
    );
    expect(resolved.chapterThree.outcome).toBe(outcome);
    expect(resolved.chapterThree.phase).toBe("complete");
    expect(resolved.progress.facts).toContain(`chapter3-outcome:${outcome}`);
    expect(resolved.progress.facts).toContain("chapter-four-hook:hundred-day-list");
  });

  it("round-trips an in-progress testimony board and rejects duplicate cards", () => {
    const current = reachTestimonyBoard();
    expect(sanitizeChapterThreeState(structuredClone(current.chapterThree))).toEqual(current.chapterThree);
    const corrupted = structuredClone(current.chapterThree);
    corrupted.testimonyOrder[2] = corrupted.testimonyOrder[1]!;
    expect(sanitizeChapterThreeState(corrupted)).toBeNull();
  });
});
