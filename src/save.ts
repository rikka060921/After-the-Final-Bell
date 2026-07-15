import {
  FOUNDATION_SAVE_KEY,
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
import {
  defaultLongTermProgress,
  sanitizeChapterOneState,
  sanitizeLongTermProgress
} from "./chapter-one/persistence";
import { cloneChapterOneState } from "./chapter-one/schedule";
import type {
  BackgroundKey,
  ChapterOneState,
  EndingId,
  GameLocation,
  GameMode,
  GameSettings,
  GameStats,
  HistoryEntry,
  LongTermProgress,
  NotebookSlot,
  NotebookState,
  OpeningProfile,
  PromiseEntry,
  SaveDataV4,
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
  currentNodeId: string | null;
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
  location: GameLocation;
  chapterOne: ChapterOneState | null;
  progress: LongTermProgress;
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

function cloneOpeningProfile(profile: OpeningProfile | null): OpeningProfile | null {
  if (!profile) return null;
  return {
    ...profile,
    stats: { ...profile.stats },
    notebook: { slots: [...profile.notebook.slots], committed: profile.notebook.committed },
    promises: profile.promises.map((promise) => ({ ...promise })),
    decisionIds: [...profile.decisionIds],
    summary: [...profile.summary]
  };
}

function sanitizeLocation(
  value: unknown,
  graph: StoryGraph,
  currentNodeId: string | null,
  openingProfile: OpeningProfile | null,
  chapterOne: ChapterOneState | null
): GameLocation | null {
  const chapterLocation = (): GameLocation => {
    if (!chapterOne) throw new Error("Chapter-one state is required");
    if (chapterOne.phase === "planning") {
      return { kind: "chapter-one-planner", week: chapterOne.currentWeek };
    }
    if (chapterOne.phase === "seat-game") return { kind: "chapter-one-seat" };
    if (chapterOne.phase === "sentence-game") return { kind: "chapter-one-sentence" };
    if (chapterOne.phase === "review") {
      return { kind: "chapter-one-review", week: chapterOne.currentWeek };
    }
    if (chapterOne.phase === "exam") return { kind: "chapter-one-exam" };
    return { kind: "chapter-one-complete" };
  };
  if (isRecord(value)) {
    const kind = asString(value.kind);
    if (kind === "story") {
      const nodeId = asString(value.nodeId);
      if (asString(value.graphId) === "prologue" && graph[nodeId]) {
        return { kind: "story", graphId: "prologue", nodeId };
      }
    }
    if (kind === "opening-profile" && openingProfile) return { kind: "opening-profile" };
    if (chapterOne && openingProfile && kind.startsWith("chapter-one-")) {
      return chapterLocation();
    }
  }
  if (currentNodeId && graph[currentNodeId]) {
    return { kind: "story", graphId: "prologue", nodeId: currentNodeId };
  }
  if (openingProfile) return { kind: "opening-profile" };
  return null;
}

export function createSaveData(snapshot: SaveSnapshot): SaveDataV4 {
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
    openingProfile: cloneOpeningProfile(snapshot.openingProfile),
    location: { ...snapshot.location },
    chapterOne: snapshot.chapterOne ? cloneChapterOneState(snapshot.chapterOne) : null,
    progress: {
      facts: [...snapshot.progress.facts],
      tendencies: { ...snapshot.progress.tendencies },
      academic: { ...snapshot.progress.academic }
    },
    savedAt: new Date().toISOString()
  };
}

export function parseSaveData(raw: string, graph: StoryGraph): SaveDataV4 | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;

  const rawNodeId = asString(value.currentNodeId);
  const currentNodeId = rawNodeId && graph[rawNodeId] ? rawNodeId : null;
  const openingProfile = sanitizeOpeningProfile(value.openingProfile);
  const chapterOne = sanitizeChapterOneState(value.chapterOne);
  const location = sanitizeLocation(value.location, graph, currentNodeId, openingProfile, chapterOne);
  if (!location) return null;

  const background = asString(value.currentBackground, "classroom") as BackgroundKey;
  return {
    version: SAVE_VERSION,
    gameVersion: GAME_VERSION,
    playerName: asString(value.playerName, "陈舟").trim().slice(0, 6) || "陈舟",
    stats: sanitizeStats(value.stats),
    currentNodeId: location.kind === "story" ? location.nodeId : currentNodeId,
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
    openingProfile,
    location,
    chapterOne,
    progress: sanitizeLongTermProgress(value.progress ?? defaultLongTermProgress()),
    savedAt: asString(value.savedAt, new Date(0).toISOString())
  };
}

export function readStoredSave(storage: StorageLike, graph: StoryGraph): SaveDataV4 | null {
  for (const key of [SAVE_KEY, PREVIOUS_SAVE_KEY, FOUNDATION_SAVE_KEY, LEGACY_SAVE_KEY]) {
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

export function writeStoredSave(storage: StorageLike, save: SaveDataV4): void {
  storage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function hasStoredSave(storage: StorageLike, graph: StoryGraph): boolean {
  return readStoredSave(storage, graph) !== null;
}
