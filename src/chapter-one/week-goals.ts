import type { ChapterOneActivityId, ChapterOneState } from "../types";
import { getWeekPlan } from "./schedule";

export interface WeekGoalStatus {
  id: string;
  label: string;
  detail: string;
  complete: boolean;
}

function activityCounts(state: ChapterOneState): Map<ChapterOneActivityId, number> {
  const counts = new Map<ChapterOneActivityId, number>();
  Object.values(getWeekPlan(state).assignments).forEach((assignment) => {
    counts.set(assignment.activityId, (counts.get(assignment.activityId) ?? 0) + 1);
  });
  return counts;
}

function total(counts: Map<ChapterOneActivityId, number>, ids: ChapterOneActivityId[]): number {
  return ids.reduce((sum, id) => sum + (counts.get(id) ?? 0), 0);
}

export function evaluateWeekGoals(state: ChapterOneState): WeekGoalStatus[] {
  const counts = activityCounts(state);
  const study = total(counts, ["math-mastery", "math-speed", "english-review", "mutual-review"]);
  const recovery = total(counts, ["rest", "own-goal"]);

  if (state.currentWeek === 1) {
    return [
      { id: "mock-prep", label: "周测准备", detail: "至少安排两次有效学习。", complete: study >= 2 },
      {
        id: "seat-route",
        label: "座位路线",
        detail: "观察视线，或先获得梁硕的帮助。",
        complete: total(counts, ["observe-seat", "help-liang"]) >= 1
      },
      { id: "keep-energy", label: "保留体力", detail: "至少安排一次恢复或个人目标。", complete: recovery >= 1 }
    ];
  }

  if (state.currentWeek === 2) {
    const twoWay = (counts.get("mutual-review") ?? 0) > 0 ||
      ((counts.get("math-mastery") ?? 0) > 0 && (counts.get("english-review") ?? 0) > 0);
    const contacts = counts.get("promise-contact") ?? 0;
    return [
      { id: "two-way", label: "双向帮助", detail: "让数学题解和英语批注都发生。", complete: twoWay },
      { id: "own-time", label: "关系之外", detail: "保留一次恢复或自己的目标。", complete: recovery >= 1 },
      {
        id: "bearable-promise",
        label: "承诺可承受",
        detail: "每周固定见面不超过两次，或改成异步互批。",
        complete: contacts <= 2 || (counts.get("promise-async") ?? 0) > 0
      }
    ];
  }

  if (state.currentWeek === 3) {
    const investigations = counts.get("investigate-absence") ?? 0;
    return [
      {
        id: "evidence-only",
        label: "只问事实",
        detail: "调查一次或两次，不把焦虑变成追踪。",
        complete: investigations >= 1 && investigations <= 2
      },
      {
        id: "leave-reply",
        label: "留下回应",
        detail: "在本页回应，或完成一次双向互批。",
        complete: total(counts, ["notebook-message", "mutual-review"]) >= 1
      },
      { id: "exam-method", label: "一模方法", detail: "至少安排两次有效学习。", complete: study >= 2 }
    ];
  }

  return [
    { id: "mastery", label: "真正掌握", detail: "至少两次题解或作文复盘。", complete: total(counts, ["math-mastery", "english-review", "mutual-review"]) >= 2 },
    { id: "speed", label: "限时调用", detail: "至少完成一次速度训练。", complete: (counts.get("math-speed") ?? 0) >= 1 },
    { id: "stability", label: "考场稳定", detail: "至少安排一次恢复。", complete: (counts.get("rest") ?? 0) >= 1 }
  ];
}
