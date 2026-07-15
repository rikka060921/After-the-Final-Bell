import type { GameStats, LongTermProgress } from "../types";
import { busAction, BUS_STOPS, type BusActionId, type ChapterTwoState } from "./model";

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function playBusAction(
  state: ChapterTwoState,
  progress: LongTermProgress,
  stats: GameStats,
  actionId: BusActionId
): { chapterTwo: ChapterTwoState; progress: LongTermProgress; stats: GameStats } {
  if (state.phase !== "bus-route" || state.bus.resolved) throw new Error("The bus route is not active");
  const action = busAction(actionId);
  if (!action) throw new Error(`Unknown bus action: ${actionId}`);
  const next = structuredClone(state);
  const nextProgress: LongTermProgress = {
    ...progress,
    facts: [...progress.facts],
    tendencies: { ...progress.tendencies },
    academic: { ...progress.academic }
  };
  const nextStats = { ...stats };
  const bus = next.bus;
  if (actionId === "buy-breakfast") {
    if (bus.breakfast) throw new Error("You already bought breakfast");
    bus.breakfast = true;
    bus.minutes -= 2;
    bus.log.push("你在老市场买了一份早餐，纸袋上留下了热气。");
  } else if (actionId === "wait") {
    bus.stopIndex += 1;
    bus.minutes -= 2;
    bus.log.push("你没有换车，等下一班车在站牌下停稳。");
  } else if (actionId === "walk") {
    bus.stopIndex += 1;
    bus.minutes -= 2;
    bus.delay += 1;
    bus.log.push("你走到老市场再上车，避开了学校门口的滞留名单。");
  } else {
    bus.stopIndex += 2;
    bus.minutes -= 3;
    bus.delay += 2;
    bus.log.push("你换上快车直达河桥，车窗外的站牌连成一条线。");
  }
  bus.stopIndex = Math.min(BUS_STOPS.length - 1, bus.stopIndex);
  bus.minutes = Math.max(0, bus.minutes);
  if (bus.stopIndex >= BUS_STOPS.length - 1 || bus.minutes <= 0) {
    bus.resolved = true;
    const met = bus.breakfast && bus.delay <= 1 && next.zhouDistance <= 1;
    bus.outcome = met ? "met" : bus.delay > 1 ? "late" : "missed";
    bus.log.push(
      bus.outcome === "met"
        ? "你在南站看见周棠。她接过早餐，没有问你为什么选这条路线。"
        : bus.outcome === "late"
          ? "你赶到约定站点时只剩下一班车的尾灯，早餐还在手里。"
          : "你们错开了。她发来一句：下次先把自己的路线写清楚。"
    );
    next.phase = "complete";
    next.resolvedEventIds = [...new Set([...next.resolvedEventIds, `chapter2-bus:${bus.outcome}`])];
    nextProgress.facts = [
      ...new Set([
        ...nextProgress.facts,
        `chapter2-bus-outcome:${bus.outcome}`,
        bus.breakfast ? "chapter2-breakfast-bought" : "chapter2-breakfast-skipped"
      ])
    ];
    nextStats.stress = clamp(nextStats.stress + (bus.outcome === "met" ? -2 : 2));
  }
  return { chapterTwo: next, progress: nextProgress, stats: nextStats };
}
