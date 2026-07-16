import { applyStatEffects, clamp } from "../state";
import type {
  ChapterOneActivityId,
  ChapterOneState,
  ChapterOneWeek,
  GameStats,
  LongTermProgress,
  StatEffects,
  WeekChallengeActionId,
  WeekChallengeState
} from "../types";

type ChallengeTrackId = keyof WeekChallengeState["tracks"];
type ChallengeTrackEffects = Partial<WeekChallengeState["tracks"]>;

export interface WeekChallengeCopy {
  label: string;
  title: string;
  scene: string;
}

export interface WeekChallengeAction {
  id: WeekChallengeActionId;
  label: string;
  description: string;
  hint: string;
  available: number;
}

export interface WeekChallengeOpponentPreview {
  actor: string;
  title: string;
  telegraph: string;
  effect: string;
  effects: ChallengeTrackEffects;
  counterActionId: WeekChallengeActionId;
  counterLabel: string;
}

interface ChallengeActionDefinition extends Omit<WeekChallengeAction, "available"> {
  trackEffects: ChallengeTrackEffects;
  statEffects?: StatEffects;
  tendencies?: Partial<LongTermProgress["tendencies"]>;
  fact: string;
}

interface ChallengeScenarioContext {
  state: ChapterOneState;
  progress: LongTermProgress;
  stats: GameStats;
  counts: Map<ChapterOneActivityId, number>;
}

interface ChallengeOpponentMove {
  actor: string;
  title: string;
  telegraph: string;
  effects: ChallengeTrackEffects;
  counterActionId: WeekChallengeActionId;
  counterSuccess: string;
}

interface ChallengeScenario extends WeekChallengeCopy {
  id: string;
  week: ChapterOneWeek;
  initialEffects: ChallengeTrackEffects;
  matches?: (context: ChallengeScenarioContext) => boolean;
  moves: readonly [ChallengeOpponentMove, ChallengeOpponentMove];
}

interface ChallengeCombo {
  previous: WeekChallengeActionId;
  current: WeekChallengeActionId;
  label: string;
  description: string;
  effects: ChallengeTrackEffects;
}

const ACTIONS: readonly ChallengeActionDefinition[] = [
  {
    id: "method",
    label: "调用方法",
    description: "把任务拆成已经练过的步骤，优先消化积压。",
    hint: "积压大幅下降，关系负荷略升",
    trackEffects: { backlog: -3, strain: 1 },
    tendencies: { responsibility: 1 },
    fact: "challenge-used-method"
  },
  {
    id: "recover",
    label: "抢回恢复",
    description: "停一轮，把呼吸和注意力拉回身体。",
    hint: "关系负荷大幅下降，积压略升",
    trackEffects: { backlog: 1, strain: -3 },
    statEffects: { energy: 2, stress: -1 },
    fact: "challenge-used-recovery"
  },
  {
    id: "network",
    label: "借用关系网",
    description: "请已经建立联系的同学提供路线或来源。",
    hint: "被注意大幅下降，积压略升",
    trackEffects: { backlog: 1, attention: -3 },
    tendencies: { explanation: 1 },
    fact: "challenge-used-network"
  },
  {
    id: "coordinate",
    label: "现场协商",
    description: "把能做、不能做和需要改约的部分说清。",
    hint: "三个压力轨道同时下降",
    trackEffects: { backlog: -1, attention: -1, strain: -1 },
    statEffects: { mutual: 1 },
    tendencies: { listening: 1, explanation: 1 },
    fact: "challenge-used-coordination"
  },
  {
    id: "set-boundary",
    label: "划出边界",
    description: "明确放弃一件事，不再用无限加码解决冲突。",
    hint: "关系负荷下降，但更容易被旁人注意",
    trackEffects: { attention: 1, strain: -3 },
    statEffects: { agency: 2 },
    fact: "challenge-set-boundary"
  },
  {
    id: "push-through",
    label: "先硬顶过去",
    description: "不调用准备，直接用精力压住眼前任务。",
    hint: "积压下降，关系负荷明显上升",
    trackEffects: { backlog: -2, strain: 2 },
    statEffects: { energy: -2, stress: 1 },
    tendencies: { avoidance: 1 },
    fact: "challenge-pushed-through"
  }
] as const;

const COMBOS: readonly ChallengeCombo[] = [
  {
    previous: "method",
    current: "recover",
    label: "节奏回收",
    description: "先拆清问题再停下来，未完成事项没有继续追着你跑。",
    effects: { backlog: -1, strain: -1 }
  },
  {
    previous: "network",
    current: "coordinate",
    label: "信息落地",
    description: "来源和当事人接上了，传言与误会同时失去空间。",
    effects: { attention: -1, strain: -1 }
  },
  {
    previous: "set-boundary",
    current: "method",
    label: "有限解法",
    description: "先删掉不可能完成的部分，剩下的步骤变得真正可做。",
    effects: { backlog: -2 }
  }
] as const;

const SCENARIOS: readonly ChallengeScenario[] = [
  {
    id: "w1-corridor-loop",
    week: 1,
    label: "突发 · 走廊折返",
    title: "郭祺把名单带进了空走廊",
    scene: "你前面几次试探已经留下痕迹。郭祺没有当场点名，而是拿着滞留名单沿你走过的路线折返；梁骁在另一头把纸页压进练习册。",
    initialEffects: { attention: 1 },
    matches: ({ state, stats }) => state.relationships.guoSuspicion >= 2 || stats.risk >= 18,
    moves: [
      {
        actor: "郭祺",
        title: "先封住走廊出口",
        telegraph: "他没有看你，只把核对顺序改成从后门开始。下一轮，原来的路线会直接撞上名单。",
        effects: { attention: 2 },
        counterActionId: "set-boundary",
        counterSuccess: "你放弃原路线，郭祺守住的出口没有等到人。"
      },
      {
        actor: "梁骁",
        title: "把纸页拆成两段消息",
        telegraph: "梁骁准备只传结果、不传来源。这样更快，但周棠会收到一段无法核对的话。",
        effects: { strain: 2 },
        counterActionId: "coordinate",
        counterSuccess: "你把可说和不可说的部分当面分开，梁骁不再替你删句子。"
      }
    ]
  },
  {
    id: "w1-register-sweep",
    week: 1,
    label: "突发 · 滞留名单",
    title: "郭祺提前收起了名单",
    scene: "张苇临时要收订正本，郭祺同时从最后一排开始核对滞留名单。纸页、周测和座位路线挤进了同一个课间。",
    initialEffects: {},
    moves: [
      {
        actor: "郭祺",
        title: "逐排核对座位",
        telegraph: "他会在下一轮查到你这一排。一个人解释只会让视线停得更久。",
        effects: { attention: 2 },
        counterActionId: "network",
        counterSuccess: "梁骁补上了真实的值日路线，郭祺的核对没有停在你身上。"
      },
      {
        actor: "张苇",
        title: "课间结束前收订正本",
        telegraph: "她已经从讲台左边开始点数，剩下的时间只够完成一套明确步骤。",
        effects: { backlog: 2 },
        counterActionId: "method",
        counterSuccess: "你按练过的顺序补齐关键步骤，订正本赶在点数前合上。"
      }
    ]
  },
  {
    id: "w2-zhou-collision",
    week: 2,
    label: "突发 · 约定相撞",
    title: "周棠把两份时间表并排放下",
    scene: "她没有追问你为什么迟到，只把你的排程和原来的约定并排摊开。空白格已经不够，含糊的“再想办法”也不再算答案。",
    initialEffects: { strain: 1 },
    matches: ({ state, stats }) => state.relationships.zhouPressure >= 3 || stats.stress >= 68,
    moves: [
      {
        actor: "周棠",
        title: "要求你说出保留项",
        telegraph: "她下一句会问：这周到底哪一件事不能放弃。继续全部答应，会让冲突落回关系里。",
        effects: { strain: 2 },
        counterActionId: "set-boundary",
        counterSuccess: "你划掉一项不可能完成的安排，周棠终于能按剩下的内容判断。"
      },
      {
        actor: "张苇",
        title: "占用最后一段自习",
        telegraph: "临时讲评会吃掉你们刚刚腾出的时间。只有当场重排，约定才不会再次失效。",
        effects: { backlog: 1, strain: 1 },
        counterActionId: "coordinate",
        counterSuccess: "你们把见面改成可核对的异步记录，临时讲评没有让约定消失。"
      }
    ]
  },
  {
    id: "w2-extra-papers",
    week: 2,
    label: "突发 · 追加卷子",
    title: "两张新卷压在互批上面",
    scene: "晚自习前，张苇追加两张卷子。原本的互批、固定见面和睡眠都没有自动消失。",
    initialEffects: {},
    moves: [
      {
        actor: "张苇",
        title: "先收限时卷",
        telegraph: "她把最容易超时的一张放到了最前面。若没有现成方法，后面的任务会一起积住。",
        effects: { backlog: 2 },
        counterActionId: "method",
        counterSuccess: "你跳过已经确认的步骤，只保留真正需要计算的部分。"
      },
      {
        actor: "周棠",
        title: "按原时间等互批",
        telegraph: "她还不知道追加任务，下一轮会按旧约定出现。沉默会被理解成又一次失约。",
        effects: { strain: 2 },
        counterActionId: "coordinate",
        counterSuccess: "你提前说明新限制并给出替代时间，等待没有变成猜测。"
      }
    ]
  },
  {
    id: "w3-guo-interview",
    week: 3,
    label: "突发 · 逐个询问",
    title: "郭祺开始问每个人听见了什么",
    scene: "你追问过的路线反过来成了名单。郭祺不判断真假，只逐个记录来源；梁骁手里那份过于完整的说法也快轮到你。",
    initialEffects: { attention: 1 },
    matches: ({ state, progress }) =>
      state.relationships.guoSuspicion >= 4 || progress.facts.includes("week3-spread-inquiry"),
    moves: [
      {
        actor: "郭祺",
        title: "追问最初来源",
        telegraph: "他会把“大家都在说”拆回具体名字。继续补充版本，只会让你的路线更清楚。",
        effects: { attention: 2 },
        counterActionId: "set-boundary",
        counterSuccess: "你只确认自己亲眼见过的部分，来源链在你这里停住。"
      },
      {
        actor: "梁骁",
        title: "递来一份完整解释",
        telegraph: "他的版本能立刻填满所有空白，也会把没有证据的部分一起写死。",
        effects: { backlog: 1, attention: 1 },
        counterActionId: "method",
        counterSuccess: "你把事实、推测和空白分开，完整故事被拆回可核对的三行。"
      }
    ]
  },
  {
    id: "w3-rumor-chain",
    week: 3,
    label: "突发 · 传言成形",
    title: "第17题开始有了别人的版本",
    scene: "有人把空走廊、第三种笔迹和一次缺席连成了故事。你不知道谁先说，也不能同时澄清所有版本。",
    initialEffects: {},
    moves: [
      {
        actor: "前排同学",
        title: "把版本传向讲台",
        telegraph: "下一轮，缺席和错题本会被说成同一件事。找到来源比逐句反驳更有效。",
        effects: { attention: 2 },
        counterActionId: "network",
        counterSuccess: "梁骁指出两个版本来自同一句转述，传言的来源骤然缩成一个。"
      },
      {
        actor: "周棠",
        title: "把沉默理解成回避",
        telegraph: "她不会公开追问，但会停止提供自己的那部分信息。关系里的空白正在扩大。",
        effects: { strain: 2 },
        counterActionId: "coordinate",
        counterSuccess: "你先听完她担心的部分，再说明自己知道和不知道什么。"
      }
    ]
  },
  {
    id: "w4-doorway-choice",
    week: 4,
    label: "突发 · 门口十分钟",
    title: "周棠在考场门口等一句确定的话",
    scene: "提前进场的通知刚贴出来，周棠还在门口。你们只剩一次短对话：谈考试、谈之后，或承认现在没有能力同时谈完。",
    initialEffects: { strain: 1 },
    matches: ({ state, progress }) =>
      state.relationships.zhouPressure >= 4 || progress.facts.includes("challenge-set-boundary"),
    moves: [
      {
        actor: "周棠",
        title: "追问考后是否还见面",
        telegraph: "她要的不是保证，而是一个能执行的回答。继续拖延，会把考试压力变成关系压力。",
        effects: { strain: 2 },
        counterActionId: "coordinate",
        counterSuccess: "你们约定只确认考后第一步，没有把整个以后塞进十分钟。"
      },
      {
        actor: "监考老师",
        title: "提前关闭走廊",
        telegraph: "队伍已经开始移动。若不主动结束对话，你和周棠都会被留在视线中央。",
        effects: { attention: 2 },
        counterActionId: "set-boundary",
        counterSuccess: "你清楚地结束这次对话，队伍合拢前你们各自走进考场。"
      }
    ]
  },
  {
    id: "w4-early-entry",
    week: 4,
    label: "突发 · 提前进场",
    title: "考试铃比计划早了十分钟",
    scene: "监考临时要求提前进场。最后一次复盘、早餐和与周棠说话的时间被同时压缩。",
    initialEffects: {},
    moves: [
      {
        actor: "监考老师",
        title: "提前收走复习材料",
        telegraph: "下一轮就要封袋。临时多看一页只会制造新积压，现成方法才来得及落地。",
        effects: { backlog: 2 },
        counterActionId: "method",
        counterSuccess: "你只复述最容易失误的三个步骤，在封袋前停止添加新内容。"
      },
      {
        actor: "身体",
        title: "用困倦收回注意力",
        telegraph: "空腹和睡眠债会在进场后一起出现。继续硬顶，会把这部分代价带进试卷。",
        effects: { strain: 2 },
        counterActionId: "recover",
        counterSuccess: "你用最后几分钟进食、呼吸，进场时没有继续透支。"
      }
    ]
  }
] as const;

const DEFAULT_SCENARIO_IDS: Record<ChapterOneWeek, string> = {
  1: "w1-register-sweep",
  2: "w2-extra-papers",
  3: "w3-rumor-chain",
  4: "w4-early-entry"
};

function planCounts(state: ChapterOneState): Map<ChapterOneActivityId, number> {
  const plan = state.plans.find((candidate) => candidate.week === state.currentWeek);
  if (!plan) throw new Error(`Missing plan for week ${state.currentWeek}`);
  const counts = new Map<ChapterOneActivityId, number>();
  Object.values(plan.assignments).forEach((assignment) => {
    counts.set(assignment.activityId, (counts.get(assignment.activityId) ?? 0) + 1);
  });
  return counts;
}

function total(counts: Map<ChapterOneActivityId, number>, ids: ChapterOneActivityId[]): number {
  return ids.reduce((sum, id) => sum + (counts.get(id) ?? 0), 0);
}

function limitedCharges(value: number): number {
  return Math.max(0, Math.min(2, value));
}

function actionDefinition(id: WeekChallengeActionId): ChallengeActionDefinition {
  const definition = ACTIONS.find((action) => action.id === id);
  if (!definition) throw new Error(`Unknown challenge action: ${id}`);
  return definition;
}

function scenarioById(id: string): ChallengeScenario | undefined {
  return SCENARIOS.find((scenario) => scenario.id === id);
}

function defaultScenario(week: ChapterOneWeek): ChallengeScenario {
  const scenario = scenarioById(DEFAULT_SCENARIO_IDS[week]);
  if (!scenario) throw new Error(`Missing default challenge scenario for week ${week}`);
  return scenario;
}

function selectScenario(context: ChallengeScenarioContext): ChallengeScenario {
  return SCENARIOS.find((scenario) =>
    scenario.week === context.state.currentWeek && scenario.matches?.(context)
  ) ?? defaultScenario(context.state.currentWeek);
}

export function defaultWeekChallengeScenarioId(week: ChapterOneWeek): string {
  return DEFAULT_SCENARIO_IDS[week];
}

export function isWeekChallengeScenarioId(value: string, week?: ChapterOneWeek): boolean {
  return SCENARIOS.some((scenario) => scenario.id === value && (week === undefined || scenario.week === week));
}

export function createWeekChallenge(
  state: ChapterOneState,
  progress: LongTermProgress,
  stats: GameStats
): WeekChallengeState {
  const counts = planCounts(state);
  const study = total(counts, ["math-mastery", "math-speed", "english-review", "mutual-review", "promise-async"]);
  const recovery = total(counts, ["rest", "own-goal"]);
  const network = total(counts, ["help-liang", "observe-seat", "investigate-absence"]);
  const coordination = total(counts, ["mutual-review", "notebook-message", "walk", "promise-review", "promise-async"]);
  const scenario = selectScenario({ state, progress, stats, counts });
  const weekPressure = {
    backlog: state.currentWeek === 4 ? 2 : state.currentWeek === 2 ? 1 : 0,
    attention: state.currentWeek === 1 ? 2 : state.currentWeek === 3 ? 1 : 0,
    strain: state.currentWeek === 2 ? 2 : state.currentWeek === 3 || state.currentWeek === 4 ? 1 : 0
  };
  const baseTracks: WeekChallengeState["tracks"] = {
    backlog: clamp(Math.round(5 + weekPressure.backlog + progress.academic.falseMastery / 2 - Math.min(3, study)), 1, 8),
    attention: clamp(Math.round(3 + weekPressure.attention + stats.risk / 20 + state.relationships.guoSuspicion / 3 - Math.min(2, network)), 1, 8),
    strain: clamp(Math.round(3 + weekPressure.strain + stats.stress / 25 + state.relationships.zhouPressure / 2 - Math.min(2, recovery)), 1, 8)
  };
  return {
    week: state.currentWeek,
    scenarioId: scenario.id,
    turn: 0,
    maxTurns: 3,
    opponentStep: 0,
    tracks: applyTracks(baseTracks, scenario.initialEffects),
    charges: {
      method: limitedCharges(study),
      recover: limitedCharges(recovery),
      network: limitedCharges(network),
      coordinate: limitedCharges(coordination),
      "set-boundary": 1,
      "push-through": 3
    },
    actionIds: [],
    log: [],
    resolved: false,
    outcome: "pending"
  };
}

export function challengeCopy(state: ChapterOneState): WeekChallengeCopy {
  const selected = state.weekChallenge ? scenarioById(state.weekChallenge.scenarioId) : undefined;
  return selected ?? defaultScenario(state.currentWeek);
}

export function currentWeekChallengeOpponent(state: ChapterOneState): WeekChallengeOpponentPreview | null {
  const challenge = state.weekChallenge;
  if (!challenge || challenge.resolved) return null;
  const move = scenarioById(challenge.scenarioId)?.moves[challenge.opponentStep];
  if (!move) return null;
  return {
    ...move,
    effect: formatTrackEffects(move.effects),
    effects: { ...move.effects },
    counterLabel: actionDefinition(move.counterActionId).label
  };
}

function comboFor(previous: WeekChallengeActionId | undefined, current: WeekChallengeActionId): ChallengeCombo | undefined {
  return COMBOS.find((combo) => combo.previous === previous && combo.current === current);
}

export function challengeActions(state: ChapterOneState): WeekChallengeAction[] {
  const challenge = state.weekChallenge;
  if (!challenge) return [];
  const previous = challenge.actionIds.at(-1);
  return ACTIONS.map((action) => {
    const combo = comboFor(previous, action.id);
    return {
      id: action.id,
      label: action.label,
      description: action.description,
      hint: combo ? `${action.hint}；连携就绪：${combo.label}` : action.hint,
      available: challenge.charges[action.id]
    };
  });
}

function trackLabel(id: ChallengeTrackId): string {
  if (id === "backlog") return "任务积压";
  if (id === "attention") return "被注意";
  return "关系负荷";
}

function formatTrackEffects(effects: ChallengeTrackEffects): string {
  return Object.entries(effects)
    .map(([key, value]) => `${trackLabel(key as ChallengeTrackId)}${(value ?? 0) > 0 ? "+" : ""}${value}`)
    .join("，");
}

function applyTracks(
  tracks: WeekChallengeState["tracks"],
  effects: ChallengeTrackEffects
): WeekChallengeState["tracks"] {
  const next = { ...tracks };
  (Object.keys(effects) as ChallengeTrackId[]).forEach((key) => {
    next[key] = clamp(next[key] + (effects[key] ?? 0), 0, 9);
  });
  return next;
}

function resolveOutcome(tracks: WeekChallengeState["tracks"]): WeekChallengeState["outcome"] {
  const values = Object.values(tracks);
  const maximum = Math.max(...values);
  const sum = values.reduce((totalValue, value) => totalValue + value, 0);
  if (maximum <= 4 && sum <= 10) return "controlled";
  if (maximum <= 6 && sum <= 15) return "frayed";
  return "overloaded";
}

export function weekChallengeOutcomeText(outcome: WeekChallengeState["outcome"]): string {
  if (outcome === "pending") return "";
  if (outcome === "controlled") return "你没有清空所有问题，但三个压力都保持在还能解释和修复的范围内。";
  if (outcome === "frayed") return "这一周勉强接住了，仍有一条压力线会进入后续事件。";
  return "至少一条压力线越过了承受范围。接下来的互动会带着这次失控。";
}

function outcomeEffects(outcome: WeekChallengeState["outcome"]): StatEffects {
  if (outcome === "controlled") return { agency: 2, mutual: 1, stress: -1 };
  if (outcome === "frayed") return { stress: 1 };
  return { energy: -3, stress: 3, rebellion: 2 };
}

export interface PlayWeekChallengeResult {
  chapterOne: ChapterOneState;
  progress: LongTermProgress;
  stats: GameStats;
}

export function playWeekChallengeAction(
  state: ChapterOneState,
  progress: LongTermProgress,
  stats: GameStats,
  actionId: WeekChallengeActionId
): PlayWeekChallengeResult {
  const challenge = state.weekChallenge;
  if (state.phase !== "week-challenge" || !challenge || challenge.resolved) {
    throw new Error("当前没有可执行的周挑战。");
  }
  const definition = ACTIONS.find((action) => action.id === actionId);
  if (!definition || challenge.charges[actionId] <= 0) throw new Error("这项行动没有剩余次数。");
  const scenario = scenarioById(challenge.scenarioId);
  if (!scenario || scenario.week !== challenge.week) throw new Error("周挑战情境已经失效。");

  let tracks = applyTracks(challenge.tracks, definition.trackEffects);
  const turn = challenge.turn + 1;
  const log = [...challenge.log, `${definition.label}：${formatTrackEffects(definition.trackEffects)}`];
  const combo = comboFor(challenge.actionIds.at(-1), actionId);
  if (combo) {
    tracks = applyTracks(tracks, combo.effects);
    log.push(`连携「${combo.label}」：${combo.description}（${formatTrackEffects(combo.effects)}）`);
  }

  const opponentMove = scenario.moves[challenge.opponentStep];
  let opponentStep = challenge.opponentStep;
  let counterFact: string | null = null;
  if (opponentMove) {
    opponentStep += 1;
    if (opponentMove.counterActionId === actionId) {
      log.push(`克制成功 · ${opponentMove.actor}：${opponentMove.counterSuccess}`);
      counterFact = `challenge-counter:${scenario.id}:${challenge.opponentStep}`;
    } else {
      tracks = applyTracks(tracks, opponentMove.effects);
      log.push(`${opponentMove.actor}执行「${opponentMove.title}」：${formatTrackEffects(opponentMove.effects)}`);
    }
  }

  const resolved = turn >= challenge.maxTurns;
  const outcome = resolved ? resolveOutcome(tracks) : "pending";
  if (resolved) log.push(weekChallengeOutcomeText(outcome));

  const nextChallenge: WeekChallengeState = {
    ...challenge,
    turn,
    opponentStep,
    tracks,
    charges: { ...challenge.charges, [actionId]: challenge.charges[actionId] - 1 },
    actionIds: [...challenge.actionIds, actionId],
    log,
    resolved,
    outcome
  };
  const nextResults = state.results.map((result) =>
    result.week === state.currentWeek && resolved
      ? { ...result, changes: [...result.changes, weekChallengeOutcomeText(outcome)] }
      : { ...result, completed: [...result.completed], changes: [...result.changes], echoes: [...result.echoes], nextWeek: [...result.nextWeek] }
  );
  const nextProgress: LongTermProgress = {
    facts: [...new Set([
      ...progress.facts,
      definition.fact,
      ...(counterFact ? [counterFact] : []),
      ...(resolved ? [`week-challenge:${state.currentWeek}:${outcome}`] : [])
    ])],
    academic: {
      ...progress.academic,
      sleepDebt: clamp(progress.academic.sleepDebt + (resolved && outcome === "overloaded" ? 1 : 0))
    },
    tendencies: { ...progress.tendencies }
  };
  if (definition.tendencies) {
    (Object.keys(definition.tendencies) as Array<keyof LongTermProgress["tendencies"]>).forEach((key) => {
      nextProgress.tendencies[key] = clamp(nextProgress.tendencies[key] + (definition.tendencies?.[key] ?? 0));
    });
  }
  let nextStats = applyStatEffects(stats, definition.statEffects ?? {}, { deriveRebellion: false }).stats;
  if (resolved) nextStats = applyStatEffects(nextStats, outcomeEffects(outcome), { deriveRebellion: true }).stats;
  return {
    chapterOne: {
      ...state,
      results: nextResults,
      resolvedEventIds: [...new Set([
        ...state.resolvedEventIds,
        `week${state.currentWeek}-challenge-${turn}-${actionId}`
      ])],
      weekChallenge: nextChallenge
    },
    progress: nextProgress,
    stats: nextStats
  };
}

function nextPhase(week: ChapterOneState["currentWeek"]): ChapterOneState["phase"] {
  if (week === 1) return "seat-game";
  if (week === 3) return "sentence-game";
  if (week === 4) return "exam";
  return "review";
}

export function continueAfterWeekChallenge(state: ChapterOneState): ChapterOneState {
  if (state.phase !== "week-challenge" || !state.weekChallenge?.resolved) {
    throw new Error("周挑战还没有完成。");
  }
  return { ...state, phase: nextPhase(state.currentWeek) };
}

export function isWeekChallengeActionId(value: string): value is WeekChallengeActionId {
  return ACTIONS.some((action) => action.id === value);
}
