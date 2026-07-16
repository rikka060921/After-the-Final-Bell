import { applyStatEffects, clamp } from "../state";
import type {
  ChapterOneActivityId,
  ChapterOneState,
  GameStats,
  LongTermProgress,
  StatEffects,
  WeekChallengeActionId,
  WeekChallengeState
} from "../types";

export interface WeekChallengeCopy {
  label: string;
  title: string;
  scene: string;
  escalation: string;
}

export interface WeekChallengeAction {
  id: WeekChallengeActionId;
  label: string;
  description: string;
  hint: string;
  available: number;
}

interface ChallengeActionDefinition extends Omit<WeekChallengeAction, "available"> {
  trackEffects: Partial<WeekChallengeState["tracks"]>;
  statEffects?: StatEffects;
  tendencies?: Partial<LongTermProgress["tendencies"]>;
  fact: string;
}

const CHALLENGE_COPY: Record<ChapterOneState["currentWeek"], WeekChallengeCopy> = {
  1: {
    label: "突发 · 滞留名单",
    title: "郭祺提前收起了名单",
    scene: "张苇临时要收订正本，郭祺同时从最后一排开始核对滞留名单。纸页、周测和座位路线挤进了同一个课间。",
    escalation: "郭祺又记下一排座位，被注意上升。"
  },
  2: {
    label: "突发 · 追加卷子",
    title: "两张新卷压在互批上面",
    scene: "晚自习前，张苇追加两张卷子。原本的互批、固定见面和睡眠都没有自动消失。",
    escalation: "下课铃继续向前，关系负荷上升。"
  },
  3: {
    label: "突发 · 传言成形",
    title: "第17题开始有了别人的版本",
    scene: "有人把空走廊、第三种笔迹和一次缺席连成了故事。你不知道谁先说，也不能同时澄清所有版本。",
    escalation: "又一个版本传到前排，被注意上升。"
  },
  4: {
    label: "突发 · 提前进场",
    title: "考试铃比计划早了十分钟",
    scene: "监考临时要求提前进场。最后一次复盘、早餐和与周棠说话的时间被同时压缩。",
    escalation: "剩余时间继续减少，任务积压上升。"
  }
};

const ACTIONS: readonly ChallengeActionDefinition[] = [
  {
    id: "method",
    label: "调用方法",
    description: "把任务拆成已经练过的步骤，优先消化积压。",
    hint: "积压大幅下降，关系负荷略升",
    trackEffects: { backlog: -3, strain: 1 },
    tendencies: { responsibility: 1 },
    fact: "challenge-used-method"
  },
  {
    id: "recover",
    label: "抢回恢复",
    description: "停一轮，把呼吸和注意力拉回身体。",
    hint: "关系负荷大幅下降，积压略升",
    trackEffects: { backlog: 1, strain: -3 },
    statEffects: { energy: 2, stress: -1 },
    fact: "challenge-used-recovery"
  },
  {
    id: "network",
    label: "借用关系网",
    description: "请已经建立联系的同学提供路线或来源。",
    hint: "被注意大幅下降，积压略升",
    trackEffects: { backlog: 1, attention: -3 },
    tendencies: { explanation: 1 },
    fact: "challenge-used-network"
  },
  {
    id: "coordinate",
    label: "现场协商",
    description: "把能做、不能做和需要改约的部分说清。",
    hint: "三个压力轨道同时下降",
    trackEffects: { backlog: -1, attention: -1, strain: -1 },
    statEffects: { mutual: 1 },
    tendencies: { listening: 1, explanation: 1 },
    fact: "challenge-used-coordination"
  },
  {
    id: "set-boundary",
    label: "划出边界",
    description: "明确放弃一件事，不再用无限加码解决冲突。",
    hint: "关系负荷下降，但更容易被旁人注意",
    trackEffects: { attention: 1, strain: -3 },
    statEffects: { agency: 2 },
    fact: "challenge-set-boundary"
  },
  {
    id: "push-through",
    label: "先硬顶过去",
    description: "不调用准备，直接用精力压住眼前任务。",
    hint: "积压下降，关系负荷明显上升",
    trackEffects: { backlog: -2, strain: 2 },
    statEffects: { energy: -2, stress: 1 },
    tendencies: { avoidance: 1 },
    fact: "challenge-pushed-through"
  }
] as const;

function planCounts(state: ChapterOneState): Map<ChapterOneActivityId, number> {
  const plan = state.plans.find((candidate) => candidate.week === state.currentWeek);
  if (!plan) throw new Error(`Missing plan for week ${state.currentWeek}`);
  const counts = new Map<ChapterOneActivityId, number>();
  Object.values(plan.assignments).forEach((assignment) => {
    counts.set(assignment.activityId, (counts.get(assignment.activityId) ?? 0) + 1);
  });
  return counts;
}

function total(counts: Map<ChapterOneActivityId, number>, ids: ChapterOneActivityId[]): number {
  return ids.reduce((sum, id) => sum + (counts.get(id) ?? 0), 0);
}

function limitedCharges(value: number): number {
  return Math.max(0, Math.min(2, value));
}

export function createWeekChallenge(
  state: ChapterOneState,
  progress: LongTermProgress,
  stats: GameStats
): WeekChallengeState {
  const counts = planCounts(state);
  const study = total(counts, ["math-mastery", "math-speed", "english-review", "mutual-review", "promise-async"]);
  const recovery = total(counts, ["rest", "own-goal"]);
  const network = total(counts, ["help-liang", "observe-seat", "investigate-absence"]);
  const coordination = total(counts, ["mutual-review", "notebook-message", "walk", "promise-review", "promise-async"]);
  const weekPressure = {
    backlog: state.currentWeek === 4 ? 2 : state.currentWeek === 2 ? 1 : 0,
    attention: state.currentWeek === 1 ? 2 : state.currentWeek === 3 ? 1 : 0,
    strain: state.currentWeek === 2 ? 2 : state.currentWeek === 3 || state.currentWeek === 4 ? 1 : 0
  };
  return {
    week: state.currentWeek,
    turn: 0,
    maxTurns: 3,
    tracks: {
      backlog: clamp(Math.round(5 + weekPressure.backlog + progress.academic.falseMastery / 2 - Math.min(3, study)), 1, 8),
      attention: clamp(Math.round(3 + weekPressure.attention + stats.risk / 20 + state.relationships.guoSuspicion / 3 - Math.min(2, network)), 1, 8),
      strain: clamp(Math.round(3 + weekPressure.strain + stats.stress / 25 + state.relationships.zhouPressure / 2 - Math.min(2, recovery)), 1, 8)
    },
    charges: {
      method: limitedCharges(study),
      recover: limitedCharges(recovery),
      network: limitedCharges(network),
      coordinate: limitedCharges(coordination),
      "set-boundary": 1,
      "push-through": 3
    },
    log: [],
    resolved: false,
    outcome: "pending"
  };
}

export function challengeCopy(state: ChapterOneState): WeekChallengeCopy {
  return CHALLENGE_COPY[state.currentWeek];
}

export function challengeActions(state: ChapterOneState): WeekChallengeAction[] {
  const challenge = state.weekChallenge;
  if (!challenge) return [];
  return ACTIONS.map((action) => ({
    id: action.id,
    label: action.label,
    description: action.description,
    hint: action.hint,
    available: challenge.charges[action.id]
  }));
}

function trackLabel(id: keyof WeekChallengeState["tracks"]): string {
  if (id === "backlog") return "任务积压";
  if (id === "attention") return "被注意";
  return "关系负荷";
}

function applyTracks(
  tracks: WeekChallengeState["tracks"],
  effects: Partial<WeekChallengeState["tracks"]>
): WeekChallengeState["tracks"] {
  const next = { ...tracks };
  (Object.keys(effects) as Array<keyof WeekChallengeState["tracks"]>).forEach((key) => {
    next[key] = clamp(next[key] + (effects[key] ?? 0), 0, 9);
  });
  return next;
}

function escalationTrack(week: ChapterOneState["currentWeek"]): keyof WeekChallengeState["tracks"] {
  if (week === 1 || week === 3) return "attention";
  if (week === 2) return "strain";
  return "backlog";
}

function resolveOutcome(tracks: WeekChallengeState["tracks"]): WeekChallengeState["outcome"] {
  const values = Object.values(tracks);
  const maximum = Math.max(...values);
  const sum = values.reduce((totalValue, value) => totalValue + value, 0);
  if (maximum <= 4 && sum <= 10) return "controlled";
  if (maximum <= 6 && sum <= 15) return "frayed";
  return "overloaded";
}

export function weekChallengeOutcomeText(outcome: WeekChallengeState["outcome"]): string {
  if (outcome === "pending") return "";
  if (outcome === "controlled") return "你没有清空所有问题，但三个压力都保持在还能解释和修复的范围内。";
  if (outcome === "frayed") return "这一周勉强接住了，仍有一条压力线会进入后续事件。";
  return "至少一条压力线越过了承受范围。接下来的互动会带着这次失控。";
}

function outcomeEffects(outcome: WeekChallengeState["outcome"]): StatEffects {
  if (outcome === "controlled") return { agency: 2, mutual: 1, stress: -1 };
  if (outcome === "frayed") return { stress: 1 };
  return { energy: -3, stress: 3, rebellion: 2 };
}

export interface PlayWeekChallengeResult {
  chapterOne: ChapterOneState;
  progress: LongTermProgress;
  stats: GameStats;
}

export function playWeekChallengeAction(
  state: ChapterOneState,
  progress: LongTermProgress,
  stats: GameStats,
  actionId: WeekChallengeActionId
): PlayWeekChallengeResult {
  const challenge = state.weekChallenge;
  if (state.phase !== "week-challenge" || !challenge || challenge.resolved) {
    throw new Error("当前没有可执行的周挑战。");
  }
  const definition = ACTIONS.find((action) => action.id === actionId);
  if (!definition || challenge.charges[actionId] <= 0) throw new Error("这项行动没有剩余次数。");

  let tracks = applyTracks(challenge.tracks, definition.trackEffects);
  const turn = challenge.turn + 1;
  const log = [
    ...challenge.log,
    `${definition.label}：${Object.entries(definition.trackEffects).map(([key, value]) => `${trackLabel(key as keyof WeekChallengeState["tracks"])}${(value ?? 0) > 0 ? "+" : ""}${value}`).join("，")}`
  ];
  if (turn < challenge.maxTurns) {
    const escalating = escalationTrack(state.currentWeek);
    tracks = applyTracks(tracks, { [escalating]: 1 });
    log.push(CHALLENGE_COPY[state.currentWeek].escalation);
  }
  const resolved = turn >= challenge.maxTurns;
  const outcome = resolved ? resolveOutcome(tracks) : "pending";
  if (resolved) log.push(weekChallengeOutcomeText(outcome));

  const nextChallenge: WeekChallengeState = {
    ...challenge,
    turn,
    tracks,
    charges: { ...challenge.charges, [actionId]: challenge.charges[actionId] - 1 },
    log,
    resolved,
    outcome
  };
  const nextResults = state.results.map((result) =>
    result.week === state.currentWeek && resolved
      ? { ...result, changes: [...result.changes, weekChallengeOutcomeText(outcome)] }
      : { ...result, completed: [...result.completed], changes: [...result.changes], echoes: [...result.echoes], nextWeek: [...result.nextWeek] }
  );
  const nextProgress: LongTermProgress = {
    facts: [...new Set([
      ...progress.facts,
      definition.fact,
      ...(resolved ? [`week-challenge:${state.currentWeek}:${outcome}`] : [])
    ])],
    academic: {
      ...progress.academic,
      sleepDebt: clamp(progress.academic.sleepDebt + (resolved && outcome === "overloaded" ? 1 : 0))
    },
    tendencies: { ...progress.tendencies }
  };
  if (definition.tendencies) {
    (Object.keys(definition.tendencies) as Array<keyof LongTermProgress["tendencies"]>).forEach((key) => {
      nextProgress.tendencies[key] = clamp(nextProgress.tendencies[key] + (definition.tendencies?.[key] ?? 0));
    });
  }
  let nextStats = applyStatEffects(stats, definition.statEffects ?? {}, { deriveRebellion: false }).stats;
  if (resolved) nextStats = applyStatEffects(nextStats, outcomeEffects(outcome), { deriveRebellion: true }).stats;
  return {
    chapterOne: {
      ...state,
      results: nextResults,
      resolvedEventIds: [...new Set([...state.resolvedEventIds, `week${state.currentWeek}-challenge-${actionId}`])],
      weekChallenge: nextChallenge
    },
    progress: nextProgress,
    stats: nextStats
  };
}

function nextPhase(week: ChapterOneState["currentWeek"]): ChapterOneState["phase"] {
  if (week === 1) return "seat-game";
  if (week === 3) return "sentence-game";
  if (week === 4) return "exam";
  return "review";
}

export function continueAfterWeekChallenge(state: ChapterOneState): ChapterOneState {
  if (state.phase !== "week-challenge" || !state.weekChallenge?.resolved) {
    throw new Error("周挑战还没有完成。");
  }
  return { ...state, phase: nextPhase(state.currentWeek) };
}

export function isWeekChallengeActionId(value: string): value is WeekChallengeActionId {
  return ACTIONS.some((action) => action.id === value);
}
