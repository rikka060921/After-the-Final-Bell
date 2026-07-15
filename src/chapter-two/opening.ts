import type { ChapterOneState, GameStats, LongTermProgress } from "../types";
import type { ChapterTwoState } from "./model";
import { initialFamilyPressure } from "./model";

export function initializeChapterTwo(
  chapterOne: ChapterOneState,
  progress: LongTermProgress,
  stats: GameStats
): ChapterTwoState {
  if (chapterOne.phase !== "complete" || !chapterOne.exam.resolved || !chapterOne.exam.band || chapterOne.exam.effectiveScore === null) {
    throw new Error("Chapter two requires a completed first chapter and mock exam");
  }
  return {
    schemaVersion: 1,
    phase: "result-letter",
    resultBand: chapterOne.exam.band,
    effectiveScore: chapterOne.exam.effectiveScore,
    framing: null,
    message: null,
    familyTrust: 0,
    familyPressure: initialFamilyPressure(stats, chapterOne.exam.band),
    zhouDistance: progress.facts.includes("chapter-one-complete") ? 0 : 2,
    bus: {
      stopIndex: 0,
      minutes: 10,
      breakfast: false,
      delay: 0,
      resolved: false,
      outcome: "pending",
      log: ["一模成绩单夹在书包最外层。寒假前，你们只能在不同站点错开十分钟。"]
    },
    resolvedEventIds: []
  };
}
