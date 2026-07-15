import { DEMO_URL, GAME_VERSION } from "./config";
import type { ChapterTwoState, ResultFramingId } from "./types";

export interface DemoRecapItem {
  label: string;
  value: string;
}

const framingLabels: Record<ResultFramingId, string> = {
  "full-context": "把分数与原因完整说清",
  "progress-first": "先说已经变好的部分",
  "pressure-first": "先让家人看见疲惫"
};

const routeLabels: Record<ChapterTwoState["bus"]["outcome"], string> = {
  pending: "路线仍未结束",
  met: "在不同站点完成十分钟见面",
  late: "迟到，但留下了可解释的路线",
  missed: "这次错过，决定以后重新协商"
};

export function demoRecap(state: ChapterTwoState): DemoRecapItem[] {
  return [
    { label: "一模", value: `${state.resultBand} · 方法与稳定共同生成` },
    { label: "成绩单", value: state.framing ? framingLabels[state.framing] : "尚未说明" },
    { label: "留言", value: state.message?.text ?? "没有留下留言" },
    { label: "错峰公交", value: routeLabels[state.bus.outcome] }
  ];
}

export function demoShareText(state: ChapterTwoState, playerName: string): string {
  const name = playerName.trim() || "陈舟";
  const recap = demoRecap(state);
  return [
    `《晚自习之后》公开试玩版 v${GAME_VERSION}`,
    `${name}完成了序章—第二章试玩。`,
    ...recap.map((item) => `${item.label}：${item.value}`),
    "第17题，下一次见。",
    DEMO_URL
  ].join("\n");
}
