import { applyStatEffects } from "../state";
import type {
  AcademicState,
  BehaviorTendencies,
  CalendarObligation,
  ChapterOneActivityId,
  ChapterOneState,
  ChapterOneWeek,
  ChapterOneWeekPlan,
  GameStats,
  LongTermProgress,
  ScheduledAssignment
} from "../types";
import { ACTIVITIES, activityById, createWeekSlots, getWeekDefinition } from "./model";
import {
  selectZhouWeekTwoAction,
  type ZhouWeekTwoActionId
} from "./character-actions";
import { createWeekExecution } from "./week-events";

const WEEKS: ChapterOneWeek[] = [1, 2, 3, 4];
export const PLAYER_ACTION_LIMIT = 6;

function cloneAssignment(assignment: ScheduledAssignment): ScheduledAssignment {
  return { ...assignment };
}

function clonePlan(plan: ChapterOneWeekPlan): ChapterOneWeekPlan {
  return {
    ...plan,
    assignments: Object.fromEntries(
      Object.entries(plan.assignments).map(([id, assignment]) => [id, cloneAssignment(assignment)])
    )
  };
}

export function cloneChapterOneState(state: ChapterOneState): ChapterOneState {
  return {
    ...state,
    plans: state.plans.map(clonePlan),
    obligations: state.obligations.map((obligation) => ({ ...obligation })),
    results: state.results.map((result) => ({
      ...result,
      completed: [...result.completed],
      changes: [...result.changes],
      echoes: [...result.echoes],
      nextWeek: [...result.nextWeek]
    })),
    weekExecution: state.weekExecution
      ? {
          ...state.weekExecution,
          eventIds: [...state.weekExecution.eventIds],
          choiceIds: [...state.weekExecution.choiceIds],
          log: [...state.weekExecution.log]
        }
      : null,
    weekChallenge: state.weekChallenge
      ? {
          ...state.weekChallenge,
          tracks: { ...state.weekChallenge.tracks },
          charges: { ...state.weekChallenge.charges },
          log: [...state.weekChallenge.log]
        }
      : null,
    relationships: { ...state.relationships },
    resolvedEventIds: [...state.resolvedEventIds],
    seatGame: { ...state.seatGame, log: [...state.seatGame.log] },
    sentence: state.sentence
      ? {
          ...state.sentence,
          fragmentIds: [...state.sentence.fragmentIds],
          actionTypes: [...state.sentence.actionTypes]
        }
      : null,
    exam: { ...state.exam, actionIds: [...state.exam.actionIds] }
  };
}

function cloneProgress(progress: LongTermProgress): LongTermProgress {
  return {
    facts: [...progress.facts],
    tendencies: { ...progress.tendencies },
    academic: { ...progress.academic }
  };
}

export function getWeekPlan(state: ChapterOneState, week = state.currentWeek): ChapterOneWeekPlan {
  const plan = state.plans.find((candidate) => candidate.week === week);
  if (!plan) throw new Error(`Missing chapter-one plan for week ${week}`);
  return plan;
}

export function selectedPlayerActivities(plan: ChapterOneWeekPlan): number {
  return Object.values(plan.assignments).filter(
    (assignment) => assignment.source === "player" && assignment.activityId !== "open"
  ).length;
}

export function canCommitWeek(state: ChapterOneState): { ok: boolean; reason: string } {
  const plan = getWeekPlan(state);
  if (state.phase !== "planning") return { ok: false, reason: "当前不在排程阶段。" };
  if (plan.committed) return { ok: false, reason: "这一周已经写进错题本。" };
  const selected = selectedPlayerActivities(plan);
  if (selected < PLAYER_ACTION_LIMIT) {
    return { ok: false, reason: `还需主动安排 ${PLAYER_ACTION_LIMIT - selected} 格；承诺占用不计入六次选择。` };
  }
  if (selected > PLAYER_ACTION_LIMIT) {
    return { ok: false, reason: `本周只能主动安排 ${PLAYER_ACTION_LIMIT} 格；请把 ${selected - PLAYER_ACTION_LIMIT} 格改回留白。` };
  }
  return { ok: true, reason: "六次主动安排已完成，可以执行这一周。" };
}

export function assignActivity(
  state: ChapterOneState,
  slotId: string,
  activityId: ChapterOneActivityId
): ChapterOneState {
  const next = cloneChapterOneState(state);
  if (next.phase !== "planning") throw new Error("Only a planning week can be edited");
  const plan = getWeekPlan(next);
  if (plan.committed) throw new Error("A committed week cannot be edited");
  const slot = createWeekSlots(next.currentWeek).find((candidate) => candidate.id === slotId);
  if (!slot) throw new Error(`Unknown slot: ${slotId}`);
  const current = plan.assignments[slotId];
  if (!current) throw new Error(`Missing assignment: ${slotId}`);
  if (current.locked) throw new Error("Promise obligations cannot be overwritten before renegotiation");
  const activity = activityById.get(activityId);
  if (!activity) throw new Error(`Unknown activity: ${activityId}`);
  if (!activity.periods.includes(slot.period)) {
    throw new Error(`${activity.label} cannot be assigned to ${slot.periodLabel}`);
  }
  if (activity.category === "承诺") throw new Error("Promise activities are assigned by promise rules");
  const selected = selectedPlayerActivities(plan);
  const addsPlayerAction = activityId !== "open" &&
    (current.source !== "player" || current.activityId === "open");
  if (addsPlayerAction && selected >= PLAYER_ACTION_LIMIT) {
    throw new Error(`本周只有 ${PLAYER_ACTION_LIMIT} 次主动安排；请先把另一格改回留白。`);
  }
  plan.assignments[slotId] = {
    slotId,
    activityId,
    source: "player",
    locked: false,
    status: "planned"
  };
  return next;
}

export function resetCurrentWeek(state: ChapterOneState): ChapterOneState {
  const next = cloneChapterOneState(state);
  const plan = getWeekPlan(next);
  if (plan.committed) return next;
  Object.values(plan.assignments).forEach((assignment) => {
    if (!assignment.locked && assignment.source !== "zhou-tang") {
      plan.assignments[assignment.slotId] = {
        slotId: assignment.slotId,
        activityId: "open",
        source: "player",
        locked: false,
        status: "planned"
      };
    }
  });
  return next;
}

function sumEffects(target: Record<string, number>, effects: Record<string, number> | undefined): void {
  if (!effects) return;
  Object.entries(effects).forEach(([key, value]) => {
    target[key] = (target[key] ?? 0) + value;
  });
}

function applyNumericEffects<T extends Record<string, number>>(target: T, effects: Record<string, number>): T {
  const next: Record<string, number> = { ...target };
  Object.entries(effects).forEach(([key, value]) => {
    const current = next[key];
    if (current !== undefined) next[key] = Math.max(0, Math.min(100, current + value));
  });
  return next as T;
}

function withFacts(progress: LongTermProgress, facts: string[]): LongTermProgress {
  return { ...progress, facts: [...new Set([...progress.facts, ...facts])] };
}

function activityCounts(plan: ChapterOneWeekPlan): Map<ChapterOneActivityId, number> {
  const counts = new Map<ChapterOneActivityId, number>();
  Object.values(plan.assignments).forEach((assignment) => {
    counts.set(assignment.activityId, (counts.get(assignment.activityId) ?? 0) + 1);
  });
  return counts;
}

function markWeekDone(plan: ChapterOneWeekPlan): void {
  plan.committed = true;
  plan.resolved = true;
  Object.values(plan.assignments).forEach((assignment) => {
    assignment.status = assignment.status === "rescheduled" ? "rescheduled" : "done";
  });
}

function fulfillObligations(obligations: CalendarObligation[], week: ChapterOneWeek): void {
  obligations.forEach((obligation) => {
    if (obligation.week === week && obligation.status === "due") obligation.status = "fulfilled";
  });
}

function renegotiateDailyContact(state: ChapterOneState): number {
  let changed = 0;
  state.obligations.forEach((obligation) => {
    if (
      obligation.promiseId !== "daily-total-contact" ||
      obligation.week <= 2 ||
      obligation.status !== "due"
    ) return;
    const dayMatch = /-d(\d+)$/.exec(obligation.id);
    const day = Number(dayMatch?.[1] ?? 0);
    const plan = getWeekPlan(state, obligation.week);
    if ([1, 3, 5].includes(day)) {
      obligation.status = "renegotiated";
      plan.assignments[obligation.slotId] = {
        slotId: obligation.slotId,
        activityId: "open",
        source: "zhou-tang",
        locked: false,
        status: "rescheduled"
      };
      changed += 1;
    } else {
      obligation.activityId = "promise-async";
      obligation.label = "异步交换批注";
      const assignment = plan.assignments[obligation.slotId];
      if (assignment) {
        assignment.activityId = "promise-async";
        assignment.source = "zhou-tang";
      }
    }
  });
  return changed;
}

function addOptionalMutualReview(state: ChapterOneState): boolean {
  const plan = getWeekPlan(state, 3);
  const slotId = "w3-d2-evening";
  const current = plan.assignments[slotId];
  if (!current || current.locked || current.activityId !== "open") return false;
  plan.assignments[slotId] = {
    slotId,
    activityId: "mutual-review",
    source: "zhou-tang",
    locked: false,
    status: "planned"
  };
  return true;
}

function resultForWeek(
  week: ChapterOneWeek,
  counts: Map<ChapterOneActivityId, number>,
  state: ChapterOneState,
  changedContacts: number,
  zhouActionId: ZhouWeekTwoActionId | null
) {
  const completed = [...counts.entries()]
    .filter(([id, count]) => id !== "open" && count > 0)
    .map(([id, count]) => `${activityById.get(id)?.shortLabel ?? id} × ${count}`);
  const blanks = counts.get("open") ?? 0;
  const promiseCount = [...counts.entries()]
    .filter(([id]) => id.startsWith("promise-"))
    .reduce((sum, [, count]) => sum + count, 0);

  if (week === 1) {
    return {
      week,
      title: "第一周 · 新座位",
      completed,
      changes: ["上次月考后的座位表生效，你和周棠被分到教室两端。"],
      echoes: [
        counts.get("observe-seat") ? "你先观察了视线，传页时会多一种可解释的路线。" : "你还没有掌握郭祺抬头的规律。",
        counts.get("help-liang") ? "梁硕记得你替他做过一次值日。" : "梁硕与你仍只是普通同桌。",
        `你主动留下了 ${blanks} 格空白。`
      ],
      nextWeek: ["数学题解与英语作文都需要有人讲清。", promiseCount ? "承诺会继续占用下周日历。" : "下周没有自动占用。"],
      zhouAction: "周棠没有等你替她安排。她把英语作文折在数学题解里，提出交换批注。"
    };
  }
  if (week === 2) {
    const planChange = changedContacts
      ? `周棠把未来 ${changedContacts} 次见面改成留白，并保留周二、周四异步互批。`
      : zhouActionId === "chapter1-zhou-open-invitation"
        ? "周棠发来一次可以拒绝的互批邀请；她没有把那页空白擅自改成新承诺。"
        : "周棠把一次可调整的互批邀请写进下周日历；它不是新承诺，你可以覆盖。";
    return {
      week,
      title: "第二周 · 双向订正",
      completed,
      changes: [planChange],
      echoes: [
        counts.get("mutual-review") || ((counts.get("math-mastery") ?? 0) && (counts.get("english-review") ?? 0))
          ? "数学题解和英语批注都发生了，帮助开始双向流动。"
          : "这一周的帮助仍偏向一边。",
        "改约不是好感检定：她保留了自己的时间。"
      ],
      nextWeek: ["周四走廊约定已经写进日历。", "第17题所在纸页的装订线更松了。"],
      zhouAction:
        zhouActionId === "chapter1-zhou-open-invitation"
          ? "周棠主动提出一次互批，也明确写着：没空就不用回。"
          : changedContacts
            ? "周棠主动改变计划：减少见面，把一部分改成异步互批。"
            : "周棠主动留下可覆盖的互批邀请，也保留你拒绝的空间。"
    };
  }
  if (week === 3) {
    return {
      week,
      title: "第三周 · 空走廊",
      completed,
      changes: ["周棠没有出现在走廊，却在你的桌洞里留下了一份完整题解。"],
      echoes: [
        counts.get("investigate-absence") ? "你只拿到一条来源明确的线索：她在替别人守一个约定。" : "你没有追查她去了哪里。",
        counts.get("notebook-message") ? "你在本页留下了自己的回应。" : "纸页仍只装着她的题解。"
      ],
      nextWeek: ["一模前最后一周开始。", "你需要决定怎样问，而不是决定她必须回答什么。"],
      zhouAction: "她只说明：这件事涉及我答应替别人保密的部分。"
    };
  }
  return {
    week,
    title: "第四周 · 一模",
    completed,
    changes: ["排程结束。接下来只能调用已经练成的方法，不能直接选择分数。"],
    echoes: [
      `掌握、速度与稳定度会共同进入考场；仍有 ${blanks} 格没有被任务填满。`,
      state.relationships.zhouPressure >= 6 ? "过量承诺留下的疲惫也会进入考场。" : "关系没有替代你的备考方法。"
    ],
    nextWeek: ["完成四段考场局面。", "考后，第17题的第三种笔迹会出现。"],
    zhouAction: "周棠在考试前只留下一句：别替我考，也别让我替你考。"
  };
}

export interface ResolveWeekResult {
  chapterOne: ChapterOneState;
  progress: LongTermProgress;
  stats: GameStats;
}

export function resolveCurrentWeek(
  state: ChapterOneState,
  progress: LongTermProgress,
  stats: GameStats
): ResolveWeekResult {
  const permission = canCommitWeek(state);
  if (!permission.ok) throw new Error(permission.reason);
  const next = cloneChapterOneState(state);
  let nextProgress = cloneProgress(progress);
  const plan = getWeekPlan(next);
  const counts = activityCounts(plan);
  const academicEffects: Record<string, number> = {};
  const tendencyEffects: Record<string, number> = {};
  let nextStats = { ...stats };

  createWeekSlots(next.currentWeek).forEach((slot) => {
    const assignment = plan.assignments[slot.id];
    if (!assignment) return;
    const activity = activityById.get(assignment.activityId);
    if (!activity) return;
    sumEffects(academicEffects, activity.academicEffects as Record<string, number> | undefined);
    sumEffects(tendencyEffects, activity.tendencyEffects as Record<string, number> | undefined);
    if (assignment.activityId === "math-speed" && nextStats.energy <= 30) {
      academicEffects.speed = (academicEffects.speed ?? 0) - 3;
      academicEffects.falseMastery = (academicEffects.falseMastery ?? 0) + 2;
      academicEffects.sleepDebt = (academicEffects.sleepDebt ?? 0) + 1;
    }
    nextStats = applyStatEffects(nextStats, activity.statEffects, {
      deriveRebellion: false
    }).stats;
  });

  const contactCount = counts.get("promise-contact") ?? 0;
  if (contactCount > 2) {
    const overload = contactCount - 2;
    nextStats = applyStatEffects(
      nextStats,
      { energy: -overload * 2, stress: overload * 2 },
      { deriveRebellion: false }
    ).stats;
    next.relationships.zhouPressure += overload;
  }
  if ((counts.get("help-liang") ?? 0) > 0) next.relationships.liangFavor += 1;
  if ((counts.get("observe-seat") ?? 0) > 0) next.relationships.seatIntel += 2;
  if ((counts.get("investigate-absence") ?? 0) > 2) tendencyEffects.control = (tendencyEffects.control ?? 0) + 2;

  nextProgress.academic = applyNumericEffects(
    nextProgress.academic as AcademicState & Record<string, number>,
    academicEffects
  ) as AcademicState;
  nextProgress.tendencies = applyNumericEffects(
    nextProgress.tendencies as BehaviorTendencies & Record<string, number>,
    tendencyEffects
  ) as BehaviorTendencies;
  nextStats = applyStatEffects(nextStats, {}, { deriveRebellion: true }).stats;

  markWeekDone(plan);
  fulfillObligations(next.obligations, next.currentWeek);
  const eventId = `chapter1-week-${next.currentWeek}-resolved`;
  next.resolvedEventIds = [...new Set([...next.resolvedEventIds, eventId])];
  let changedContacts = 0;
  let zhouActionId: ZhouWeekTwoActionId | null = null;

  const facts = [eventId];
  if ((counts.get("own-goal") ?? 0) > 0) facts.push("own-goal-practiced");
  if (next.currentWeek === 1) {
    facts.push("page17-binding-loose", "seat-reshuffle-from-monthly-test");
    if ((counts.get("help-liang") ?? 0) > 0) facts.push("liang-favor-earned");
    if ((counts.get("observe-seat") ?? 0) > 0) facts.push("seat-route-observed");
  } else if (next.currentWeek === 2) {
    const hasMath = (counts.get("math-mastery") ?? 0) > 0 || (counts.get("mutual-review") ?? 0) > 0;
    const hasEnglish = (counts.get("english-review") ?? 0) > 0 || (counts.get("mutual-review") ?? 0) > 0;
    if (hasMath) facts.push("chen-explained-math");
    if (hasEnglish) facts.push("zhou-reviewed-english");
    facts.push(hasMath && hasEnglish ? "mutual-help:two-way" : hasMath ? "mutual-help:player-only" : hasEnglish ? "mutual-help:zhou-only" : "mutual-help:none");
    zhouActionId = selectZhouWeekTwoAction(next, nextProgress);
    if (zhouActionId === "chapter1-zhou-renegotiate-contact") {
      changedContacts = renegotiateDailyContact(next);
    } else if (zhouActionId) {
      addOptionalMutualReview(next);
    }
    if (zhouActionId) {
      facts.push("zhou-changed-plan", zhouActionId);
      next.resolvedEventIds = [...new Set([...next.resolvedEventIds, zhouActionId])];
    }
    if (changedContacts) facts.push("daily-contact-renegotiated");
  } else if (next.currentWeek === 3) {
    facts.push("zhou-protected-unnamed-person", "complete-solution-left", "zhou-missed-corridor-meeting");
  } else {
    facts.push("first-mock-schedule-complete");
  }

  nextProgress = withFacts(nextProgress, facts);
  const result = resultForWeek(next.currentWeek, counts, next, changedContacts, zhouActionId);
  next.results = [...next.results.filter((candidate) => candidate.week !== next.currentWeek), result];
  next.phase = "week-events";
  next.weekExecution = createWeekExecution(next);
  return { chapterOne: next, progress: nextProgress, stats: nextStats };
}

export function advanceAfterReview(
  state: ChapterOneState,
  progress: LongTermProgress
): { chapterOne: ChapterOneState; progress: LongTermProgress } {
  if (state.phase !== "review") throw new Error("The current week is not ready to archive");
  const next = cloneChapterOneState(state);
  let nextProgress = cloneProgress(progress);
  if (next.currentWeek < 4) {
    next.currentWeek = (next.currentWeek + 1) as ChapterOneWeek;
    next.phase = "planning";
    next.weekExecution = null;
    next.weekChallenge = null;
  } else {
    if (!next.exam.resolved) throw new Error("The mock exam must be resolved before chapter completion");
    next.phase = "complete";
    nextProgress = withFacts(nextProgress, ["chapter-one-complete", "third-handwriting-seen"]);
  }
  return { chapterOne: next, progress: nextProgress };
}

export function activitiesForSlot(period: "break" | "evening") {
  return ACTIVITIES.filter(
    (activity) => activity.periods.includes(period) && activity.category !== "承诺"
  );
}

export function allChapterOneWeeks(): ChapterOneWeek[] {
  return [...WEEKS];
}

export function currentWeekLabel(state: ChapterOneState): string {
  const definition = getWeekDefinition(state.currentWeek);
  return `第${state.currentWeek}周 · ${definition.title}`;
}
