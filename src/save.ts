import {
  GAME_VERSION,
  LEGACY_SAVE_KEY,
  PREVIOUS_SAVE_KEY,
  SAVE_KEY,
  SAVE_VERSION,
  defaultMode,
  defaultNotebookState,
  defaultSettings,
  initialStats
} from "./config";
import type {
  BackgroundKey,
  EndingId,
  GameMode,
  GameSettings,
  GameStats,
  HistoryEntry,
  NotebookSlot,
  NotebookState,
  OpeningProfile,
  PromiseEntry,
  SaveDataV3,
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
  mode: GameMode;
  notebook: NotebookState;
  promises: PromiseEntry[];
  decisionIds: string[];
  openingProfile: OpeningProfile | null;
}

const backgrounds = new Set<BackgroundKey>(["classroom", "corridor", "gate"]);
const modes = new Set<GameMode>(["story", "county"]);
const notebookSlots = new Set<NotebookSlot>(["solution", "message", "blank"]);
const endingIds = new Set<EndingId>(["alliance", "stolen", "correct", "overload", "blank"]);

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

function sanitizeMode(value: unknown): GameMode {
  const mode = asString(value) as GameMode;
  return modes.has(mode) ? mode : defaultMode();
}

function sanitizeNotebook(value: unknown): NotebookState {
  const defaults = defaultNotebookState();
  if (!isRecord(value) || !Array.isArray(value.slots)) return defaults;
  const slots = value.slots.filter(
    (slot): slot is NotebookSlot => typeof slot === "string" && notebookSlots.has(slot as NotebookSlot)
  );
  if (slots.length !== defaults.slots.length) return defaults;
  return { slots, committed: Boolean(value.committed) };
}

function sanitizePromises(value: unknown): PromiseEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((promise): PromiseEntry | null => {
      const id = asString(promise.id);
      const title = asString(promise.title);
      if (!id || !title) return null;
      const pressure = asString(promise.pressure) as PromiseEntry["pressure"];
      const status = asString(promise.status) as PromiseEntry["status"];
      return {
        id,
        title,
        summary: asString(promise.summary),
        cadence: asString(promise.cadence),
        pressure: ["low", "medium", "high"].includes(pressure) ? pressure : "medium",
        status: status === "withheld" ? "withheld" : "active",
        createdAtNode: asString(promise.createdAtNode, "choice_pact")
      };
    })
    .filter((promise): promise is PromiseEntry => promise !== null);
}

function sanitizeDecisionIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))].slice(-100);
}

function sanitizeOpeningProfile(value: unknown): OpeningProfile | null {
  if (!isRecord(value)) return null;
  const endingId = asString(value.endingId) as EndingId;
  if (!endingIds.has(endingId)) return null;
  return {
    createdAt: asString(value.createdAt, new Date(0).toISOString()),
    playerName: asString(value.playerName, "陈舟"),
    mode: sanitizeMode(value.mode),
    endingId,
    stats: sanitizeStats(value.stats),
    notebook: sanitizeNotebook(value.notebook),
    promises: sanitizePromises(value.promises),
    decisionIds: sanitizeDecisionIds(value.decisionIds),
    summary: Array.isArray(value.summary)
      ? value.summary.filter((item): item is string => typeof item === "string").slice(0, 8)
      : []
  };
}

export function createSaveData(snapshot: SaveSnapshot): SaveDataV3 {
  return {
    version: SAVE_VERSION,
    gameVersion: GAME_VERSION,
    ...snapshot,
    stats: { ...snapshot.stats },
    history: snapshot.history.map((entry) => ({ ...entry })),
    settings: { ...snapshot.settings },
    notebook: { slots: [...snapshot.notebook.slots], committed: snapshot.notebook.committed },
    promises: snapshot.promises.map((promise) => ({ ...promise })),
    decisionIds: [...snapshot.decisionIds],
    openingProfile: snapshot.openingProfile
      ? {
          ...snapshot.openingProfile,
          stats: { ...snapshot.openingProfile.stats },
          notebook: {
            slots: [...snapshot.openingProfile.notebook.slots],
            committed: snapshot.openingProfile.notebook.committed
          },
          promises: snapshot.openingProfile.promises.map((promise) => ({ ...promise })),
          decisionIds: [...snapshot.openingProfile.decisionIds],
          summary: [...snapshot.openingProfile.summary]
        }
      : null,
    savedAt: new Date().toISOString()
  };
}

export function parseSaveData(raw: string, graph: StoryGraph): SaveDataV3 | null {
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
    gameVersion: GAME_VERSION,
    playerName: asString(value.playerName, "陈舟").trim().slice(0, 6) || "陈舟",
    stats: sanitizeStats(value.stats),
    currentNodeId,
    currentBackground: backgrounds.has(background) ? background : "classroom",
    portraitVisible: Boolean(value.portraitVisible),
    sceneLabel: asString(value.sceneLabel),
    timeLabel: asString(value.timeLabel),
    history: sanitizeHistory(value.history),
    settings: sanitizeSettings(value.settings),
    mode: sanitizeMode(value.mode),
    notebook: sanitizeNotebook(value.notebook),
    promises: sanitizePromises(value.promises),
    decisionIds: sanitizeDecisionIds(value.decisionIds),
    openingProfile: sanitizeOpeningProfile(value.openingProfile),
    savedAt: asString(value.savedAt, new Date(0).toISOString())
  };
}

export function readStoredSave(storage: StorageLike, graph: StoryGraph): SaveDataV3 | null {
  for (const key of [SAVE_KEY, PREVIOUS_SAVE_KEY, LEGACY_SAVE_KEY]) {
    const raw = storage.getItem(key);
    if (!raw) continue;
    const save = parseSaveData(raw, graph);
    if (!save) {
      storage.removeItem(key);
      continue;
    }
    if (key !== SAVE_KEY) writeStoredSave(storage, save);
    return save;
  }
  return null;
}

export function writeStoredSave(storage: StorageLike, save: SaveDataV3): void {
  storage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function hasStoredSave(storage: StorageLike, graph: StoryGraph): boolean {
  return readStoredSave(storage, graph) !== null;
}
