import { countNotebookSlots } from "./notebook";
import type {
  EndingId,
  GameMode,
  GameStats,
  NotebookState,
  OpeningProfile,
  PromiseEntry
} from "./types";

export interface OpeningProfileInput {
  playerName: string;
  mode: GameMode;
  endingId: EndingId;
  stats: GameStats;
  notebook: NotebookState;
  promises: PromiseEntry[];
  decisionIds: string[];
  createdAt?: string;
}

export function createOpeningProfile(input: OpeningProfileInput): OpeningProfile {
  const counts = countNotebookSlots(input.notebook);
  const writtenPromise = input.promises[0];
  const summary = [
    input.mode === "story" ? "你选择了保留结果提示的故事模式。" : "你选择在较少提示下判断人物反应。",
    `错题本版面：题解 ${counts.solution} 格、留言 ${counts.message} 格、留白 ${counts.blank} 格。`,
    input.stats.agency >= 60 ? "你已经开始主动安排边界和节奏。" : "你仍容易被倒计时与他人的安排推着走。",
    input.stats.mutual >= 8 ? "你们初步形成了双向共担。" : input.stats.mutual < 0 ? "你们的倾诉与承担暂时不对称。" : "你们正在试探怎样互相照顾。",
    input.stats.risk >= 16 ? "关系已经留下较明显的校园痕迹。" : "秘密目前仍被控制在较小范围。",
    writtenPromise
      ? writtenPromise.status === "withheld"
        ? "你保留了空白，没有用仓促承诺填满它。"
        : `你写下了“${writtenPromise.title}”，它会占用第一章的日程。`
      : "你还没有写下会占用未来的承诺。"
  ];

  return {
    createdAt: input.createdAt ?? new Date().toISOString(),
    playerName: input.playerName,
    mode: input.mode,
    endingId: input.endingId,
    stats: { ...input.stats },
    notebook: { slots: [...input.notebook.slots], committed: input.notebook.committed },
    promises: input.promises.map((promise) => ({ ...promise })),
    decisionIds: [...input.decisionIds],
    summary
  };
}
