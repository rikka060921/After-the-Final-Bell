import type {
  AssignmentSource,
  AssignmentStatus,
  BehaviorTendencies,
  CalendarObligation,
  ChapterOneActivityId,
  ChapterOnePhase,
  ChapterOneState,
  ChapterOneWeek,
  ChapterOneWeekPlan,
  LongTermProgress,
  ScheduledAssignment,
  WeekExecutionState
} from "../types";
import { activityById, createWeekSlots } from "./model";
import { isKnownWeekEvent, isKnownWeekEventChoice } from "./week-events";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function number(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function texts(value: unknown, limit = 100): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))].slice(0, limit)
    : [];
}

const weeks = new Set<ChapterOneWeek>([1, 2, 3, 4]);
const phases = new Set<ChapterOnePhase>([
  "planning",
  "week-events",
  "seat-game",
  "sentence-game",
  "review",
  "exam",
  "complete"
]);
const statuses = new Set<AssignmentStatus>(["planned", "done", "missed", "rescheduled"]);

function sanitizeWeekExecution(value: unknown, currentWeek: ChapterOneWeek): WeekExecutionState | null {
  if (!isRecord(value) || number(value.week) !== currentWeek) return null;
  const eventIds = texts(value.eventIds, 3).filter(isKnownWeekEvent);
  const cursor = Math.max(0, Math.min(eventIds.length, Math.trunc(number(value.cursor))));
  const rawChoices = texts(value.choiceIds, 3);
  if (eventIds.length !== 3 || rawChoices.length !== cursor) return null;
  const choiceIds = rawChoices.filter((choiceId, index) =>
    isKnownWeekEventChoice(eventIds[index] ?? "", choiceId)
  );
  if (choiceIds.length !== rawChoices.length) return null;
  return {
    week: currentWeek,
    eventIds,
    cursor,
    choiceIds,
    log: texts(value.log, 3).slice(0, cursor)
  };
}

export function defaultLongTermProgress(): LongTermProgress {
  return {
    facts: [],
    tendencies: {
      listening: 0,
      explanation: 0,
      responsibility: 0,
      avoidance: 0,
      control: 0,
      defiance: 0
    },
    academic: {
      mastery: 45,
      speed: 40,
      stability: 45,
      falseMastery: 0,
      sleepDebt: 0
    }
  };
}

export function sanitizeLongTermProgress(value: unknown): LongTermProgress {
  const defaults = defaultLongTermProgress();
  if (!isRecord(value)) return defaults;
  const tendencies = isRecord(value.tendencies) ? value.tendencies : {};
  const academic = isRecord(value.academic) ? value.academic : {};
  return {
    facts: texts(value.facts, 400),
    tendencies: {
      listening: number(tendencies.listening),
      explanation: number(tendencies.explanation),
      responsibility: number(tendencies.responsibility),
      avoidance: number(tendencies.avoidance),
      control: number(tendencies.control),
      defiance: number(tendencies.defiance)
    },
    academic: {
      mastery: number(academic.mastery, defaults.academic.mastery),
      speed: number(academic.speed, defaults.academic.speed),
      stability: number(academic.stability, defaults.academic.stability),
      falseMastery: number(academic.falseMastery),
      sleepDebt: number(academic.sleepDebt)
    }
  };
}

function sanitizeObligations(value: unknown): CalendarObligation[] {
  if (!Array.isArray(value)) return [];
  const obligationStatuses = new Set<CalendarObligation["status"]>([
    "due",
    "fulfilled",
    "missed",
    "renegotiated"
  ]);
  const seenIds = new Set<string>();
  const seenSlots = new Set<string>();
  return value
    .filter(isRecord)
    .map((item): CalendarObligation | null => {
      const week = number(item.week) as ChapterOneWeek;
      const activityId = text(item.activityId) as ChapterOneActivityId;
      const status = text(item.status) as CalendarObligation["status"];
      const id = text(item.id);
      const slotId = text(item.slotId);
      if (
        !id ||
        !weeks.has(week) ||
        !createWeekSlots(week).some((slot) => slot.id === slotId) ||
        !activityById.has(activityId)
      ) return null;
      return {
        id,
        promiseId: text(item.promiseId),
        week,
        slotId,
        activityId,
        label: text(item.label, "承诺占用"),
        status: obligationStatuses.has(status) ? status : "due"
      };
    })
    .filter((item): item is CalendarObligation => item !== null)
    .filter((item) => {
      const slotKey = `${item.week}:${item.slotId}`;
      if (seenIds.has(item.id) || seenSlots.has(slotKey)) return false;
      seenIds.add(item.id);
      seenSlots.add(slotKey);
      return true;
    })
    .slice(0, 80);
}

function sanitizeAssignment(
  value: unknown,
  slotId: string,
  obligationsById: Map<string, CalendarObligation>
): ScheduledAssignment {
  const fallback: ScheduledAssignment = {
    slotId,
    activityId: "open",
    source: "player",
    locked: false,
    status: "planned"
  };
  if (!isRecord(value)) return fallback;
  const obligationId = text(value.obligationId);
  const linkedObligation = obligationId ? obligationsById.get(obligationId) : undefined;
  const linked = linkedObligation?.slotId === slotId ? linkedObligation : undefined;
  const activityId = (linked?.activityId ?? text(value.activityId)) as ChapterOneActivityId;
  const source = text(value.source) as AssignmentSource;
  const status = text(value.status) as AssignmentStatus;
  if (!activityById.has(activityId)) return fallback;
  if (activityById.get(activityId)?.category === "承诺" && !linked) return fallback;
  return {
    slotId,
    activityId,
    source: linked ? (source === "zhou-tang" ? source : "promise") : source === "zhou-tang" ? source : "player",
    locked: Boolean(linked),
    status: statuses.has(status) ? status : "planned",
    ...(linked ? { obligationId: linked.id } : {})
  };
}

function sanitizePlans(value: unknown, obligations: CalendarObligation[]): ChapterOneWeekPlan[] {
  const values = Array.isArray(value) ? value.filter(isRecord) : [];
  const obligationsById = new Map(obligations.map((obligation) => [obligation.id, obligation]));
  const plans = ([1, 2, 3, 4] as ChapterOneWeek[]).map((week) => {
    const raw = values.find((item) => number(item.week) === week);
    const rawAssignments = raw && isRecord(raw.assignments) ? raw.assignments : {};
    const assignments = Object.fromEntries(
      createWeekSlots(week).map((slot) => [
        slot.id,
        sanitizeAssignment(rawAssignments[slot.id], slot.id, obligationsById)
      ])
    );
    return {
      week,
      assignments,
      committed: Boolean(raw?.committed),
      resolved: Boolean(raw?.resolved)
    };
  });
  obligations.forEach((obligation) => {
    if (obligation.status !== "due" && obligation.status !== "fulfilled") return;
    const plan = plans.find((candidate) => candidate.week === obligation.week);
    if (!plan) return;
    const current = plan.assignments[obligation.slotId];
    plan.assignments[obligation.slotId] = {
      slotId: obligation.slotId,
      activityId: obligation.activityId,
      source:
        current?.source === "zhou-tang" || obligation.activityId === "promise-async"
          ? "zhou-tang"
          : "promise",
      locked: true,
      status: plan.resolved ? "done" : "planned",
      obligationId: obligation.id
    };
  });
  return plans;
}

function isRecoverableChapterOneState(state: ChapterOneState): boolean {
  const resultWeeks = new Set(state.results.map((result) => result.week));
  if (resultWeeks.size !== state.results.length) return false;

  for (const plan of state.plans) {
    const shouldBeResolved =
      plan.week < state.currentWeek ||
      (plan.week === state.currentWeek && state.phase !== "planning");
    if (plan.committed !== plan.resolved || plan.resolved !== shouldBeResolved) return false;
    if (resultWeeks.has(plan.week) !== plan.resolved) return false;
  }

  if (state.phase === "seat-game" && state.currentWeek !== 1) return false;
  if (state.phase === "sentence-game" && state.currentWeek !== 3) return false;
  if (state.phase === "exam" && state.currentWeek !== 4) return false;
  if (state.phase === "complete" && state.currentWeek !== 4) return false;
  if (state.phase === "week-events") {
    if (!state.weekExecution || state.weekExecution.cursor >= state.weekExecution.eventIds.length) return false;
  } else if (state.weekExecution && state.weekExecution.cursor < state.weekExecution.eventIds.length) {
    return false;
  }
  if (state.phase === "planning" && state.weekExecution) return false;

  const seatPending = state.seatGame.outcome === "pending";
  if (state.seatGame.resolved === seatPending) return false;
  if (!state.seatGame.resolved && state.seatGame.turn >= 5) return false;
  const seatMustBeResolved =
    state.currentWeek > 1 || (state.currentWeek === 1 && state.phase === "review");
  if (seatMustBeResolved && !state.seatGame.resolved) return false;
  if (state.currentWeek === 1 && state.phase === "planning" && state.seatGame.resolved) return false;

  const sentenceMustExist =
    state.currentWeek > 3 || (state.currentWeek === 3 && state.phase === "review");
  if (Boolean(state.sentence) !== sentenceMustExist) return false;
  if (
    state.sentence &&
    (state.sentence.fragmentIds.length < 2 ||
      state.sentence.fragmentIds.length > 3 ||
      !state.sentence.text)
  ) return false;

  const examIsActive = state.currentWeek === 4 && state.phase === "exam";
  const examIsResolved =
    state.currentWeek === 4 && (state.phase === "review" || state.phase === "complete");
  if (examIsActive) {
    if (
      state.exam.resolved ||
      state.exam.step < 0 ||
      state.exam.step >= 4 ||
      state.exam.actionIds.length !== state.exam.step ||
      state.exam.band !== null ||
      state.exam.effectiveScore !== null
    ) return false;
  } else if (examIsResolved) {
    if (
      !state.exam.resolved ||
      state.exam.step !== 4 ||
      state.exam.actionIds.length !== 4 ||
      state.exam.band === null ||
      state.exam.effectiveScore === null
    ) return false;
  } else if (
    state.exam.resolved ||
    state.exam.step !== 0 ||
    state.exam.actionIds.length !== 0 ||
    state.exam.band !== null ||
    state.exam.effectiveScore !== null
  ) return false;

  for (const obligation of state.obligations) {
    const plan = state.plans.find((candidate) => candidate.week === obligation.week);
    if (!plan) return false;
    if (plan.resolved && obligation.status === "due") return false;
    if (!plan.resolved && ["fulfilled", "missed"].includes(obligation.status)) return false;
    if (obligation.status === "due" || obligation.status === "fulfilled") {
      const assignment = plan.assignments[obligation.slotId];
      if (
        !assignment ||
        assignment.obligationId !== obligation.id ||
        assignment.activityId !== obligation.activityId ||
        !assignment.locked
      ) return false;
    }
  }
  return true;
}

export function sanitizeChapterOneState(value: unknown): ChapterOneState | null {
  if (!isRecord(value) || number(value.schemaVersion) !== 1) return null;
  const currentWeek = number(value.currentWeek) as ChapterOneWeek;
  const phase = text(value.phase) as ChapterOnePhase;
  if (!weeks.has(currentWeek) || !phases.has(phase)) return null;
  const obligations = sanitizeObligations(value.obligations);
  const relationships = isRecord(value.relationships) ? value.relationships : {};
  const seat = isRecord(value.seatGame) ? value.seatGame : {};
  const seatOutcome = text(seat.outcome);
  const exam = isRecord(value.exam) ? value.exam : {};
  const band = text(exam.band);
  const sentence = isRecord(value.sentence) ? value.sentence : null;
  const pageAction = sentence ? text(sentence.pageAction) : "";
  const plans = sanitizePlans(value.plans, obligations);
  const carrierSeatId = text(seat.carrierSeatId, "r6c2");
  const weekExecution = sanitizeWeekExecution(value.weekExecution, currentWeek);

  const state: ChapterOneState = {
    schemaVersion: 1,
    currentWeek,
    phase,
    plans,
    obligations,
    results: Array.isArray(value.results)
      ? value.results
          .filter(isRecord)
          .map((result) => ({
            week: number(result.week) as ChapterOneWeek,
            title: text(result.title),
            completed: texts(result.completed, 30),
            changes: texts(result.changes, 30),
            echoes: texts(result.echoes, 30),
            nextWeek: texts(result.nextWeek, 30),
            zhouAction: text(result.zhouAction)
          }))
          .filter((result) => weeks.has(result.week))
          .slice(0, 4)
      : [],
    weekExecution,
    relationships: {
      liangFavor: number(relationships.liangFavor),
      guoSuspicion: number(relationships.guoSuspicion),
      zhouPressure: number(relationships.zhouPressure),
      seatIntel: number(relationships.seatIntel)
    },
    resolvedEventIds: texts(value.resolvedEventIds, 160),
    seatGame: {
      turn: Math.max(0, Math.min(5, Math.trunc(number(seat.turn)))),
      carrierSeatId: ["r6c2", "r5c3", "r2c5"].includes(carrierSeatId)
        ? carrierSeatId
        : "r6c2",
      attention: Math.max(0, Math.min(12, number(seat.attention))),
      log: texts(seat.log, 20),
      resolved: Boolean(seat.resolved),
      outcome: ["pending", "delivered", "noticed", "returned"].includes(seatOutcome)
        ? (seatOutcome as ChapterOneState["seatGame"]["outcome"])
        : "pending"
    },
    sentence:
      sentence && ["intact", "torn", "returned"].includes(pageAction)
        ? {
            fragmentIds: texts(sentence.fragmentIds, 3),
            text: text(sentence.text),
            actionTypes: texts(sentence.actionTypes, 3),
            pageAction: pageAction as "intact" | "torn" | "returned"
          }
        : null,
    exam: {
      step: Math.max(0, Math.min(4, Math.trunc(number(exam.step)))),
      actionIds: texts(exam.actionIds, 4),
      resolved: Boolean(exam.resolved),
      band: ["突破", "稳定", "波动", "失常"].includes(band)
        ? (band as NonNullable<ChapterOneState["exam"]["band"]>)
        : null,
      effectiveScore: typeof exam.effectiveScore === "number" && Number.isFinite(exam.effectiveScore)
        ? exam.effectiveScore
        : null,
      note: text(exam.note)
    }
  };
  return isRecoverableChapterOneState(state) ? state : null;
}
