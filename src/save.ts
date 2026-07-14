import {
  GAME_VERSION,
  LEGACY_SAVE_KEY,
  SAVE_KEY,
  SAVE_VERSION,
  defaultSettings,
  initialStats
} from "./config";
import type {
  BackgroundKey,
  GameSettings,
  GameStats,
  HistoryEntry,
  SaveDataV2,
  StoryGraph
} from "./types";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaveSnapshot {
  playerName: string;
  stats: GameStats;
  currentNodeId: string;
  currentBackground: BackgroundKey;
  portraitVisible: boolean;
  sceneLabel: string;
  timeLabel: string;
  history: HistoryEntry[];
  settings: GameSettings;
}

const backgrounds = new Set<BackgroundKey>(["classroom", "corridor", "gate"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sanitizeStats(value: unknown): GameStats {
  const defaults = initialStats();
  if (!isRecord(value)) return defaults;
  return {
    study: asFiniteNumber(value.study, defaults.study),
    energy: asFiniteNumber(value.energy, defaults.energy),
    stress: asFiniteNumber(value.stress, defaults.stress),
    agency: asFiniteNumber(value.agency, defaults.agency),
    bond: asFiniteNumber(value.bond, defaults.bond),
    risk: asFiniteNumber(value.risk, defaults.risk),
    rebellion: asFiniteNumber(value.rebellion, defaults.rebellion),
    mutual: asFiniteNumber(value.mutual, defaults.mutual)
  };
}

function sanitizeSettings(value: unknown): GameSettings {
  const defaults = defaultSettings();
  if (!isRecord(value)) return defaults;
  return {
    speed: asFiniteNumber(value.speed, defaults.speed),
    fontSize: asFiniteNumber(value.fontSize, defaults.fontSize),
    reducedMotion:
      typeof value.reducedMotion === "boolean" ? value.reducedMotion : defaults.reducedMotion
  };
}

function sanitizeHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((entry) => ({
      node: asString(entry.node),
      speaker: asString(entry.speaker, "旁白"),
      text: asString(entry.text)
    }))
    .filter((entry) => entry.node && entry.text)
    .slice(-160);
}

export function createSaveData(snapshot: SaveSnapshot): SaveDataV2 {
  return {
    version: SAVE_VERSION,
    gameVersion: GAME_VERSION,
    ...snapshot,
    stats: { ...snapshot.stats },
    history: snapshot.history.map((entry) => ({ ...entry })),
    settings: { ...snapshot.settings },
    savedAt: new Date().toISOString()
  };
}

export function parseSaveData(raw: string, graph: StoryGraph): SaveDataV2 | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;

  const currentNodeId = asString(value.currentNodeId);
  if (!currentNodeId || !graph[currentNodeId]) return null;

  const background = asString(value.currentBackground, "classroom") as BackgroundKey;
  return {
    version: SAVE_VERSION,
    gameVersion: asString(value.gameVersion, "0.1.0-demo"),
    playerName: asString(value.playerName, "陈舟").trim().slice(0, 6) || "陈舟",
    stats: sanitizeStats(value.stats),
    currentNodeId,
    currentBackground: backgrounds.has(background) ? background : "classroom",
    portraitVisible: Boolean(value.portraitVisible),
    sceneLabel: asString(value.sceneLabel),
    timeLabel: asString(value.timeLabel),
    history: sanitizeHistory(value.history),
    settings: sanitizeSettings(value.settings),
    savedAt: asString(value.savedAt, new Date(0).toISOString())
  };
}

export function readStoredSave(storage: StorageLike, graph: StoryGraph): SaveDataV2 | null {
  for (const key of [SAVE_KEY, LEGACY_SAVE_KEY]) {
    const raw = storage.getItem(key);
    if (!raw) continue;
    const save = parseSaveData(raw, graph);
    if (!save) {
      storage.removeItem(key);
      continue;
    }
    if (key === LEGACY_SAVE_KEY) writeStoredSave(storage, save);
    return save;
  }
  return null;
}

export function writeStoredSave(storage: StorageLike, save: SaveDataV2): void {
  storage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function hasStoredSave(storage: StorageLike, graph: StoryGraph): boolean {
  return readStoredSave(storage, graph) !== null;
}
