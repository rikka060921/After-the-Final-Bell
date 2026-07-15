import type {
  ChapterOneState,
  LongTermProgress,
  SentenceAssemblyRecord
} from "../types";
import { cloneChapterOneState } from "./schedule";

export type SentencePosition = "open" | "middle" | "close";

export interface SentenceFragment {
  id: string;
  position: SentencePosition;
  text: string;
  actionType: "listen" | "explain" | "responsibility" | "agency" | "control" | "avoid";
  hint: string;
  requires?: (progress: LongTermProgress) => boolean;
  incompatibleWith?: string[];
}

export const SENTENCE_FRAGMENTS: readonly SentenceFragment[] = [
  {
    id: "open-ask",
    position: "open",
    text: "我想知道你为什么没来，",
    actionType: "explain",
    hint: "直接说明问题，不预判答案"
  },
  {
    id: "open-feeling",
    position: "open",
    text: "我在走廊等了十分钟，",
    actionType: "responsibility",
    hint: "承认自己的感受"
  },
  {
    id: "open-privacy",
    position: "open",
    text: "你不必告诉我别人的名字，",
    actionType: "listen",
    hint: "先承认她替别人保密的边界",
    requires: (progress) =>
      progress.tendencies.listening >= 2 || progress.facts.includes("mutual-help:two-way"),
    incompatibleWith: ["middle-order"]
  },
  {
    id: "middle-boundary",
    position: "middle",
    text: "但请告诉我这件事和我们的约定有没有关系；",
    actionType: "agency",
    hint: "请求与自己有关的边界信息"
  },
  {
    id: "middle-wait",
    position: "middle",
    text: "我可以等你准备好再解释；",
    actionType: "listen",
    hint: "给解释留下时间"
  },
  {
    id: "middle-guess",
    position: "middle",
    text: "可别让我再靠猜来替你做决定；",
    actionType: "responsibility",
    hint: "指出猜测与包办的问题",
    requires: (progress) => progress.tendencies.responsibility >= 1 || progress.tendencies.control >= 1
  },
  {
    id: "middle-order",
    position: "middle",
    text: "你下次必须先来见我；",
    actionType: "control",
    hint: "把自己的不安写成对她的命令",
    incompatibleWith: ["open-privacy", "close-wait"]
  },
  {
    id: "close-note",
    position: "close",
    text: "下次需要改约，就给我留一个只说明边界的字条。",
    actionType: "agency",
    hint: "提出可以执行的修复方式"
  },
  {
    id: "close-wait",
    position: "close",
    text: "我会先把题解看完，再等你愿意说的部分。",
    actionType: "listen",
    hint: "接受自己无权知道全部",
    requires: (progress) => progress.tendencies.listening >= 1 || progress.facts.includes("complete-solution-left"),
    incompatibleWith: ["middle-order"]
  },
  {
    id: "close-alone",
    position: "close",
    text: "至少别再让我一个人守着约定。",
    actionType: "responsibility",
    hint: "表达受伤，但没有要求交出他人隐私"
  },
  {
    id: "close-dismiss",
    position: "close",
    text: "没事，就当今晚从来没有约过。",
    actionType: "avoid",
    hint: "把冲突抹掉，也把修复机会一起抹掉"
  }
] as const;

export function availableSentenceFragments(
  progress: LongTermProgress,
  position: SentencePosition
): SentenceFragment[] {
  return SENTENCE_FRAGMENTS.filter(
    (fragment) => fragment.position === position && (!fragment.requires || fragment.requires(progress))
  );
}

export function validateSentenceSelection(
  progress: LongTermProgress,
  fragmentIds: string[]
): { ok: boolean; reason: string; fragments: SentenceFragment[] } {
  const unique = [...new Set(fragmentIds.filter(Boolean))];
  const fragments = unique
    .map((id) => SENTENCE_FRAGMENTS.find((candidate) => candidate.id === id))
    .filter((fragment): fragment is SentenceFragment => Boolean(fragment));
  const open = fragments.filter((fragment) => fragment.position === "open");
  const middle = fragments.filter((fragment) => fragment.position === "middle");
  const close = fragments.filter((fragment) => fragment.position === "close");
  if (open.length !== 1 || close.length !== 1 || middle.length > 1) {
    return { ok: false, reason: "开口与落句各选一段；补充可以选一段，也可以留白。", fragments };
  }
  if (fragments.some((fragment) => fragment.requires && !fragment.requires(progress))) {
    return { ok: false, reason: "这段表达还没有在此前的行动里形成。", fragments };
  }
  const ids = new Set(fragments.map((fragment) => fragment.id));
  if (fragments.some((fragment) => fragment.incompatibleWith?.some((id) => ids.has(id)))) {
    return { ok: false, reason: "这些句段互相矛盾。换一种开口或落句。", fragments };
  }
  return { ok: true, reason: "这句话可以写下。", fragments };
}

export function assembleSentence(fragments: SentenceFragment[]): string {
  const order: Record<SentencePosition, number> = { open: 0, middle: 1, close: 2 };
  return [...fragments]
    .sort((left, right) => order[left.position] - order[right.position])
    .map((fragment) => fragment.text)
    .join("");
}

function communicationPattern(actionTypes: string[]): string {
  if (actionTypes.includes("control")) return "control";
  if (actionTypes.includes("avoid")) return "avoidance";
  if (actionTypes.includes("listen") && actionTypes.includes("agency")) return "listening-boundary";
  if (actionTypes.includes("responsibility")) return "responsible-expression";
  if (actionTypes.includes("listen")) return "listening";
  return "direct-explanation";
}

export function submitSentenceAssembly(
  state: ChapterOneState,
  progress: LongTermProgress,
  fragmentIds: string[],
  pageAction: SentenceAssemblyRecord["pageAction"]
): { chapterOne: ChapterOneState; progress: LongTermProgress } {
  if (state.phase !== "sentence-game") throw new Error("Sentence assembly is not active");
  const validation = validateSentenceSelection(progress, fragmentIds);
  if (!validation.ok) throw new Error(validation.reason);
  const actionTypes = validation.fragments.map((fragment) => fragment.actionType);
  const record: SentenceAssemblyRecord = {
    fragmentIds: validation.fragments.map((fragment) => fragment.id),
    text: assembleSentence(validation.fragments),
    actionTypes,
    pageAction
  };
  const next = cloneChapterOneState(state);
  next.sentence = record;
  next.phase = "review";
  const tendencies = { ...progress.tendencies };
  actionTypes.forEach((actionType) => {
    if (actionType === "listen") tendencies.listening += 1;
    if (actionType === "explain") tendencies.explanation += 1;
    if (actionType === "responsibility") tendencies.responsibility += 1;
    if (actionType === "avoid") tendencies.avoidance += 2;
    if (actionType === "control") tendencies.control += 2;
  });
  const pattern = communicationPattern(actionTypes);
  const facts = [
    ...progress.facts,
    `first-communication-pattern:${pattern}`,
    `page17-state:${pageAction}`,
    actionTypes.includes("listen") ? "privacy-boundary-respected" : "privacy-boundary-unresolved"
  ];
  return {
    chapterOne: next,
    progress: { ...progress, facts: [...new Set(facts)], tendencies }
  };
}

export function pageActionLabel(action: SentenceAssemblyRecord["pageAction"]): string {
  if (action === "torn") return "沿松动的装订线撕下这一页，只保留一块残片。";
  if (action === "returned") return "把这一页连同错题本交还周棠。";
  return "把这一页完整留在错题本里。";
}
