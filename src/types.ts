export const STAT_KEYS = [
  "study",
  "energy",
  "stress",
  "agency",
  "bond",
  "risk",
  "rebellion",
  "mutual"
] as const;

export const VISIBLE_STAT_KEYS = [
  "study",
  "energy",
  "stress",
  "agency",
  "bond",
  "risk",
  "rebellion"
] as const;

export type StatKey = (typeof STAT_KEYS)[number];
export type VisibleStatKey = (typeof VISIBLE_STAT_KEYS)[number];
export type BackgroundKey = "classroom" | "corridor" | "gate";
export type GameMode = "story" | "county";
export type NotebookSlot = "solution" | "message" | "blank";
export type ChapterOneWeek = 1 | 2 | 3 | 4;
export type ChapterOnePeriod = "break" | "evening";
export type ChapterOnePhase =
  | "planning"
  | "week-events"
  | "week-challenge"
  | "seat-game"
  | "sentence-game"
  | "review"
  | "exam"
  | "complete";
export type ChapterOneActivityId =
  | "open"
  | "math-mastery"
  | "math-speed"
  | "english-review"
  | "mutual-review"
  | "rest"
  | "own-goal"
  | "help-liang"
  | "observe-seat"
  | "investigate-absence"
  | "notebook-message"
  | "walk"
  | "promise-review"
  | "promise-contact"
  | "promise-async";
export type AssignmentSource = "player" | "promise" | "zhou-tang";
export type AssignmentStatus = "planned" | "done" | "missed" | "rescheduled";
export type WeekChallengeActionId =
  | "method"
  | "recover"
  | "network"
  | "coordinate"
  | "set-boundary"
  | "push-through";
export type ChapterTwoPhase = "result-letter" | "async-message" | "bus-route" | "complete";
export type ResultFramingId = "full-context" | "progress-first" | "pressure-first";
export type AsyncMessageId = "ask-plan" | "leave-space" | "promise-solve";
export type BusActionId = "buy-breakfast" | "wait" | "walk" | "express";

export type GameStats = Record<StatKey, number>;
export type StatEffects = Partial<Record<StatKey, number>>;

export interface StatMeta {
  label: string;
  positive: boolean;
}

export interface StoryChoice {
  id?: string;
  text: string;
  hint?: string;
  effects?: StatEffects;
  promise?: PromiseDraft;
  next: string;
}

export interface StoryNode {
  step: string;
  speaker?: string;
  scene?: string;
  time?: string;
  text: string;
  bg?: BackgroundKey;
  portrait?: boolean;
  portraitClass?: string;
  overlay?: "notebook";
  choices?: StoryChoice[];
  next?: string;
  end?: boolean;
}

export type StoryGraph = Record<string, StoryNode>;

export interface Ending {
  title: string;
  quote: string;
  body: string;
}

export type EndingId = "alliance" | "stolen" | "correct" | "overload" | "blank";

export interface HistoryEntry {
  node: string;
  speaker: string;
  text: string;
}

export interface GameSettings {
  speed: number;
  fontSize: number;
  reducedMotion: boolean;
  skipRead: boolean;
}

export interface NotebookState {
  slots: NotebookSlot[];
  committed: boolean;
}

export interface PromiseDraft {
  id: string;
  title: string;
  summary: string;
  cadence: string;
  pressure: "low" | "medium" | "high";
  status: "active" | "withheld";
}

export interface PromiseEntry extends PromiseDraft {
  createdAtNode: string;
}

export interface OpeningProfile {
  createdAt: string;
  playerName: string;
  mode: GameMode;
  endingId: EndingId;
  stats: GameStats;
  notebook: NotebookState;
  promises: PromiseEntry[];
  decisionIds: string[];
  summary: string[];
}

export interface BehaviorTendencies {
  listening: number;
  explanation: number;
  responsibility: number;
  avoidance: number;
  control: number;
  defiance: number;
}

export interface AcademicState {
  mastery: number;
  speed: number;
  stability: number;
  falseMastery: number;
  sleepDebt: number;
}

export interface LongTermProgress {
  facts: string[];
  tendencies: BehaviorTendencies;
  academic: AcademicState;
}

export type GameLocation =
  | { kind: "story"; graphId: "prologue"; nodeId: string }
  | { kind: "opening-profile" }
  | { kind: "chapter-one-planner"; week: ChapterOneWeek }
  | { kind: "chapter-one-events"; week: ChapterOneWeek }
  | { kind: "chapter-one-challenge"; week: ChapterOneWeek }
  | { kind: "chapter-one-seat" }
  | { kind: "chapter-one-sentence" }
  | { kind: "chapter-one-review"; week: ChapterOneWeek }
  | { kind: "chapter-one-exam" }
  | { kind: "chapter-one-complete" }
  | { kind: "chapter-two-result" }
  | { kind: "chapter-two-message" }
  | { kind: "chapter-two-bus" }
  | { kind: "chapter-two-complete" };

export interface ChapterOneSlot {
  id: string;
  week: ChapterOneWeek;
  dayIndex: number;
  dayLabel: string;
  period: ChapterOnePeriod;
  periodLabel: string;
}

export interface ScheduledAssignment {
  slotId: string;
  activityId: ChapterOneActivityId;
  source: AssignmentSource;
  locked: boolean;
  status: AssignmentStatus;
  obligationId?: string;
}

export interface ChapterOneWeekPlan {
  week: ChapterOneWeek;
  assignments: Record<string, ScheduledAssignment>;
  committed: boolean;
  resolved: boolean;
}

export interface CalendarObligation {
  id: string;
  promiseId: string;
  week: ChapterOneWeek;
  slotId: string;
  activityId: ChapterOneActivityId;
  label: string;
  status: "due" | "fulfilled" | "missed" | "renegotiated";
}

export interface ChapterOneRelationships {
  liangFavor: number;
  guoSuspicion: number;
  zhouPressure: number;
  seatIntel: number;
}

export interface ChapterOneWeekResult {
  week: ChapterOneWeek;
  title: string;
  completed: string[];
  changes: string[];
  echoes: string[];
  nextWeek: string[];
  zhouAction: string;
}

export interface WeekExecutionState {
  week: ChapterOneWeek;
  eventIds: string[];
  cursor: number;
  choiceIds: string[];
  log: string[];
}

export interface WeekChallengeState {
  week: ChapterOneWeek;
  scenarioId: string;
  turn: number;
  maxTurns: number;
  opponentStep: number;
  tracks: {
    backlog: number;
    attention: number;
    strain: number;
  };
  charges: Record<WeekChallengeActionId, number>;
  actionIds: WeekChallengeActionId[];
  log: string[];
  resolved: boolean;
  outcome: "pending" | "controlled" | "frayed" | "overloaded";
}

export type SeatActionId = "wait" | "pass-liang" | "pass-zhou" | "hide" | "take-back";

export interface SeatGameState {
  turn: number;
  carrierSeatId: string;
  attention: number;
  log: string[];
  resolved: boolean;
  outcome: "pending" | "delivered" | "noticed" | "returned";
}

export interface SentenceAssemblyRecord {
  fragmentIds: string[];
  text: string;
  actionTypes: string[];
  pageAction: "intact" | "torn" | "returned";
}

export interface MockExamState {
  step: number;
  actionIds: string[];
  resolved: boolean;
  band: "突破" | "稳定" | "波动" | "失常" | null;
  effectiveScore: number | null;
  note: string;
}

export interface ChapterOneState {
  schemaVersion: 1;
  currentWeek: ChapterOneWeek;
  phase: ChapterOnePhase;
  plans: ChapterOneWeekPlan[];
  obligations: CalendarObligation[];
  results: ChapterOneWeekResult[];
  weekExecution: WeekExecutionState | null;
  weekChallenge: WeekChallengeState | null;
  relationships: ChapterOneRelationships;
  resolvedEventIds: string[];
  seatGame: SeatGameState;
  sentence: SentenceAssemblyRecord | null;
  exam: MockExamState;
}

export interface ChapterTwoState {
  schemaVersion: 1;
  phase: ChapterTwoPhase;
  resultBand: NonNullable<MockExamState["band"]>;
  effectiveScore: number;
  framing: ResultFramingId | null;
  message: { id: AsyncMessageId; wordCount: number; text: string } | null;
  familyTrust: number;
  familyPressure: number;
  zhouDistance: number;
  bus: {
    stopIndex: number;
    minutes: number;
    breakfast: boolean;
    delay: number;
    resolved: boolean;
    outcome: "pending" | "met" | "missed" | "late";
    log: string[];
  };
  resolvedEventIds: string[];
}

export interface SaveDataV1 {
  version: 1;
  playerName: string;
  stats: Partial<GameStats>;
  currentNodeId: string;
  currentBackground: BackgroundKey;
  portraitVisible: boolean;
  sceneLabel: string;
  timeLabel: string;
  history: HistoryEntry[];
  settings: Partial<GameSettings>;
  savedAt: string;
}

export interface SaveDataV2 extends Omit<SaveDataV1, "version"> {
  version: 2;
  gameVersion: string;
}

export interface SaveDataV3 extends Omit<SaveDataV2, "version"> {
  version: 3;
  mode: GameMode;
  notebook: NotebookState;
  promises: PromiseEntry[];
  decisionIds: string[];
  openingProfile: OpeningProfile | null;
}

export interface SaveDataV4 extends Omit<SaveDataV3, "version" | "currentNodeId"> {
  version: 4;
  currentNodeId: string | null;
  readNodeIds: string[];
  location: GameLocation;
  chapterOne: ChapterOneState | null;
  chapterTwo: ChapterTwoState | null;
  progress: LongTermProgress;
}

export type AnySaveData = SaveDataV1 | SaveDataV2 | SaveDataV3 | SaveDataV4;

export interface StatChange {
  key: StatKey;
  delta: number;
}
