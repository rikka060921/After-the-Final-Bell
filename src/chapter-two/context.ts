import type { ChapterTwoState } from "../types";

export function resultReaction(state: ChapterTwoState): string {
  if (state.resultBand === "失常") {
    return state.familyPressure >= 55
      ? "成绩单还没放到餐桌上，母亲已经问你是不是把所有时间都用来陪别人。"
      : "家里先看见了分数的下滑，随后才注意到你把错题方法写在了边角。";
  }
  if (state.resultBand === "波动") {
    return state.familyPressure >= 55
      ? "父亲把‘波动’听成了‘还可以再逼一点’，你需要决定先解释哪一部分。"
      : "这不是一张漂亮的成绩单，但每一科的原因都可以被拆开说明。";
  }
  if (state.resultBand === "稳定") {
    return "成绩没有突然跃升，稳定本身却给你留下了一点可以谈寒假安排的空间。";
  }
  return "分数明显向上，但家里立刻开始讨论更远的城市和更贵的选择。";
}

export function messagePrelude(state: ChapterTwoState): string {
  if (state.framing === "pressure-first") {
    return "你先把疲惫写给家里，轮到周棠时，字数只够留下一个不完整的问题。";
  }
  if (state.framing === "full-context") {
    return "你已经练习过把原因说完整；现在面对周棠，完整不等于要求她交出全部。";
  }
  return "你先说了变好的部分，删掉的那行大学计划仍在输入框外面等着。";
}

export function busPrelude(state: ChapterTwoState): string {
  if (state.message?.id === "promise-solve") {
    return "那句‘我会解决’让周棠把距离拉远了一点；路线需要更精确，才能不变成追赶。";
  }
  if (state.message?.id === "leave-space") {
    return "你给她留下了可以不回答的空间，错峰路线第一次像协商，而不是考验。";
  }
  return "你问了一个与自己有关的问题，接下来只能用实际路线证明你不会替她决定。";
}
