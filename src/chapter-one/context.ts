import type { ChapterOneState, LongTermProgress } from "../types";
import { getWeekDefinition } from "./model";

export interface ChapterOneContext {
  prompt: string;
  pressure: string[];
  echoTitle: string;
  echoLines: string[];
}

function hasFact(progress: LongTermProgress, fact: string): boolean {
  return progress.facts.includes(fact);
}

function pageState(progress: LongTermProgress): string | null {
  return progress.facts.find((fact) => fact.startsWith("page17-state:"))?.split(":")[1] ?? null;
}

function communicationPattern(progress: LongTermProgress): string | null {
  return progress.facts
    .find((fact) => fact.startsWith("first-communication-pattern:"))
    ?.split(":")[1] ?? null;
}

function seatRoute(progress: LongTermProgress): string | null {
  return progress.facts.find((fact) => fact.startsWith("seat-route:"))?.split(":")[1] ?? null;
}

function patternLabel(pattern: string | null): string {
  if (pattern === "control") return "你在句子里留下了命令式的痕迹";
  if (pattern === "avoidance") return "你把冲突暂时写成了没事";
  if (pattern === "listening-boundary") return "你尝试同时保留倾听与边界";
  if (pattern === "responsible-expression") return "你承认了自己的感受，也留下了责任";
  if (pattern === "listening") return "你接受有些部分不属于你的答案";
  if (pattern === "direct-explanation") return "你选择先把问题说清楚";
  return "沟通习惯还没有固定下来";
}

export function deriveChapterOneContext(
  state: ChapterOneState,
  progress: LongTermProgress
): ChapterOneContext {
  const definition = getWeekDefinition(state.currentWeek);
  const pressure = [...definition.pressure];
  const echoLines: string[] = [];
  let prompt = definition.prompt;

  if (state.currentWeek === 1) {
    echoLines.push(
      hasFact(progress, "opening-promise:blank-page")
        ? "序章保留了空白：本周没有任何承诺格替你做决定。"
        : "序章留下的承诺会从这一周开始占用真实时间。"
    );
    echoLines.push("座位表刚刚生效，纸页路线还没有被任何人确认。");
  }

  if (state.currentWeek === 2) {
    const route = seatRoute(progress);
    if (route === "noticed") {
      pressure.push("郭祺已经把你的传页路线列入观察");
      echoLines.push("上周纸页送达了，但郭祺记下了你的位置；任何帮助都可能留下痕迹。");
    } else if (route === "delivered") {
      echoLines.push("上周的纸页顺利到达周棠手里，你多了一条不必提高音量的路线。");
    } else if (route === "returned") {
      echoLines.push("上周你收回了纸页；这让风险变小，也让这周的开口更需要解释。");
    }
    if (state.relationships.liangFavor > 0) {
      pressure.push("梁硕愿意再替你留一次中转时间");
      echoLines.push("梁硕记得你替过他的值日，他愿意帮忙，但不会无限替你承担。");
    }
    prompt = state.relationships.liangFavor > 0
      ? "这周的帮助有了中转人情。先问梁硕愿意承担多少，再决定你要填满几格。"
      : "帮助不是单向加码。你能否让两个人都保留自己的节奏？";
  }

  if (state.currentWeek === 3) {
    if (hasFact(progress, "mutual-help:two-way")) {
      echoLines.push("上周的数学题解和英语批注形成了双向流动，你们不再只有一个人解释。");
    } else if (hasFact(progress, "mutual-help:player-only")) {
      pressure.push("英语作文的回批仍在等一个不被代替的回应");
      echoLines.push("上周的帮助仍偏向一边；这次不要用更大的牺牲掩盖没有回声的部分。");
    }
    if (hasFact(progress, "daily-contact-renegotiated")) {
      echoLines.push("周棠已经把几次见面改成留白或异步互批，改约本身也是她的行动。");
    }
    prompt = state.relationships.zhouPressure >= 6
      ? "承诺的压力已经可见。她没有按原计划出现，你可以追问事实，但不能替她决定该保护谁。"
      : "她没有出现。你可以追问，但无权用亲密交换另一个人的名字。";
  }

  if (state.currentWeek === 4) {
    const pattern = communicationPattern(progress);
    echoLines.push(`${patternLabel(pattern)}。一模不会替你抹掉这条记录。`);
    const page = pageState(progress);
    if (page === "torn") {
      pressure.push("第17题只剩一块被撕下的残片");
      echoLines.push("你撕下了原页，保留了部分内容，也保留了无法复原的断口。");
    } else if (page === "returned") {
      pressure.push("错题本已经交还，压痕仍留在你的记忆里");
      echoLines.push("你把本子交还周棠，但交还没有抹去那道复写压痕。");
    } else {
      echoLines.push("完整页仍在错题本里；你知道它不只属于你们两个人的故事。");
    }
    if (state.relationships.guoSuspicion >= 3) {
      pressure.push("郭祺的滞留名单会把考场外的动作也算进去");
    }
    prompt = "考场不接受临时加点。能带进去的，只有前三周已经练成的方法，以及你愿意承担的边界。";
  }

  if (!echoLines.length) echoLines.push("目前没有新的外部记录，先从这一周能控制的时间开始。");
  return {
    prompt,
    pressure: [...new Set(pressure)],
    echoTitle: state.currentWeek === 1 ? "开局回声" : "已经发生",
    echoLines: [...new Set(echoLines)]
  };
}
