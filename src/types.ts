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

export type AnySaveData = SaveDataV1 | SaveDataV2 | SaveDataV3;

export interface StatChange {
  key: StatKey;
  delta: number;
}
