import { applyStatEffects } from "../state";
import type {
  AcademicState,
  ChapterOneState,
  GameStats,
  LongTermProgress,
  StatEffects
} from "../types";
import { cloneChapterOneState } from "./schedule";

export interface ExamAction {
  id: string;
  label: string;
  description: string;
  academicEffects: Partial<AcademicState>;
  statEffects: StatEffects;
  methodBonus: number;
}

export interface ExamStage {
  title: string;
  paper: string;
  scene: string;
  actions: ExamAction[];
}

export const EXAM_STAGES: readonly ExamStage[] = [
  {
    title: "先看整张卷",
    paper: "数学 · 开考三分钟",
    scene: "第17题的位置和练习时一样，但最后一问换了条件。你还没有落笔。",
    actions: [
      { id: "scan-first", label: "先扫描题型与分值", description: "按训练过的顺序标出可拿分区域。", academicEffects: { stability: 2, speed: 1 }, statEffects: { stress: -1 }, methodBonus: 2 },
      { id: "start-seventeen", label: "直接从第17题开始", description: "熟悉感很强，但会打乱整卷节奏。", academicEffects: { falseMastery: 1 }, statEffects: { stress: 2 }, methodBonus: -1 },
      { id: "answer-order", label: "按卷面顺序作答", description: "不额外判断，沿固定顺序推进。", academicEffects: {}, statEffects: {}, methodBonus: 0 }
    ]
  },
  {
    title: "一道题卡住",
    paper: "数学 · 还剩六十二分钟",
    scene: "草稿已经写满半页，答案仍差一步。周围只剩翻卷子的声音。",
    actions: [
      { id: "skip-mark", label: "标记后跳过", description: "把已知步骤留好，先取下一道题的分。", academicEffects: { speed: 2, stability: 1 }, statEffects: { stress: -1 }, methodBonus: 3 },
      { id: "breathe-reframe", label: "呼吸，再重写条件", description: "用稳定训练换一次重新观察。", academicEffects: { stability: 3 }, statEffects: { stress: -2 }, methodBonus: 2 },
      { id: "hard-push", label: "继续硬推到底", description: "也许能撞开，也可能把后面的时间一起压缩。", academicEffects: { mastery: 1, sleepDebt: 1 }, statEffects: { energy: -2, stress: 3 }, methodBonus: -2 }
    ]
  },
  {
    title: "走廊传来争执",
    paper: "英语 · 听力结束后",
    scene: "门外有人压低声音争执。你认不出是谁，但空走廊的记忆突然回来。",
    actions: [
      { id: "recall-routine", label: "调用平时的阅读节奏", description: "先圈主语，再看转折，不追声音。", academicEffects: { stability: 3, mastery: 1 }, statEffects: { stress: -1 }, methodBonus: 3 },
      { id: "check-clock", label: "反复确认剩余时间", description: "获得时间信息，也让注意力多次切换。", academicEffects: { speed: 1, falseMastery: 1 }, statEffects: { stress: 1 }, methodBonus: 0 },
      { id: "listen-door", label: "分辨门外是谁", description: "你试图确认未知信息，卷面暂时停住。", academicEffects: { stability: -2 }, statEffects: { stress: 2 }, methodBonus: -2 }
    ]
  },
  {
    title: "最后十二分钟",
    paper: "综合 · 收卷前",
    scene: "答题卡还有两处犹豫。你无法让所有答案同时变得确定。",
    actions: [
      { id: "check-errors", label: "按错题类型检查", description: "只检查最常见的单位、符号和漏项。", academicEffects: { mastery: 1, stability: 2 }, statEffects: {}, methodBonus: 3 },
      { id: "fill-everything", label: "把每一处空白都填满", description: "空白减少了，但判断依据没有增加。", academicEffects: { speed: 2, falseMastery: 2 }, statEffects: { stress: 1 }, methodBonus: -1 },
      { id: "stop-breathe", label: "停笔，稳定呼吸", description: "接受已经完成的部分，避免最后一分钟改错。", academicEffects: { stability: 3 }, statEffects: { stress: -2 }, methodBonus: 2 }
    ]
  }
] as const;

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function applyAcademicEffects(academic: AcademicState, effects: Partial<AcademicState>): AcademicState {
  const next = { ...academic };
  (Object.keys(effects) as (keyof AcademicState)[]).forEach((key) => {
    next[key] = clamp(next[key] + (effects[key] ?? 0));
  });
  return next;
}

function selectedActions(actionIds: string[]): ExamAction[] {
  return actionIds
    .map((id) => EXAM_STAGES.flatMap((stage) => stage.actions).find((action) => action.id === id))
    .filter((action): action is ExamAction => Boolean(action));
}

function examBand(score: number): "突破" | "稳定" | "波动" | "失常" {
  if (score >= 65) return "突破";
  if (score >= 52) return "稳定";
  if (score >= 40) return "波动";
  return "失常";
}

export function playExamAction(
  state: ChapterOneState,
  progress: LongTermProgress,
  stats: GameStats,
  actionId: string
): { chapterOne: ChapterOneState; progress: LongTermProgress; stats: GameStats } {
  if (state.phase !== "exam" || state.exam.resolved) throw new Error("Mock exam is not active");
  const stage = EXAM_STAGES[state.exam.step];
  const action = stage?.actions.find((candidate) => candidate.id === actionId);
  if (!stage || !action) throw new Error(`Exam action is not available: ${actionId}`);
  const next = cloneChapterOneState(state);
  const nextProgress: LongTermProgress = {
    ...progress,
    facts: [...progress.facts],
    tendencies: { ...progress.tendencies },
    academic: applyAcademicEffects(progress.academic, action.academicEffects)
  };
  const isFinalStage = state.exam.step === EXAM_STAGES.length - 1;
  const nextStats = applyStatEffects(stats, action.statEffects, {
    deriveRebellion: isFinalStage
  }).stats;
  next.exam.actionIds.push(action.id);
  next.exam.step += 1;

  if (next.exam.step >= EXAM_STAGES.length) {
    const methodBonus = selectedActions(next.exam.actionIds).reduce((sum, item) => sum + item.methodBonus, 0);
    const academic = nextProgress.academic;
    const physicalAdjustment = (nextStats.energy - 50) * 0.08 - Math.max(0, nextStats.stress - 65) * 0.09;
    const score = clamp(
      academic.mastery * 0.45 +
        academic.stability * 0.35 +
        academic.speed * 0.2 +
        methodBonus +
        physicalAdjustment -
        academic.falseMastery * 1.5 -
        academic.sleepDebt * 1.2
    );
    const band = examBand(score);
    next.exam.resolved = true;
    next.exam.band = band;
    next.exam.effectiveScore = Math.round(score * 10) / 10;
    next.exam.note =
      band === "突破"
        ? "你没有做出一张完美的卷子，但训练过的方法在压力下仍然成立。"
        : band === "稳定"
          ? "大部分已掌握的内容被完整写在答题卡上，波动没有吞掉整场考试。"
          : band === "波动"
            ? "一些会做的题没有落到分数上；第二章需要处理结果带来的新压力。"
            : "睡眠、压力与错误节奏同时显形。这是长期累积的结果，不是一次选错。";
    next.phase = "review";
    const result = next.results.find((candidate) => candidate.week === 4);
    if (result) {
      result.echoes = [next.exam.note, `一模记录：${band}。成绩改变后续压力，但不锁死关系。`];
      result.nextWeek = ["第一章即将收束。", "第17题页角的第三种笔迹等待被看见。"];
    }
    nextProgress.facts = [
      ...new Set([
        ...nextProgress.facts,
        "first-mock-complete",
        `first-mock-band:${band}`,
        `first-mock-methods:${next.exam.actionIds.join(",")}`
      ])
    ];
  }
  return { chapterOne: next, progress: nextProgress, stats: nextStats };
}

export function currentExamStage(state: ChapterOneState): ExamStage | null {
  return EXAM_STAGES[state.exam.step] ?? null;
}

export function thirdHandwritingReveal(progress: LongTermProgress): {
  route: string;
  description: string;
  handwriting: string;
} {
  const pageFact = progress.facts.find((fact) => fact.startsWith("page17-state:"));
  if (pageFact === "page17-state:torn") {
    return {
      route: "撕下的残片",
      description: "夹回来的残片上，字迹横跨撕裂边缘。它显然写在撕页之前。",
      handwriting: "周四那十分钟，是我借走的。第17题谢谢。别问她。"
    };
  }
  if (pageFact === "page17-state:returned") {
    return {
      route: "题解下的压痕",
      description: "周棠的题解下方浮出一层复写压痕，笔势既不属于她，也不属于你。",
      handwriting: "周四那十分钟，是我借走的。第17题谢谢。别问她。"
    };
  }
  return {
    route: "完整页的页角",
    description: "第17题页角多出一行陌生字，墨色比周棠的蓝笔更浅。",
    handwriting: "周四那十分钟，是我借走的。第17题谢谢。别问她。"
  };
}
