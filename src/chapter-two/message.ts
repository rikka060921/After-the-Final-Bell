import { applyStatEffects } from "../state";
import type { GameStats, LongTermProgress } from "../types";
import { asyncMessage, type AsyncMessageId, type ChapterTwoState } from "./model";

const WORD_LIMIT = 18;

export function sendAsyncMessage(
  state: ChapterTwoState,
  progress: LongTermProgress,
  stats: GameStats,
  messageId: AsyncMessageId
): { chapterTwo: ChapterTwoState; progress: LongTermProgress; stats: GameStats } {
  if (state.phase !== "async-message") throw new Error("The async message is not active");
  const message = asyncMessage(messageId);
  if (!message) throw new Error(`Unknown async message: ${messageId}`);
  if (message.wordCount > WORD_LIMIT) throw new Error("This message exceeds the available word limit");
  const next = structuredClone(state);
  const nextProgress: LongTermProgress = {
    ...progress,
    facts: [...new Set([...progress.facts, ...message.effects.facts])],
    tendencies: { ...progress.tendencies },
    academic: { ...progress.academic }
  };
  Object.entries(message.effects.tendencies).forEach(([key, value]) => {
    const tendency = key as keyof LongTermProgress["tendencies"];
    nextProgress.tendencies[tendency] += value ?? 0;
  });
  const applied = applyStatEffects(stats, message.effects.stats);
  next.phase = "bus-route";
  next.message = { id: message.id, wordCount: message.wordCount, text: message.text };
  next.zhouDistance = Math.max(0, Math.min(100, next.zhouDistance + (messageId === "promise-solve" ? 2 : -1)));
  next.resolvedEventIds = [...new Set([...next.resolvedEventIds, `chapter2-message:${messageId}`])];
  return { chapterTwo: next, progress: nextProgress, stats: applied.stats };
}

export const ASYNC_MESSAGE_WORD_LIMIT = WORD_LIMIT;
