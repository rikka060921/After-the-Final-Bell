import type {
  AsyncMessageId,
  BusActionId,
  ChapterTwoPhase,
  ChapterTwoState,
  ResultFramingId
} from "../types";
import { BUS_STOPS } from "./model";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function number(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function texts(value: unknown, limit = 40): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0).slice(-limit)
    : [];
}

export function sanitizeChapterTwoState(value: unknown): ChapterTwoState | null {
  if (!isRecord(value) || number(value.schemaVersion) !== 1) return null;
  const phase = text(value.phase) as ChapterTwoPhase;
  if (!["result-letter", "async-message", "bus-route", "complete"].includes(phase)) return null;
  const resultBand = text(value.resultBand);
  if (!["突破", "稳定", "波动", "失常"].includes(resultBand)) return null;
  const framing = text(value.framing) as ResultFramingId;
  const messageValue = isRecord(value.message) ? value.message : null;
  const messageId = messageValue ? text(messageValue.id) as AsyncMessageId : null;
  if (framing && !["full-context", "progress-first", "pressure-first"].includes(framing)) return null;
  if (messageId && !["ask-plan", "leave-space", "promise-solve"].includes(messageId)) return null;
  const busValue = isRecord(value.bus) ? value.bus : {};
  const outcome = text(busValue.outcome);
  const busResolved = Boolean(busValue.resolved);
  if (!["pending", "met", "missed", "late"].includes(outcome)) return null;
  const state: ChapterTwoState = {
    schemaVersion: 1,
    phase,
    resultBand: resultBand as ChapterTwoState["resultBand"],
    effectiveScore: Math.max(0, Math.min(100, number(value.effectiveScore))),
    framing: framing || null,
    message:
      messageValue && messageId
        ? {
            id: messageId,
            wordCount: Math.max(0, Math.min(18, Math.trunc(number(messageValue.wordCount)))),
            text: text(messageValue.text)
          }
        : null,
    familyTrust: Math.max(0, Math.min(100, number(value.familyTrust))),
    familyPressure: Math.max(0, Math.min(100, number(value.familyPressure))),
    zhouDistance: Math.max(0, Math.min(100, number(value.zhouDistance))),
    bus: {
      stopIndex: Math.max(0, Math.min(BUS_STOPS.length - 1, Math.trunc(number(busValue.stopIndex)))),
      minutes: Math.max(0, Math.min(10, Math.trunc(number(busValue.minutes, 10)))),
      breakfast: Boolean(busValue.breakfast),
      delay: Math.max(0, Math.min(10, Math.trunc(number(busValue.delay)))),
      resolved: busResolved,
      outcome: outcome as ChapterTwoState["bus"]["outcome"],
      log: texts(busValue.log)
    },
    resolvedEventIds: texts(value.resolvedEventIds, 30)
  };
  const valid =
    (phase === "result-letter" && !state.framing && !state.message && !busResolved && state.bus.outcome === "pending") ||
    (phase === "async-message" && Boolean(state.framing) && !state.message && !busResolved && state.bus.outcome === "pending") ||
    (phase === "bus-route" && Boolean(state.framing) && Boolean(state.message) && !busResolved && state.bus.outcome === "pending") ||
    (phase === "complete" && Boolean(state.framing) && Boolean(state.message) && busResolved && state.bus.outcome !== "pending");
  return valid ? state : null;
}
