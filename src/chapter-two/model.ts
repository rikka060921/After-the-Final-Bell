import type {
  ChapterTwoState,
  AsyncMessageId,
  BusActionId,
  GameStats,
  LongTermProgress,
  MockExamState,
  ResultFramingId,
  StatEffects
} from "../types";
export type { AsyncMessageId, BusActionId, ChapterTwoState, ResultFramingId } from "../types";

export interface ChapterTwoProgressResult {
  facts: string[];
  tendencies: Partial<LongTermProgress["tendencies"]>;
  stats: StatEffects;
}

export const RESULT_FRAMINGS: readonly {
  id: ResultFramingId;
  label: string;
  description: string;
  effects: ChapterTwoProgressResult;
}[] = [
  {
    id: "full-context",
    label: "把分数和原因一起说清",
    description: "不只报一个数字，也承认睡眠、稳定和方法分别发生了什么。",
    effects: {
      facts: ["chapter2-result:full-context"],
      tendencies: { responsibility: 1, explanation: 1 },
      stats: { agency: 2, stress: 2 }
    }
  },
  {
    id: "progress-first",
    label: "先说已经变好的部分",
    description: "先让家人看到掌握与稳定的变化，再解释还没有解决的地方。",
    effects: {
      facts: ["chapter2-result:progress-first"],
      tendencies: { explanation: 1 },
      stats: { stress: -2, agency: 1 }
    }
  },
  {
    id: "pressure-first",
    label: "先说最近有多累",
    description: "把压力放在第一句；家人会更快介入，也可能更快替你做决定。",
    effects: {
      facts: ["chapter2-result:pressure-first"],
      tendencies: { avoidance: 1 },
      stats: { stress: -3, agency: -2, bond: 1 }
    }
  }
] as const;

export const ASYNC_MESSAGES: readonly {
  id: AsyncMessageId;
  label: string;
  text: string;
  wordCount: number;
  description: string;
  effects: ChapterTwoProgressResult;
}[] = [
  {
    id: "ask-plan",
    label: "问她删掉的大学计划",
    text: "你刚才删掉的那行大学计划，如果愿意，可以只告诉我你还在考虑什么。",
    wordCount: 17,
    description: "询问与自己有关的边界，不要求她立刻交出答案。",
    effects: {
      facts: ["chapter2-message:ask-plan"],
      tendencies: { listening: 1, explanation: 1 },
      stats: { bond: 2, risk: 1, agency: 1 }
    }
  },
  {
    id: "leave-space",
    label: "告诉她可以先不回答",
    text: "大学的事你可以先不回答。我把自己的计划写好，再把能说的部分留给你。",
    wordCount: 16,
    description: "先留下空间，再说明自己不会把等待变成催促。",
    effects: {
      facts: ["chapter2-message:leave-space"],
      tendencies: { listening: 2 },
      stats: { bond: 1, mutual: 2, stress: -1 }
    }
  },
  {
    id: "promise-solve",
    label: "承诺会替她解决",
    text: "如果是学费或城市的问题，我会想办法解决，你不用一个人扛。",
    wordCount: 15,
    description: "听起来很坚定，却可能把她的家庭和未来重新交给你安排。",
    effects: {
      facts: ["chapter2-message:promise-solve"],
      tendencies: { control: 2 },
      stats: { bond: 3, agency: -3, risk: 2, mutual: -2 }
    }
  }
] as const;

export const BUS_STOPS = ["学校东门", "老市场", "河桥", "南站"] as const;

export interface BusActionDefinition {
  id: BusActionId;
  label: string;
  description: string;
}

export const BUS_ACTIONS: readonly BusActionDefinition[] = [
  { id: "buy-breakfast", label: "买一份早餐再走", description: "多花两分钟，但给错峰见面留下一件具体的东西。" },
  { id: "wait", label: "等下一班车", description: "不冒险换路线；时间会变少，但更容易在约定站点相遇。" },
  { id: "walk", label: "走到老市场再上车", description: "绕开滞留名单视线，消耗时间换取更低的暴露。" },
  { id: "express", label: "换乘快车直达河桥", description: "更快，却可能错过她从另一站上车的时间。" }
] as const;

export function resultFraming(id: ResultFramingId) {
  return RESULT_FRAMINGS.find((choice) => choice.id === id) ?? null;
}

export function asyncMessage(id: AsyncMessageId) {
  return ASYNC_MESSAGES.find((choice) => choice.id === id) ?? null;
}

export function busAction(id: BusActionId) {
  return BUS_ACTIONS.find((choice) => choice.id === id) ?? null;
}

export function initialFamilyPressure(stats: GameStats, resultBand: NonNullable<MockExamState["band"]>): number {
  const bandPressure = resultBand === "失常" ? 8 : resultBand === "波动" ? 5 : resultBand === "稳定" ? 3 : 1;
  return Math.max(0, Math.min(100, bandPressure + Math.round(stats.stress * 0.25)));
}
