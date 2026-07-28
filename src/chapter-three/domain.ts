import { applyStatEffects, clamp } from "../state";
import type {
  ChapterThreeState,
  ChapterTwoState,
  GameStats,
  InvestigationLeadId,
  LongTermProgress,
  PrivacyChoiceId,
  TestimonyId
} from "../types";
import { investigationLead, privacyChoice, testimony } from "./model";

export interface ChapterThreeResult {
  chapterThree: ChapterThreeState;
  progress: LongTermProgress;
  stats: GameStats;
}

function cloneProgress(progress: LongTermProgress): LongTermProgress {
  return {
    facts: [...progress.facts],
    tendencies: { ...progress.tendencies },
    academic: { ...progress.academic }
  };
}

export function initializeChapterThree(
  chapterTwo: ChapterTwoState,
  progress: LongTermProgress
): ChapterThreeState {
  if (chapterTwo.phase !== "complete" || !progress.facts.includes("chapter-two-complete")) {
    throw new Error("第三章需要先完成第二章。");
  }
  const distance = chapterTwo.zhouDistance + (chapterTwo.message?.id === "promise-solve" ? 1 : 0);
  return {
    schemaVersion: 1,
    phase: "lead-board",
    pointsLeft: 3,
    leadIds: [],
    testimonyOrder: ["copy-edge"],
    evidenceQuality: "pending",
    privacyChoice: null,
    zhouDistance: clamp(distance, 0, 9),
    privacyExposure: 0,
    outcome: "pending",
    log: ["返校第一天，第17题原页消失。办公室桌面只剩一张裁掉页角的复印件。"],
    resolvedEventIds: []
  };
}

export function investigateLead(
  state: ChapterThreeState,
  progress: LongTermProgress,
  stats: GameStats,
  leadId: InvestigationLeadId
): ChapterThreeResult {
  if (state.phase !== "lead-board" || state.pointsLeft <= 0) throw new Error("调查阶段已经结束。");
  if (state.leadIds.includes(leadId)) throw new Error("这条信息源已经核对过。");
  const lead = investigationLead(leadId);
  if (!lead) throw new Error("未知的信息源。");
  const next = structuredClone(state);
  next.pointsLeft -= 1;
  next.leadIds.push(leadId);
  next.testimonyOrder.push(lead.testimonyId);
  next.log.push(`${lead.actor}：${lead.result}`);
  next.resolvedEventIds.push(`chapter3-lead:${leadId}`);
  if (next.pointsLeft === 0) next.phase = "testimony-board";

  const nextProgress = cloneProgress(progress);
  nextProgress.facts = [...new Set([...nextProgress.facts, `chapter3-lead:${leadId}`])];
  if (leadId === "zhou-boundary") nextProgress.tendencies.listening = clamp(nextProgress.tendencies.listening + 1);
  if (leadId === "liang-version") nextProgress.tendencies.control = clamp(nextProgress.tendencies.control + 1);
  const nextStats = applyStatEffects(stats, lead.statEffects, { deriveRebellion: false }).stats;
  return { chapterThree: next, progress: nextProgress, stats: nextStats };
}

export function moveTestimony(
  state: ChapterThreeState,
  testimonyId: TestimonyId,
  direction: "up" | "down"
): ChapterThreeState {
  if (state.phase !== "testimony-board") throw new Error("当前不能调整证词顺序。");
  const index = state.testimonyOrder.indexOf(testimonyId);
  if (index < 0) throw new Error("这张证词不在信息板上。");
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= state.testimonyOrder.length) return structuredClone(state);
  const next = structuredClone(state);
  [next.testimonyOrder[index], next.testimonyOrder[target]] = [
    next.testimonyOrder[target]!,
    next.testimonyOrder[index]!
  ];
  return next;
}

function orderErrors(order: TestimonyId[]): number {
  let errors = 0;
  for (let left = 0; left < order.length; left += 1) {
    for (let right = left + 1; right < order.length; right += 1) {
      if ((testimony(order[left]!)?.reliability ?? 0) < (testimony(order[right]!)?.reliability ?? 0)) errors += 1;
    }
  }
  return errors;
}

export function submitTestimonyOrder(state: ChapterThreeState): ChapterThreeState {
  if (state.phase !== "testimony-board") throw new Error("证词板还不能提交。");
  const errors = orderErrors(state.testimonyOrder);
  const quality = errors <= 1 ? "clear" : errors <= 3 ? "mixed" : "confused";
  const next = structuredClone(state);
  next.phase = "privacy-choice";
  next.evidenceQuality = quality;
  next.log.push(
    quality === "clear"
      ? "你把实物、记录、当事人承认和转述分开，时间线留下了必要的空白。"
      : quality === "mixed"
        ? "大部分来源已经分开，仍有一段转述被放得过重。"
        : "完整故事排在可核对记录之前，信息板看似清楚，来源却仍然混在一起。"
  );
  next.resolvedEventIds.push(`chapter3-order:${quality}`);
  return next;
}

export function resolvePrivacyChoice(
  state: ChapterThreeState,
  progress: LongTermProgress,
  stats: GameStats,
  choiceId: PrivacyChoiceId
): ChapterThreeResult {
  if (state.phase !== "privacy-choice" || state.privacyChoice) throw new Error("隐私决策已经结束。");
  const choice = privacyChoice(choiceId);
  if (!choice) throw new Error("未知的处理方式。");
  const next = structuredClone(state);
  next.phase = "complete";
  next.privacyChoice = choiceId;
  next.privacyExposure = choice.exposure;
  next.resolvedEventIds.push(`chapter3-privacy:${choiceId}`);

  let effects = {};
  let tendency: keyof LongTermProgress["tendencies"] = "responsibility";
  if (choiceId === "teacher-with-parties") {
    next.outcome = "procedural";
    next.zhouDistance = clamp(next.zhouDistance - (state.evidenceQuality === "clear" ? 2 : 1), 0, 9);
    effects = { agency: 2, mutual: 2, stress: 1 };
    tendency = "explanation";
    next.log.push("你只提交可核对时间线，并要求宋嘉禾、周棠和郭祺有权在场补充或拒绝。办公室没有得到一份替别人写完的故事。");
  } else if (choiceId === "stop-investigation") {
    next.outcome = "protected";
    next.zhouDistance = clamp(next.zhouDistance - 1, 0, 9);
    effects = { agency: 1, mutual: 2, stress: -2 };
    tendency = "listening";
    next.log.push("你停止追问离校原因，只把复印风险告诉当事人。恋爱传言没有立刻消失，宋嘉禾的计划也没有成为证据。");
  } else if (choiceId === "expose-plan") {
    next.outcome = "exposed";
    next.zhouDistance = clamp(next.zhouDistance + 3, 0, 9);
    effects = { risk: 4, bond: -3, agency: -2, stress: 2 };
    tendency = "control";
    next.log.push("传言很快停止，因为所有人开始谈宋嘉禾为什么准备离校。你证明了纸页不只属于你们，也把她变成了全班的答案。");
  } else {
    next.outcome = "absorbed";
    next.zhouDistance = clamp(next.zhouDistance + 2, 0, 9);
    effects = { bond: 1, agency: -3, stress: 3, rebellion: 2 };
    tendency = "avoidance";
    next.log.push("你说所有纸页都是自己写的。没有人需要当场解释，事实也从此只能围着你的谎言继续生长。");
  }

  const nextProgress = cloneProgress(progress);
  nextProgress.facts = [...new Set([
    ...nextProgress.facts,
    "chapter-three-complete",
    "chapter-four-hook:hundred-day-list",
    `chapter3-order:${state.evidenceQuality}`,
    `chapter3-outcome:${next.outcome}`
  ])];
  nextProgress.tendencies[tendency] = clamp(nextProgress.tendencies[tendency] + 2);
  const nextStats = applyStatEffects(stats, effects, { deriveRebellion: true }).stats;
  return { chapterThree: next, progress: nextProgress, stats: nextStats };
}
