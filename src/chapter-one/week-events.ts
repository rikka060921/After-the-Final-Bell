import { applyStatEffects, clamp } from "../state";
import type {
  AcademicState,
  BehaviorTendencies,
  ChapterOneActivityId,
  ChapterOneRelationships,
  ChapterOneState,
  ChapterOneWeek,
  GameStats,
  LongTermProgress,
  StatEffects,
  WeekExecutionState
} from "../types";
import { createWeekChallenge } from "./week-challenge";

interface WeekEventContext {
  state: ChapterOneState;
  counts: Map<ChapterOneActivityId, number>;
  progress: LongTermProgress;
}

export interface WeekEventChoice {
  id: string;
  label: string;
  description: string;
  hint: string;
  consequence: string;
  effects?: StatEffects;
  academic?: Partial<AcademicState>;
  tendencies?: Partial<BehaviorTendencies>;
  relationships?: Partial<ChapterOneRelationships>;
  facts?: string[];
}

export interface WeekEventView {
  id: string;
  title: string;
  scene: string;
  prompt: string;
  choices: readonly WeekEventChoice[];
}

interface WeekEventDefinition extends Omit<WeekEventView, "scene"> {
  week: ChapterOneWeek;
  scene(context: WeekEventContext): string;
}

const WEEK_EVENTS: readonly WeekEventDefinition[] = [
  {
    id: "w1-chalk-margin",
    week: 1,
    title: "粉笔灰落在第17题上",
    scene: ({ counts }) =>
      (counts.get("math-mastery") ?? 0) + (counts.get("math-speed") ?? 0) >= 2
        ? "周测前，张苇把第17题的变式写到黑板上。你认得结构，却发现自己一直跳过了最后一种情况。"
        : "周测前，张苇把第17题的变式写到黑板上。草稿纸很快写满，但你还没有一套能重复调用的方法。",
    prompt: "下课铃只给你十分钟。",
    choices: [
      { id: "w1-derive", label: "从条件重新推一遍", description: "不追求立刻写满，先找漏掉的情况。", hint: "掌握提高，消耗少量精力", consequence: "你把漏掉的条件圈在页角；这次慢下来变成了之后能调用的方法。", effects: { study: 1, energy: -1 }, academic: { mastery: 3 }, tendencies: { responsibility: 1 }, facts: ["week1-rederived-problem17"] },
      { id: "w1-copy", label: "先抄完整答案", description: "让卷面看起来已经订正，理解留到以后。", hint: "短期省时，但会形成错觉掌握", consequence: "红笔覆盖了空白，真正不会的部分却暂时被藏在整洁下面。", effects: { stress: -1 }, academic: { falseMastery: 2 }, tendencies: { avoidance: 1 }, facts: ["week1-copied-problem17"] },
      { id: "w1-margin-question", label: "在页边留下一个问号", description: "写清自己卡住的位置，等一次可以拒绝的回应。", hint: "增加共担，也留下纸面痕迹", consequence: "你只问了卡住的那一步，没有把整页题解变成周棠的任务。", effects: { bond: 1, mutual: 1, risk: 1 }, tendencies: { explanation: 1 }, facts: ["week1-asked-specific-question"] }
    ]
  },
  {
    id: "w1-first-page",
    week: 1,
    title: "换座后的第一张纸",
    scene: ({ counts }) => {
      if ((counts.get("observe-seat") ?? 0) > 0) return "你已经记住郭祺抬头的节奏。纸页在掌心折成四格，下一次视线移动还有十几秒。";
      if ((counts.get("help-liang") ?? 0) > 0) return "梁硕扫了一眼你手里的纸，又看了看讲台。他记得那次值日，但没有替你直接做决定。";
      return "新座位隔着四排。你不知道郭祺什么时候抬头，也还没有理由让梁硕替你接住这张纸。";
    },
    prompt: "纸页必须先离开你的手，路线才会真正开始。",
    choices: [
      { id: "w1-ask-liang", label: "先把情况告诉梁硕", description: "请求一次具体帮助，也允许他拒绝。", hint: "同学关系与可解释路线", consequence: "梁硕没有保证成功，只把扫帚靠在过道边，替你制造了一个合理停顿。", relationships: { liangFavor: 1 }, tendencies: { explanation: 1 }, facts: ["week1-liang-informed"] },
      { id: "w1-wait-sightline", label: "等下一次视线移开", description: "先观察，再决定是否传递。", hint: "获得座位情报，消耗精力", consequence: "你多等了一轮，终于分清了偶然低头和稳定的视线空档。", effects: { energy: -1 }, relationships: { seatIntel: 2 }, tendencies: { listening: 1 }, facts: ["week1-waited-for-sightline"] },
      { id: "w1-direct-desk", label: "直接塞进前排桌洞", description: "用速度换路线，承担被追问的可能。", hint: "自主提高，校园风险上升", consequence: "纸页很快离手，也在桌洞边留下了清楚的折痕。", effects: { agency: 2, risk: 2 }, tendencies: { defiance: 1 }, relationships: { guoSuspicion: 1 }, facts: ["week1-used-direct-route"] }
    ]
  },
  {
    id: "w1-lights-out",
    week: 1,
    title: "熄灯前的十分钟",
    scene: ({ counts }) =>
      (counts.get("rest") ?? 0) + (counts.get("own-goal") ?? 0) > 0
        ? "寝室熄灯前，你还保留着一小段没有被卷子占走的时间。走廊很安静，手机也没有新消息。"
        : "寝室熄灯前，今天最后一张卷子仍摊在床沿。你已经很累，却不愿意承认日程没有给身体留下位置。",
    prompt: "这十分钟不会同时容纳所有事情。",
    choices: [
      { id: "w1-sleep", label: "关灯睡觉", description: "让今天在没有解释完一切时结束。", hint: "恢复精力与稳定", consequence: "你没有利用最后十分钟证明自己。第二天早读时，脑子第一次没有发涨。", effects: { energy: 5, stress: -3 }, academic: { stability: 2, sleepDebt: -1 }, facts: ["week1-chose-sleep"] },
      { id: "w1-short-note", label: "只写一句具体的话", description: "不许诺明天，只说明今天。", hint: "亲密提高，留下轻微风险", consequence: "纸页上只有一句“我看见你改的那一步了”，没有把疲惫包装成长篇保证。", effects: { bond: 2, risk: 1 }, tendencies: { explanation: 1 }, facts: ["week1-left-short-note"] },
      { id: "w1-own-page", label: "读一页与排名无关的书", description: "把注意力还给自己的生活。", hint: "自主提高并降低压力", consequence: "那一页没有帮助你多得一分，却提醒你并不只由分数和关系组成。", effects: { agency: 3, stress: -2 }, facts: ["week1-kept-own-page"] }
    ]
  },
  {
    id: "w2-two-colors",
    week: 2,
    title: "两种颜色的批注",
    scene: ({ counts }) =>
      (counts.get("mutual-review") ?? 0) > 0
        ? "数学页边是你的蓝笔，英语作文上是周棠的红笔。两个人都留下了能被修改的部分。"
        : "错题本翻到中间，一边写得很满，另一边几乎没有回应。帮助正在发生，却还没有真正双向流动。",
    prompt: "她把笔放在两页中间，问先看哪一边。",
    choices: [
      { id: "w2-trade-errors", label: "各讲一个最不确定的地方", description: "不展示最好的一面，交换真正需要帮助的部分。", hint: "掌握、倾听与共担提高", consequence: "你们没有互相检查努力程度，只交换了各自最容易出错的一步。", effects: { mutual: 2, bond: 1 }, academic: { mastery: 2, stability: 1 }, tendencies: { listening: 1, explanation: 1 }, facts: ["week2-shared-uncertainty"] },
      { id: "w2-finish-math", label: "先把数学全部讲完", description: "优先完成自己熟悉的帮助。", hint: "掌握提高，但帮助偏向一边", consequence: "数学页变得完整，英语作文仍夹在本子后面。你解决了问题，也错过了她原本要说的那一段。", effects: { study: 2 }, academic: { mastery: 2 }, tendencies: { control: 1 }, facts: ["week2-math-first"] },
      { id: "w2-let-zhou-pick", label: "让她决定今天讲多少", description: "先确认她此刻还有多少精力。", hint: "倾听与自主提高", consequence: "周棠删掉了原计划的一半，只留下两处真正需要一起看的批注。", effects: { agency: 1, mutual: 1, stress: -1 }, tendencies: { listening: 2 }, relationships: { zhouPressure: -1 }, facts: ["week2-zhou-set-review-pace"] }
    ]
  },
  {
    id: "w2-crowded-evenings",
    week: 2,
    title: "被承诺占满的晚上",
    scene: ({ counts }) => {
      const contacts = counts.get("promise-contact") ?? 0;
      return contacts > 2
        ? `这一周有 ${contacts} 个晚上被“每天见面”提前锁住。第三天起，周棠回复的句子明显变短。`
        : "你们的见面没有占满每个晚上。某些空白让改约仍然可以被说出口。";
    },
    prompt: "兑现并不是唯一一种负责。",
    choices: [
      { id: "w2-renegotiate", label: "把固定见面改成两次", description: "说明精力和考试安排，再保留异步互批。", hint: "自主与共担提高", consequence: "你们划掉了三个日期。被删掉的承诺没有变成失约，而是变成双方都能承担的新安排。", effects: { agency: 2, mutual: 2, stress: -2 }, tendencies: { explanation: 2, responsibility: 1 }, relationships: { zhouPressure: -2 }, facts: ["week2-player-renegotiated"] },
      { id: "w2-force-fulfill", label: "按原计划全部兑现", description: "不修改说出口的话，即使两个人都已经疲惫。", hint: "短期亲密，精力与压力恶化", consequence: "每个晚上都见到了，第四次之后却只剩下互相确认“我还在”。", effects: { bond: 2, energy: -4, stress: 3 }, academic: { sleepDebt: 2 }, relationships: { zhouPressure: 2 }, facts: ["week2-forced-full-contact"] },
      { id: "w2-silent-cancel", label: "临时取消一次", description: "先躲开今晚，暂时不解释原因。", hint: "恢复少量精力，但削弱可信度", consequence: "今晚空了出来，消息框也一直空着。休息发生了，解释被推迟到更难开口的时候。", effects: { energy: 2, bond: -1 }, tendencies: { avoidance: 2 }, facts: ["week2-cancelled-without-explanation"] }
    ]
  },
  {
    id: "w2-close-notebook",
    week: 2,
    title: "她先合上错题本",
    scene: () => "互批还剩最后一段时，周棠先把本子合上。她说今天到这里，手却仍压在第17题的页角。",
    prompt: "亲密不能替你决定她为什么停下。",
    choices: [
      { id: "w2-respect-stop", label: "按她说的停在这里", description: "不追问理由，把未完成留到下一次。", hint: "倾听与边界", consequence: "你没有把沉默当成需要立刻修好的故障。她把本子带走时，主动约了下次归还时间。", effects: { mutual: 1 }, tendencies: { listening: 2 }, relationships: { zhouPressure: -1 }, facts: ["week2-respected-stop"] },
      { id: "w2-ask-capacity", label: "问她还需要什么", description: "只询问当下需要，不要求解释全部原因。", hint: "解释与共担", consequence: "她只说想一个人走到车站。你得到的是边界，不是秘密。", effects: { mutual: 2 }, tendencies: { listening: 1, explanation: 1 }, facts: ["week2-asked-current-need"] },
      { id: "w2-keep-solving", label: "把最后一段继续讲完", description: "认为完成任务比暂时停下更可靠。", hint: "学习提高，周棠压力增加", consequence: "题解完整了。她听完才走，也没有再提下一次什么时候继续。", effects: { study: 1, bond: -1 }, academic: { mastery: 1 }, tendencies: { control: 1 }, relationships: { zhouPressure: 2 }, facts: ["week2-continued-past-stop"] }
    ]
  },
  {
    id: "w3-empty-corridor",
    week: 3,
    title: "空走廊里的第十一分钟",
    scene: ({ counts }) => {
      const investigations = counts.get("investigate-absence") ?? 0;
      return investigations > 2
        ? "你已经问过不止两个人。得到的版本越来越多，来源却越来越模糊。走廊仍然没有周棠。"
        : investigations > 0
          ? "你只确认了一件事：她临时去了旧实验楼，而且是在替别人守一个约定。"
          : "约定后的第十一分钟，走廊仍然空着。你没有线索，只能先决定怎样处理不知道。";
    },
    prompt: "等待也会暴露一个人处理不确定性的习惯。",
    choices: [
      { id: "w3-record-facts", label: "只记下能确认的事实", description: "把时间、地点和来源分开，不补全故事。", hint: "稳定与责任提高", consequence: "你在页角写下三行事实，第四行保持空白。未知没有被误写成证据。", effects: { stress: -1 }, academic: { stability: 1 }, tendencies: { responsibility: 2 }, facts: ["week3-recorded-only-facts"] },
      { id: "w3-keep-asking", label: "继续找人问她去了哪里", description: "用更多版本填满等待。", hint: "获得风险，也可能形成控制习惯", consequence: "你听见了三个名字和两个地点。消息变多，可信的部分反而更少。", effects: { risk: 2, stress: 1 }, tendencies: { control: 2 }, relationships: { guoSuspicion: 1 }, facts: ["week3-spread-inquiry"] },
      { id: "w3-leave-corridor", label: "到点后先离开", description: "不把等待无限延长，保留之后解释的空间。", hint: "自主提高，但暂时得不到线索", consequence: "你在第十二分钟离开。没有惩罚她，也没有用继续等待证明自己的牺牲。", effects: { agency: 2, stress: -1 }, tendencies: { listening: 1 }, facts: ["week3-left-after-boundary"] }
    ]
  },
  {
    id: "w3-complete-solution",
    week: 3,
    title: "桌洞里的完整题解",
    scene: ({ counts }) =>
      (counts.get("notebook-message") ?? 0) > 0
        ? "第二天，完整题解压在桌洞最下面。你已经为回应留出位置，但那一格还没有决定要写什么。"
        : "第二天，完整题解压在桌洞最下面。每一步都写得很清楚，只有缺席本身没有解释。",
    prompt: "题解能够回答数学问题，不能自动回答关系问题。",
    choices: [
      { id: "w3-acknowledge-work", label: "先确认她留下的具体帮助", description: "回应题解，不用感谢逼迫她解释缺席。", hint: "共担与解释提高", consequence: "你圈出最有用的两步，只写“这部分我会了”。帮助被看见，秘密没有被索取。", effects: { mutual: 2, bond: 1 }, academic: { mastery: 1 }, tendencies: { explanation: 1 }, facts: ["week3-acknowledged-solution"] },
      { id: "w3-trade-answer", label: "写“题会了，人呢”", description: "把回应变成交换答案的条件。", hint: "亲密可能下降，控制增加", consequence: "这句话很直接，也把她留下题解的行动缩成了必须交代行踪的凭证。", effects: { bond: -1, stress: 1 }, tendencies: { control: 2 }, relationships: { zhouPressure: 2 }, facts: ["week3-demanded-whereabouts"] },
      { id: "w3-no-message", label: "只完成订正，不留言", description: "暂时不处理关系，把页面保持为学科记录。", hint: "学习提高，沟通被延后", consequence: "订正完整地写进本子。你的不安没有伤人，也没有被说出来。", effects: { study: 1 }, academic: { mastery: 2 }, tendencies: { avoidance: 1 }, facts: ["week3-kept-page-academic"] }
    ]
  },
  {
    id: "w3-third-person",
    week: 3,
    title: "另一个人的名字",
    scene: () => "周棠终于说，缺席涉及她答应替别人保密的部分。她没有否认你受到了影响，也没有交出那个人的名字。",
    prompt: "你有权谈自己的感受，没有权用亲密换取别人的隐私。",
    choices: [
      { id: "w3-ask-boundary", label: "问哪些部分可以谈", description: "把可解释的范围交给她说明。", hint: "倾听、解释与共担提高", consequence: "她说明了时间和安全问题，保留了名字。你获得足够处理关系的信息，而不是完整秘密。", effects: { mutual: 2, bond: 1 }, tendencies: { listening: 2, explanation: 1 }, facts: ["week3-negotiated-information-boundary"] },
      { id: "w3-name-now", label: "要求现在说出名字", description: "认为关系中的影响意味着必须知道全部。", hint: "控制与压力增加", consequence: "她没有回答。你们第一次清楚看见，亲密和知情权并不是同一件事。", effects: { bond: -2, stress: 2 }, tendencies: { control: 3 }, relationships: { zhouPressure: 2 }, facts: ["week3-demanded-name"] },
      { id: "w3-say-fine", label: "说“没事，不用解释”", description: "避免冲突，也撤回自己真实受到的影响。", hint: "短期降压，回避增加", consequence: "谈话很快结束。边界被尊重了，你的失落也被一起藏了起来。", effects: { stress: -1 }, tendencies: { avoidance: 2 }, facts: ["week3-hid-own-impact"] }
    ]
  },
  {
    id: "w4-last-page",
    week: 4,
    title: "最后一晚的错题",
    scene: ({ counts }) =>
      (counts.get("math-mastery") ?? 0) + (counts.get("english-review") ?? 0) >= 2
        ? "最后一晚，错题本里已经有几类能稳定复述的方法。新的题仍然不会，但你知道它们分别卡在哪里。"
        : "最后一晚，错题本塞进了许多新题。每一页都眼熟，却很难在不看答案时完整复述。",
    prompt: "现在增加题量，还是整理能带进考场的方法？",
    choices: [
      { id: "w4-close-loop", label: "只复盘三类错误", description: "停止扩题，把不会、粗心和时间不足分开。", hint: "掌握与稳定提高", consequence: "你没有做完所有卷子，却给三类错误各留下了一个可以执行的动作。", academic: { mastery: 2, stability: 2, falseMastery: -1 }, tendencies: { responsibility: 1 }, facts: ["week4-closed-error-loop"] },
      { id: "w4-new-paper", label: "再开一张新卷", description: "用更多完成量压住对未知的焦虑。", hint: "速度略升，睡眠债和错觉掌握增加", consequence: "新卷写到凌晨，最后两页的正确率没有进入你的记忆。", effects: { study: 1, energy: -3, stress: 2 }, academic: { speed: 1, sleepDebt: 2, falseMastery: 2 }, facts: ["week4-opened-new-paper"] },
      { id: "w4-explain-method", label: "把解法讲给空椅子听", description: "不用另一个人陪，也检查自己能否说清。", hint: "掌握、解释与自主提高", consequence: "讲到第三步时你卡住一次，又从条件重新开始。那处停顿比答案更有用。", effects: { agency: 1 }, academic: { mastery: 3 }, tendencies: { explanation: 2 }, facts: ["week4-explained-to-empty-seat"] }
    ]
  },
  {
    id: "w4-one-am",
    week: 4,
    title: "凌晨一点的灯",
    scene: ({ counts, progress }) =>
      (counts.get("rest") ?? 0) > 0 || progress.academic.sleepDebt <= 3
        ? "凌晨一点，灯已经关了。你仍然醒着，但身体没有继续被任务占用。"
        : "凌晨一点，台灯还亮着。字开始重影，刚订正过的步骤又从短时记忆里滑走。",
    prompt: "考前最后的精力只能花一次。",
    choices: [
      { id: "w4-sleep-now", label: "现在关灯", description: "接受今天已经不能再增加有效掌握。", hint: "显著改善精力与稳定", consequence: "你在没有准备完的感觉里睡着。第二天醒来，那些真正掌握的步骤还在。", effects: { energy: 6, stress: -3 }, academic: { stability: 3, sleepDebt: -2 }, facts: ["week4-slept-before-mock"] },
      { id: "w4-ten-minutes", label: "设十分钟计时器", description: "只看归因标签，铃响后停止。", hint: "小幅掌握，保持边界", consequence: "计时器响时你确实停下，只带走三条归因，没有继续打开新题。", effects: { energy: -1 }, academic: { mastery: 1, stability: 1 }, tendencies: { responsibility: 1 }, facts: ["week4-used-stop-timer"] },
      { id: "w4-until-done", label: "做到觉得安心为止", description: "把停止条件交给焦虑。", hint: "压力、睡眠债和逆反风险", consequence: "安心没有出现，天却快亮了。你完成了更多题，也失去了调用它们的一部分稳定。", effects: { energy: -5, stress: 4 }, academic: { speed: 1, stability: -2, sleepDebt: 3 }, facts: ["week4-studied-without-stop"] }
    ]
  },
  {
    id: "w4-before-gate",
    week: 4,
    title: "进考场前的纸条",
    scene: () => "教学楼门口，周棠递来一张只写了两行的纸：别替我考，也别让我替你考。下面留着半行空白。",
    prompt: "最后半行写什么，不会直接替你得到分数。",
    choices: [
      { id: "w4-own-paper", label: "“各自把自己的卷写完”", description: "把陪伴写成并肩，而不是代替。", hint: "自主与共担提高", consequence: "她看完把纸折回两半。你们没有交换保证，只确认各自进入自己的考场。", effects: { agency: 2, mutual: 2, stress: -1 }, tendencies: { responsibility: 1 }, facts: ["week4-mutual-independence"] },
      { id: "w4-wait-me", label: "“考完一定等我”", description: "在进场前追加一个必须兑现的约定。", hint: "亲密提高，也增加压力", consequence: "她点头了，但看了一眼墙上的考场分布。新承诺在最后一分钟占用了注意力。", effects: { bond: 2, stress: 1 }, relationships: { zhouPressure: 1 }, facts: ["week4-added-post-exam-promise"] },
      { id: "w4-leave-blank", label: "保留半行空白", description: "不在考前继续增加需要解释的内容。", hint: "稳定与边界", consequence: "纸条保持原样。半行空白没有制造距离，只把今天最重要的事留给各自完成。", effects: { stress: -2 }, academic: { stability: 1 }, tendencies: { listening: 1 }, facts: ["week4-left-half-line-blank"] }
    ]
  }
] as const;

function planCounts(state: ChapterOneState): Map<ChapterOneActivityId, number> {
  const plan = state.plans.find((candidate) => candidate.week === state.currentWeek);
  if (!plan) throw new Error(`Missing plan for week ${state.currentWeek}`);
  const counts = new Map<ChapterOneActivityId, number>();
  Object.values(plan.assignments).forEach((assignment) => {
    counts.set(assignment.activityId, (counts.get(assignment.activityId) ?? 0) + 1);
  });
  return counts;
}

function definitionById(id: string): WeekEventDefinition | undefined {
  return WEEK_EVENTS.find((event) => event.id === id);
}

export function createWeekExecution(state: ChapterOneState): WeekExecutionState {
  return {
    week: state.currentWeek,
    eventIds: WEEK_EVENTS.filter((event) => event.week === state.currentWeek).map((event) => event.id),
    cursor: 0,
    choiceIds: [],
    log: []
  };
}

export function currentWeekEvent(
  state: ChapterOneState,
  progress: LongTermProgress
): WeekEventView | null {
  const execution = state.weekExecution;
  if (!execution || execution.week !== state.currentWeek) return null;
  const definition = definitionById(execution.eventIds[execution.cursor] ?? "");
  if (!definition) return null;
  return {
    id: definition.id,
    title: definition.title,
    scene: definition.scene({ state, counts: planCounts(state), progress }),
    prompt: definition.prompt,
    choices: definition.choices
  };
}

function applyNumeric<T extends object>(target: T, effects: Partial<T> | undefined): T {
  if (!effects) return { ...target };
  const next = { ...target };
  (Object.keys(effects) as Array<keyof T>).forEach((key) => {
    const value = effects[key];
    const current = next[key];
    if (typeof value !== "number" || typeof current !== "number") return;
    Object.assign(next, { [key]: clamp(current + value) });
  });
  return next;
}

export interface ResolveWeekEventResult {
  chapterOne: ChapterOneState;
  progress: LongTermProgress;
  stats: GameStats;
}

export function resolveWeekEventChoice(
  state: ChapterOneState,
  progress: LongTermProgress,
  stats: GameStats,
  choiceId: string
): ResolveWeekEventResult {
  if (state.phase !== "week-events" || !state.weekExecution) {
    throw new Error("当前没有正在执行的本周事件。");
  }
  const event = currentWeekEvent(state, progress);
  if (!event) throw new Error("本周事件记录不完整。");
  const choice = event.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) throw new Error("这个行动不属于当前事件。");

  const execution = state.weekExecution;
  if (execution.choiceIds.includes(choice.id)) throw new Error("这个行动已经执行过。");
  const nextExecution: WeekExecutionState = {
    ...execution,
    cursor: execution.cursor + 1,
    choiceIds: [...execution.choiceIds, choice.id],
    log: [...execution.log, choice.consequence]
  };
  const nextResults = state.results.map((result) =>
    result.week === state.currentWeek
      ? { ...result, echoes: [...result.echoes, choice.consequence] }
      : { ...result, completed: [...result.completed], changes: [...result.changes], echoes: [...result.echoes], nextWeek: [...result.nextWeek] }
  );
  const next: ChapterOneState = {
    ...state,
    results: nextResults,
    relationships: applyNumeric(state.relationships, choice.relationships),
    resolvedEventIds: [...new Set([...state.resolvedEventIds, event.id, choice.id])],
    weekExecution: nextExecution
  };
  const nextProgress: LongTermProgress = {
    facts: [...new Set([...progress.facts, `week-event:${event.id}`, `week-choice:${choice.id}`, ...(choice.facts ?? [])])],
    academic: applyNumeric(progress.academic, choice.academic),
    tendencies: applyNumeric(progress.tendencies, choice.tendencies)
  };
  let nextStats = applyStatEffects(stats, choice.effects ?? {}, { deriveRebellion: false }).stats;

  if (nextExecution.cursor >= nextExecution.eventIds.length) {
    nextStats = applyStatEffects(nextStats, {}, { deriveRebellion: true }).stats;
    next.phase = "week-challenge";
    next.weekChallenge = createWeekChallenge(next, nextProgress, nextStats);
  }
  return { chapterOne: next, progress: nextProgress, stats: nextStats };
}

export function isKnownWeekEvent(id: string): boolean {
  return Boolean(definitionById(id));
}

export function isKnownWeekEventChoice(eventId: string, choiceId: string): boolean {
  return Boolean(definitionById(eventId)?.choices.some((choice) => choice.id === choiceId));
}
