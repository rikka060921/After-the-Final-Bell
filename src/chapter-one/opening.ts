import type {
  CalendarObligation,
  ChapterOneState,
  ChapterOneWeek,
  ChapterOneWeekPlan,
  LongTermProgress,
  OpeningProfile,
  ScheduledAssignment
} from "../types";
import { clamp } from "../state";
import { createWeekSlots, slotId } from "./model";

const WEEKS: ChapterOneWeek[] = [1, 2, 3, 4];

function openAssignment(slot: { id: string }): ScheduledAssignment {
  return {
    slotId: slot.id,
    activityId: "open",
    source: "player",
    locked: false,
    status: "planned"
  };
}

function createEmptyPlans(): ChapterOneWeekPlan[] {
  return WEEKS.map((week) => ({
    week,
    assignments: Object.fromEntries(createWeekSlots(week).map((slot) => [slot.id, openAssignment(slot)])),
    committed: false,
    resolved: false
  }));
}

function createObligations(profile: OpeningProfile): CalendarObligation[] {
  const promise = profile.promises.find((entry) => entry.status === "active");
  if (!promise || promise.id === "blank-page") return [];

  if (promise.id === "two-independent-goals") {
    return WEEKS.map((week) => ({
      id: `two-goals-w${week}`,
      promiseId: promise.id,
      week,
      slotId: slotId(week, 6, "evening"),
      activityId: "promise-review",
      label: "复盘两个目标",
      status: "due"
    }));
  }

  if (promise.id === "daily-total-contact") {
    return WEEKS.flatMap((week) =>
      [0, 1, 2, 3, 4].map((dayIndex) => ({
        id: `daily-contact-w${week}-d${dayIndex + 1}`,
        promiseId: promise.id,
        week,
        slotId: slotId(week, dayIndex, "evening"),
        activityId: "promise-contact" as const,
        label: "每天晚自习后见面",
        status: "due" as const
      }))
    );
  }

  return [];
}

function applyObligations(
  plans: ChapterOneWeekPlan[],
  obligations: CalendarObligation[]
): ChapterOneWeekPlan[] {
  return plans.map((plan) => {
    const assignments = { ...plan.assignments };
    obligations
      .filter((obligation) => obligation.week === plan.week)
      .forEach((obligation) => {
        assignments[obligation.slotId] = {
          slotId: obligation.slotId,
          activityId: obligation.activityId,
          source: "promise",
          locked: true,
          status: "planned",
          obligationId: obligation.id
        };
      });
    return { ...plan, assignments };
  });
}

function hasDecision(profile: OpeningProfile, id: string): boolean {
  return profile.decisionIds.includes(id);
}

export function createLongTermProgress(profile: OpeningProfile): LongTermProgress {
  const tendencies = {
    listening: hasDecision(profile, "notice_her") ? 3 : hasDecision(profile, "notice_joke") ? 1 : 0,
    explanation: hasDecision(profile, "truth_honest") ? 3 : hasDecision(profile, "note_reply_warm") ? 1 : 0,
    responsibility: hasDecision(profile, "hide_take") || hasDecision(profile, "truth_honest") ? 2 : 0,
    avoidance:
      (hasDecision(profile, "truth_escape") ? 3 : 0) +
      (hasDecision(profile, "plan_stop") || hasDecision(profile, "note_reply_cold") ? 1 : 0),
    control: hasDecision(profile, "pact_tight") ? 2 : 0,
    defiance:
      (hasDecision(profile, "hide_stair") ? 2 : 0) +
      (hasDecision(profile, "note_reply_rebel") ? 1 : 0)
  };

  const facts = ["prologue-complete"];
  if (hasDecision(profile, "plan_stop")) facts.push("contact-paused-before-mock");
  if (hasDecision(profile, "hide_open")) facts.push("cross-review-publicly-explainable");
  if (hasDecision(profile, "hide_take")) facts.push("player-offered-to-carry-risk");
  if (profile.notebook.slots.filter((slot) => slot === "solution").length >= 3) {
    facts.push("notebook-solution-space");
  }
  const promise = profile.promises[0];
  if (promise) facts.push(`opening-promise:${promise.id}`);

  return {
    facts,
    tendencies,
    academic: {
      mastery: clamp(42 + (profile.stats.study - 50) * 0.45, 20, 78),
      speed: clamp(38 + (profile.stats.study - 50) * 0.25, 20, 72),
      stability: clamp(45 + (profile.stats.energy - 50) * 0.35 - (profile.stats.stress - 50) * 0.25, 18, 78),
      falseMastery: profile.stats.energy < 34 ? 3 : 0,
      sleepDebt: clamp((50 - profile.stats.energy) / 4, 0, 10)
    }
  };
}

export function createChapterOneState(profile: OpeningProfile): ChapterOneState {
  const obligations = createObligations(profile);
  return {
    schemaVersion: 1,
    currentWeek: 1,
    phase: "planning",
    plans: applyObligations(createEmptyPlans(), obligations),
    obligations,
    results: [],
    relationships: {
      liangFavor: 0,
      guoSuspicion: clamp(Math.round(profile.stats.risk / 8), 0, 12),
      zhouPressure: profile.promises.some((promise) => promise.id === "daily-total-contact") ? 3 : 0,
      seatIntel: 0
    },
    resolvedEventIds: [],
    seatGame: {
      turn: 0,
      carrierSeatId: "r6c2",
      attention: 0,
      log: ["纸页还在你手里。张苇正沿中间过道检查订正。"],
      resolved: false,
      outcome: "pending"
    },
    sentence: null,
    exam: {
      step: 0,
      actionIds: [],
      resolved: false,
      band: null,
      effectiveScore: null,
      note: ""
    }
  };
}

export function initializeChapterOne(profile: OpeningProfile): {
  chapterOne: ChapterOneState;
  progress: LongTermProgress;
} {
  return {
    chapterOne: createChapterOneState(profile),
    progress: createLongTermProgress(profile)
  };
}
