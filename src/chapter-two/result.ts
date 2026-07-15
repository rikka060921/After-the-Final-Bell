import { applyStatEffects } from "../state";
import type { GameStats, LongTermProgress } from "../types";
import { resultFraming, type ChapterTwoState, type ResultFramingId } from "./model";

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function chooseResultFraming(
  state: ChapterTwoState,
  progress: LongTermProgress,
  stats: GameStats,
  framingId: ResultFramingId
): { chapterTwo: ChapterTwoState; progress: LongTermProgress; stats: GameStats } {
  if (state.phase !== "result-letter") throw new Error("The result letter is not active");
  const framing = resultFraming(framingId);
  if (!framing) throw new Error(`Unknown result framing: ${framingId}`);
  const next = structuredClone(state);
  const nextProgress: LongTermProgress = {
    ...progress,
    facts: [...new Set([...progress.facts, ...framing.effects.facts])],
    tendencies: { ...progress.tendencies },
    academic: { ...progress.academic }
  };
  Object.entries(framing.effects.tendencies).forEach(([key, value]) => {
    const tendency = key as keyof LongTermProgress["tendencies"];
    nextProgress.tendencies[tendency] += value ?? 0;
  });
  const applied = applyStatEffects(stats, framing.effects.stats);
  next.phase = "async-message";
  next.framing = framingId;
  next.familyTrust = clamp(next.familyTrust + (framingId === "full-context" ? 2 : framingId === "progress-first" ? 1 : 0));
  next.familyPressure = clamp(next.familyPressure + (framingId === "full-context" ? 2 : framingId === "pressure-first" ? -2 : 0));
  next.resolvedEventIds = [...new Set([...next.resolvedEventIds, `chapter2-result:${framingId}`])];
  return { chapterTwo: next, progress: nextProgress, stats: applied.stats };
}
