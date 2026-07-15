import type { ChapterOneState, LongTermProgress, SeatActionId } from "../types";
import { cloneChapterOneState } from "./schedule";

export interface SeatAction {
  id: SeatActionId;
  label: string;
  description: string;
}

const ACTIONS: Record<SeatActionId, SeatAction> = {
  wait: {
    id: "wait",
    label: "先等一轮",
    description: "看清张苇与郭祺的视线变化，不移动纸页。"
  },
  "pass-liang": {
    id: "pass-liang",
    label: "递给梁硕",
    description: "让同桌成为中转；若没有提前观察，动作会更显眼。"
  },
  "pass-zhou": {
    id: "pass-zhou",
    label: "沿后排递给周棠",
    description: "只有纸页已在梁硕手中时，这条路线才成立。"
  },
  hide: {
    id: "hide",
    label: "压在练习册下",
    description: "先藏好纸页，降低被注意的程度，但会消耗一轮。"
  },
  "take-back": {
    id: "take-back",
    label: "收回纸页",
    description: "放弃这次传递；关系不会因此锁死。"
  }
};

export function getSeatActions(state: ChapterOneState): SeatAction[] {
  if (state.seatGame.resolved) return [];
  const ids: SeatActionId[] = ["wait", "hide", "take-back"];
  if (state.seatGame.carrierSeatId === "r6c2") ids.splice(1, 0, "pass-liang");
  if (state.seatGame.carrierSeatId === "r5c3") ids.splice(1, 0, "pass-zhou");
  return ids.map((id) => ACTIONS[id]);
}

export function playSeatAction(state: ChapterOneState, actionId: SeatActionId): ChapterOneState {
  if (state.phase !== "seat-game" || state.seatGame.resolved) {
    throw new Error("Seat game is not active");
  }
  if (!getSeatActions(state).some((action) => action.id === actionId)) {
    throw new Error(`Seat action is not available: ${actionId}`);
  }
  const next = cloneChapterOneState(state);
  const game = next.seatGame;

  if (actionId === "wait") {
    game.attention = Math.max(0, game.attention - 1);
    game.log.push(game.turn === 0 ? "张苇转向黑板写下周测范围，中间过道暂时空了。" : "你等到翻卷子的声音盖住桌椅轻响。");
  } else if (actionId === "hide") {
    game.attention = Math.max(0, game.attention - 1);
    game.log.push("你把纸页压在练习册下。郭祺的目光从这一排移开。 ");
  } else if (actionId === "pass-liang") {
    game.carrierSeatId = "r5c3";
    const observed = next.relationships.seatIntel >= 2;
    game.attention += game.turn === 0 ? (observed ? 1 : 2) : observed ? 0 : 1;
    game.log.push(observed ? "你按先前记下的节奏把纸页递给梁硕。" : "梁硕接住了纸页，但郭祺像是听见了桌角的轻响。 ");
  } else if (actionId === "pass-zhou") {
    game.carrierSeatId = "r2c5";
    game.resolved = true;
    game.outcome = game.attention >= 2 ? "noticed" : "delivered";
    game.log.push(
      game.outcome === "delivered"
        ? "纸页沿后排到达周棠手中。她没有回头，只把页角折了一次。"
        : "纸页到了周棠手中；郭祺同时在滞留名单旁记下了你的位置。"
    );
  } else {
    game.carrierSeatId = "r6c2";
    game.resolved = true;
    game.outcome = "returned";
    game.log.push("你把纸页收回错题本。今天没有传过去，但这不是关系的终点。 ");
  }

  game.turn += 1;
  if (!game.resolved && game.turn >= 5) {
    game.resolved = true;
    game.outcome = "returned";
    game.carrierSeatId = "r6c2";
    game.log.push("上课铃响了。你把纸页留在本里，等待下一次能说明白的机会。 ");
  }
  return next;
}

export function archiveSeatGame(
  state: ChapterOneState,
  progress: LongTermProgress
): { chapterOne: ChapterOneState; progress: LongTermProgress } {
  if (state.phase !== "seat-game" || !state.seatGame.resolved) {
    throw new Error("Seat game has not been resolved");
  }
  const next = cloneChapterOneState(state);
  next.phase = "review";
  const facts = [...progress.facts, `seat-route:${next.seatGame.outcome}`];
  if (next.seatGame.outcome === "noticed") {
    next.relationships.guoSuspicion += 3;
    facts.push("guo-assessment:watchful");
  } else if (next.seatGame.outcome === "delivered") {
    facts.push("guo-assessment:uncertain", "page-transfer-complete");
  } else {
    facts.push("guo-assessment:ordinary", "page-transfer-withheld");
  }
  return {
    chapterOne: next,
    progress: { ...progress, facts: [...new Set(facts)] }
  };
}

export function seatOutcomeText(state: ChapterOneState): string {
  if (state.seatGame.outcome === "delivered") return "纸页送达，没有人能确认你传了什么。";
  if (state.seatGame.outcome === "noticed") return "纸页送达，但郭祺开始把你列为需要观察的人。";
  if (state.seatGame.outcome === "returned") return "你收回了纸页，保留了一次没有冒险的机会。";
  return "纸页仍在移动中。";
}
