import { STAT_KEYS } from "./types";
import { EXAM_STAGES } from "./chapter-one/exam";
import { CHAPTER_ONE_WEEKS, ACTIVITIES, createWeekSlots } from "./chapter-one/model";
import { SENTENCE_FRAGMENTS } from "./chapter-one/sentence";

export interface ContentIssue {
  scope: "weeks" | "activities" | "sentence" | "exam";
  id: string;
  message: string;
}

const ACADEMIC_KEYS = new Set(["mastery", "speed", "stability", "falseMastery", "sleepDebt"]);
const TENDENCY_KEYS = new Set([
  "listening",
  "explanation",
  "responsibility",
  "avoidance",
  "control",
  "defiance"
]);

function effectKeys(value: object | undefined): string[] {
  return value ? Object.keys(value) : [];
}

export function validateChapterOneContent(): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const weekIds = CHAPTER_ONE_WEEKS.map((week) => week.week);
  if (weekIds.length !== 4 || new Set(weekIds).size !== 4) {
    issues.push({ scope: "weeks", id: "week-count", message: "第一章必须有四个唯一周定义。" });
  }
  weekIds.forEach((week) => {
    const slots = createWeekSlots(week);
    if (slots.length !== 14 || new Set(slots.map((slot) => slot.id)).size !== 14) {
      issues.push({ scope: "weeks", id: `week-${week}-slots`, message: "每周必须有十四个唯一时间格。" });
    }
  });

  const activityIds = ACTIVITIES.map((activity) => activity.id);
  if (new Set(activityIds).size !== activityIds.length) {
    issues.push({ scope: "activities", id: "duplicate-id", message: "活动注册表包含重复 ID。" });
  }
  ACTIVITIES.forEach((activity) => {
    if (!activity.periods.length) {
      issues.push({ scope: "activities", id: activity.id, message: "活动至少要声明一个可安排时段。" });
    }
    effectKeys(activity.statEffects).forEach((key) => {
      if (!STAT_KEYS.includes(key as (typeof STAT_KEYS)[number])) {
        issues.push({ scope: "activities", id: activity.id, message: `未知状态字段：${key}。` });
      }
    });
    effectKeys(activity.academicEffects).forEach((key) => {
      if (!ACADEMIC_KEYS.has(key)) {
        issues.push({ scope: "activities", id: activity.id, message: `未知学业字段：${key}。` });
      }
    });
    effectKeys(activity.tendencyEffects).forEach((key) => {
      if (!TENDENCY_KEYS.has(key)) {
        issues.push({ scope: "activities", id: activity.id, message: `未知习惯字段：${key}。` });
      }
    });
  });

  const sentenceIds = new Set(SENTENCE_FRAGMENTS.map((fragment) => fragment.id));
  if (new Set(sentenceIds).size !== SENTENCE_FRAGMENTS.length) {
    issues.push({ scope: "sentence", id: "duplicate-id", message: "句段 ID 必须唯一。" });
  }
  (['open', 'middle', 'close'] as const).forEach((position) => {
    if (!SENTENCE_FRAGMENTS.some((fragment) => fragment.position === position)) {
      issues.push({ scope: "sentence", id: `missing-${position}`, message: `缺少${position}位置句段。` });
    }
  });
  SENTENCE_FRAGMENTS.forEach((fragment) => {
    fragment.incompatibleWith?.forEach((id) => {
      if (!sentenceIds.has(id)) {
        issues.push({ scope: "sentence", id: fragment.id, message: `互斥句段不存在：${id}。` });
      }
    });
  });

  const examActionIds = new Set<string>();
  if (EXAM_STAGES.length !== 4) {
    issues.push({ scope: "exam", id: "stage-count", message: "一模必须有四个阶段。" });
  }
  EXAM_STAGES.forEach((stage, stageIndex) => {
    if (stage.actions.length < 3) {
      issues.push({ scope: "exam", id: `stage-${stageIndex + 1}`, message: "每个一模阶段至少需要三个方法动作。" });
    }
    stage.actions.forEach((action) => {
      if (examActionIds.has(action.id)) {
        issues.push({ scope: "exam", id: action.id, message: "一模动作 ID 必须跨阶段唯一。" });
      }
      examActionIds.add(action.id);
      if (!Number.isFinite(action.methodBonus)) {
        issues.push({ scope: "exam", id: action.id, message: "方法加成必须是有限数字。" });
      }
      effectKeys(action.statEffects).forEach((key) => {
        if (!STAT_KEYS.includes(key as (typeof STAT_KEYS)[number])) {
          issues.push({ scope: "exam", id: action.id, message: `未知状态字段：${key}。` });
        }
      });
      effectKeys(action.academicEffects).forEach((key) => {
        if (!ACADEMIC_KEYS.has(key)) {
          issues.push({ scope: "exam", id: action.id, message: `未知学业字段：${key}。` });
        }
      });
    });
  });
  return issues;
}
