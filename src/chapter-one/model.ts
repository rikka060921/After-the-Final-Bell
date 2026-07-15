import type {
  ChapterOneActivityId,
  ChapterOnePeriod,
  ChapterOneSlot,
  ChapterOneWeek,
  StatEffects
} from "../types";

export interface ChapterOneWeekDefinition {
  week: ChapterOneWeek;
  title: string;
  dateRange: string;
  pressure: string[];
  prompt: string;
}

export interface ActivityDefinition {
  id: ChapterOneActivityId;
  label: string;
  shortLabel: string;
  description: string;
  category: "留白" | "学习" | "恢复" | "关系" | "同学" | "个人" | "承诺";
  periods: ChapterOnePeriod[];
  statEffects: StatEffects;
  academicEffects?: Partial<Record<"mastery" | "speed" | "stability" | "falseMastery" | "sleepDebt", number>>;
  tendencyEffects?: Partial<Record<"listening" | "explanation" | "responsibility" | "avoidance" | "control" | "defiance", number>>;
}

export const CHAPTER_ONE_WEEKS: readonly ChapterOneWeekDefinition[] = [
  {
    week: 1,
    title: "新座位",
    dateRange: "距高考 200—194 天",
    pressure: ["上次月考后的座位调整", "周五数学周测", "郭祺开始记录晚自习滞留名单"],
    prompt: "新座位把你们分到教室两端。先决定有限的空档要留给什么。"
  },
  {
    week: 2,
    title: "双向订正",
    dateRange: "距高考 193—187 天",
    pressure: ["数学题解需要讲清", "英语作文等待互批", "周棠会调整一次原计划"],
    prompt: "帮助不是单向加码。你能否让两个人都保留自己的节奏？"
  },
  {
    week: 3,
    title: "空走廊",
    dateRange: "距高考 186—180 天",
    pressure: ["周四走廊约定", "桌洞里的完整题解", "第17题装订线继续松动"],
    prompt: "她没有出现。你可以追问，但无权用亲密交换另一个人的名字。"
  },
  {
    week: 4,
    title: "一模",
    dateRange: "距高考 179—170 天",
    pressure: ["四科模拟考", "睡眠与稳定度开始结算", "第17题页角出现第三种笔迹"],
    prompt: "考场不接受临时加点。能带进去的，只有前三周练成的方法。"
  }
] as const;

const DAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"] as const;

const PERIOD_LABELS: readonly [string, string][] = [
  ["课间 / 午间", "晚自习后"],
  ["课间 / 午间", "晚自习后"],
  ["课间 / 午间", "晚自习后"],
  ["课间 / 午间", "晚自习后"],
  ["课间 / 午间", "晚自习后"],
  ["放学后", "夜间"],
  ["下午", "夜间"]
] as const;

export function createWeekSlots(week: ChapterOneWeek): ChapterOneSlot[] {
  return DAY_LABELS.flatMap((dayLabel, dayIndex) => {
    const labels = PERIOD_LABELS[dayIndex] ?? ["课间", "晚间"];
    return (["break", "evening"] as const).map((period, periodIndex) => ({
      id: `w${week}-d${dayIndex + 1}-${period}`,
      week,
      dayIndex,
      dayLabel,
      period,
      periodLabel: labels[periodIndex] ?? period
    }));
  });
}

export function slotId(week: ChapterOneWeek, dayIndex: number, period: ChapterOnePeriod): string {
  return `w${week}-d${dayIndex + 1}-${period}`;
}

export const ACTIVITIES: readonly ActivityDefinition[] = [
  {
    id: "open",
    label: "保留空白",
    shortLabel: "留白",
    description: "不替这段时间预先写答案。留白不会被判成失约。",
    category: "留白",
    periods: ["break", "evening"],
    statEffects: {}
  },
  {
    id: "math-mastery",
    label: "整理数学题解",
    shortLabel: "数学题解",
    description: "慢下来复盘第17题一类的解法，提高掌握而不是只追速度。",
    category: "学习",
    periods: ["break", "evening"],
    statEffects: { study: 2, energy: -2, stress: 1 },
    academicEffects: { mastery: 3 }
  },
  {
    id: "math-speed",
    label: "限时速度训练",
    shortLabel: "限时训练",
    description: "计时完成一组题。精力太低时，练习会制造已经掌握的错觉。",
    category: "学习",
    periods: ["break", "evening"],
    statEffects: { study: 2, energy: -3, stress: 2 },
    academicEffects: { speed: 4 }
  },
  {
    id: "english-review",
    label: "英语作文自改",
    shortLabel: "作文自改",
    description: "先试着解释自己的表达，再等待别人修改。",
    category: "学习",
    periods: ["break", "evening"],
    statEffects: { study: 2, energy: -2 },
    academicEffects: { mastery: 2 },
    tendencyEffects: { explanation: 1 }
  },
  {
    id: "mutual-review",
    label: "双向互批",
    shortLabel: "双向互批",
    description: "你讲数学，她改英语。只有双方都能调整的帮助才算共担。",
    category: "关系",
    periods: ["evening"],
    statEffects: { study: 1, energy: -2, mutual: 2, bond: 1 },
    academicEffects: { mastery: 2, stability: 1 },
    tendencyEffects: { listening: 1, explanation: 1 }
  },
  {
    id: "rest",
    label: "睡眠与恢复",
    shortLabel: "恢复",
    description: "把一格真正交还给身体。稳定不是浪费时间。",
    category: "恢复",
    periods: ["break", "evening"],
    statEffects: { energy: 6, stress: -4 },
    academicEffects: { stability: 3, sleepDebt: -2 }
  },
  {
    id: "own-goal",
    label: "非分数目标",
    shortLabel: "个人目标",
    description: "散步、画画或读一页与排名无关的书，保留自己的生活。",
    category: "个人",
    periods: ["break", "evening"],
    statEffects: { agency: 4, stress: -2 }
  },
  {
    id: "help-liang",
    label: "替梁硕值日",
    shortLabel: "帮梁硕值日",
    description: "占用自己的空档换取一份具体的人情；他会记住，不直接变成好感。",
    category: "同学",
    periods: ["break"],
    statEffects: { energy: -2 },
    tendencyEffects: { responsibility: 1 }
  },
  {
    id: "observe-seat",
    label: "观察座位视线",
    shortLabel: "观察视线",
    description: "记下老师转身、郭祺抬头和纸页可通过的路线。",
    category: "同学",
    periods: ["break"],
    statEffects: { agency: 1, energy: -1 }
  },
  {
    id: "investigate-absence",
    label: "询问缺席线索",
    shortLabel: "询问线索",
    description: "只询问来源明确的事实，不翻找她或别人的私人物品。",
    category: "同学",
    periods: ["break", "evening"],
    statEffects: { energy: -1, stress: 1 }
  },
  {
    id: "notebook-message",
    label: "留下错题本回应",
    shortLabel: "本页回应",
    description: "把能承担的感受写清，同时承认有些秘密并不属于你。",
    category: "关系",
    periods: ["evening"],
    statEffects: { bond: 1, risk: 1, energy: -1 },
    tendencyEffects: { explanation: 1 }
  },
  {
    id: "walk",
    label: "安静同行十分钟",
    shortLabel: "十分钟同行",
    description: "见面不等于解决所有问题，也可以只是一起走一段路。",
    category: "关系",
    periods: ["evening"],
    statEffects: { bond: 2, stress: -2, risk: 1, energy: -1 },
    tendencyEffects: { listening: 1 }
  },
  {
    id: "promise-review",
    label: "复盘两个目标",
    shortLabel: "承诺 · 周复盘",
    description: "检查分数目标，也检查那个与分数无关的目标。",
    category: "承诺",
    periods: ["evening"],
    statEffects: { agency: 2, mutual: 2, stress: -1 },
    academicEffects: { stability: 1 }
  },
  {
    id: "promise-contact",
    label: "履行每天见面",
    shortLabel: "承诺 · 每天见",
    description: "它会真实占用晚自习后的时间；连续承担会产生额外压力。",
    category: "承诺",
    periods: ["evening"],
    statEffects: { bond: 1, energy: -1, stress: -1, risk: 1 }
  },
  {
    id: "promise-async",
    label: "改为异步互批",
    shortLabel: "改约 · 异步互批",
    description: "周棠把见面改成交换批注，保留帮助，也保留睡眠。",
    category: "承诺",
    periods: ["evening"],
    statEffects: { study: 1, mutual: 1, agency: 1 },
    academicEffects: { mastery: 1, stability: 1 }
  }
] as const;

export const activityById = new Map(ACTIVITIES.map((activity) => [activity.id, activity]));

export function getWeekDefinition(week: ChapterOneWeek): ChapterOneWeekDefinition {
  return CHAPTER_ONE_WEEKS.find((definition) => definition.week === week) ?? CHAPTER_ONE_WEEKS[0]!;
}
