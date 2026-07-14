import type {
  BackgroundKey,
  GameSettings,
  GameStats,
  StatMeta,
  VisibleStatKey
} from "./types";

export const GAME_VERSION = "0.2.0";
export const SAVE_VERSION = 2 as const;
export const SAVE_KEY = "after-evening-study-save-v2";
export const LEGACY_SAVE_KEY = "after-evening-study-demo-save-v1";

export const backgrounds: Record<BackgroundKey, string> = {
  classroom: new URL("../assets/images/classroom-dusk.png", import.meta.url).href,
  corridor: new URL("../assets/images/corridor-night.png", import.meta.url).href,
  gate: new URL("../assets/images/school-gate-night.png", import.meta.url).href
};

export const initialStats = (): GameStats => ({
  study: 52,
  energy: 48,
  stress: 58,
  agency: 44,
  bond: 8,
  risk: 4,
  rebellion: 16,
  mutual: 0
});

export const defaultSettings = (): GameSettings => ({
  speed: 22,
  fontSize: 20,
  reducedMotion: false
});

export const statMeta: Record<VisibleStatKey, StatMeta> = {
  study: { label: "学业", positive: true },
  energy: { label: "精力", positive: true },
  stress: { label: "压力", positive: false },
  agency: { label: "自主", positive: true },
  bond: { label: "亲密", positive: true },
  risk: { label: "风险", positive: false },
  rebellion: { label: "逆反", positive: false }
};
