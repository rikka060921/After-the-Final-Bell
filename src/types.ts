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

export type GameStats = Record<StatKey, number>;
export type StatEffects = Partial<Record<StatKey, number>>;

export interface StatMeta {
  label: string;
  positive: boolean;
}

export interface StoryChoice {
  text: string;
  hint?: string;
  effects?: StatEffects;
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

export type AnySaveData = SaveDataV1 | SaveDataV2;

export interface StatChange {
  key: StatKey;
  delta: number;
}
