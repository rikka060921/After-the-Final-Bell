import type {
  AsyncMessageId,
  BusActionId,
  ChapterTwoState,
  GameMode,
  ResultFramingId
} from "../types";
import {
  ASYNC_MESSAGES,
  BUS_ACTIONS,
  BUS_STOPS,
  RESULT_FRAMINGS
} from "./model";
import { busPrelude, messagePrelude, resultReaction, thirdChapterHook } from "./context";

const $ = <T extends Element = HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing chapter-two element: ${selector}`);
  return element;
};

function setText(selector: string, value: string): void {
  $(selector).textContent = value;
}

export interface ChapterTwoUICallbacks {
  onResultFraming(id: ResultFramingId): void;
  onMessage(id: AsyncMessageId): void;
  onBusAction(id: BusActionId): void;
  onReturnTitle(): void;
}

export interface ChapterTwoUI {
  renderResult(state: ChapterTwoState, mode: GameMode): void;
  renderMessage(state: ChapterTwoState): void;
  renderBus(state: ChapterTwoState): void;
  renderComplete(state: ChapterTwoState): void;
}

function describeScore(state: ChapterTwoState, mode: GameMode): string {
  if (mode === "county") {
    const label = state.effectiveScore >= 65 ? "明显上升" : state.effectiveScore >= 52 ? "基本稳定" : state.effectiveScore >= 40 ? "有波动" : "需要重新安排";
    return `成绩段：${label}（方法与稳定共同生成）`;
  }
  return `成绩段：${state.resultBand} · 有效表现 ${state.effectiveScore.toFixed(1)} / 100`;
}

export function createChapterTwoUI(callbacks: ChapterTwoUICallbacks): ChapterTwoUI {
  $("#chapter-two-title-btn").addEventListener("click", callbacks.onReturnTitle);

  function renderResult(state: ChapterTwoState, mode: GameMode): void {
    setText("#chapter-two-score-summary", describeScore(state, mode));
    setText(
      "#chapter-two-family-pressure",
      `家里的介入压力：${mode === "story" ? Math.round(state.familyPressure) : state.familyPressure >= 60 ? "偏高" : state.familyPressure >= 35 ? "中等" : "偏低"}`
    );
    setText("#chapter-two-family-reaction", resultReaction(state));
    const actions = $("#chapter-two-result-actions");
    actions.replaceChildren();
    RESULT_FRAMINGS.forEach((framing) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "exam-action-btn";
      const title = document.createElement("strong");
      title.textContent = framing.label;
      const description = document.createElement("small");
      description.textContent = framing.description;
      button.append(title, description);
      button.addEventListener("click", () => callbacks.onResultFraming(framing.id));
      actions.append(button);
    });
    setText("#chapter-two-result-status", "请选择如何向家人解释这份成绩单。");
  }

  function renderMessage(_state: ChapterTwoState): void {
    setText("#chapter-two-message-prelude", messagePrelude(_state));
    setText("#message-budget-count", "最多 18 字");
    const actions = $("#chapter-two-message-actions");
    actions.replaceChildren();
    ASYNC_MESSAGES.forEach((message) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "exam-action-btn";
      const title = document.createElement("strong");
      title.textContent = `${message.label} · ${message.wordCount} 字`;
      const description = document.createElement("small");
      description.textContent = `${message.text} ${message.description}`;
      button.append(title, description);
      button.addEventListener("click", () => callbacks.onMessage(message.id));
      actions.append(button);
    });
    setText("#chapter-two-message-status", "留言限制为十八字以内。");
  }

  function renderBus(state: ChapterTwoState): void {
    setText("#chapter-two-bus-prelude", busPrelude(state));
    const stops = $("#bus-stop-list");
    stops.replaceChildren();
    BUS_STOPS.forEach((stop, index) => {
      const item = document.createElement("li");
      item.textContent = stop;
      const current = index === state.bus.stopIndex;
      item.dataset.current = String(current);
      if (current) item.setAttribute("aria-current", "step");
      stops.append(item);
    });
    setText("#bus-time-state", `剩余 ${state.bus.minutes} 分钟 · ${BUS_STOPS[state.bus.stopIndex]}`);
    setText("#bus-distance-state", `周棠距离：${state.zhouDistance <= 1 ? "愿意靠近" : state.zhouDistance <= 3 ? "仍在犹豫" : "需要空间"}`);
    const actions = $("#chapter-two-bus-actions");
    actions.replaceChildren();
    BUS_ACTIONS.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "exam-action-btn";
      const title = document.createElement("strong");
      title.textContent = action.label;
      const description = document.createElement("small");
      description.textContent = action.description;
      button.append(title, description);
      button.addEventListener("click", () => callbacks.onBusAction(action.id));
      actions.append(button);
    });
    const log = $("#chapter-two-bus-log");
    log.replaceChildren(...state.bus.log.map((line) => {
      const item = document.createElement("li");
      item.textContent = line;
      return item;
    }));
    setText("#chapter-two-bus-status", state.bus.log.at(-1) ?? "路线开始。");
  }

  function renderComplete(state: ChapterTwoState): void {
    const outcome = state.bus.outcome === "met"
      ? "你们在不同站点完成了十分钟错峰见面。"
      : state.bus.outcome === "late"
        ? "你们错过了约定时间，但路线和迟到原因都留下了。"
        : "你们这次没有遇见；错开不是关系的结论，而是一条需要重写的路线。";
    setText("#chapter-two-complete-summary", `${outcome} 成绩单解释为 ${state.framing === "full-context" ? "完整说明" : state.framing === "progress-first" ? "先说进步" : "先说压力"}，留言也已写入长期记录。`);
    setText("#chapter-two-complete-message", state.message?.text ?? "你没有留下异步留言。");
    setText("#chapter-two-complete-hook", thirdChapterHook(state));
  }

  return { renderResult, renderMessage, renderBus, renderComplete };
}
