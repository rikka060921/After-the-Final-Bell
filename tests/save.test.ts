import { describe, expect, it } from "vitest";

import {
  FOUNDATION_SAVE_KEY,
  LEGACY_SAVE_KEY,
  PREVIOUS_SAVE_KEY,
  SAVE_KEY,
  defaultNotebookState,
  initialStats
} from "../src/config";
import { createOpeningProfile } from "../src/opening-profile";
import { initializeChapterOne } from "../src/chapter-one/opening";
import {
  createSaveData,
  parseSaveData,
  readManualSave,
  readStoredSave,
  writeManualSave,
  type StorageLike
} from "../src/save";
import { story } from "../src/story";
import type { PromiseEntry } from "../src/types";

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function plannerFixture(withPromise = false) {
  const promises: PromiseEntry[] = withPromise
    ? [{
        id: "two-independent-goals",
        title: "各自保留两个目标",
        summary: "每周复盘一次",
        cadence: "weekly",
        pressure: "low",
        status: "active",
        createdAtNode: "choice_pact"
      }]
    : [];
  const profile = createOpeningProfile({
    playerName: "陈舟",
    mode: "story",
    endingId: "alliance",
    stats: initialStats(),
    notebook: defaultNotebookState(),
    promises,
    decisionIds: [],
    createdAt: "2026-07-15T00:00:00.000Z"
  });
  const initialized = initializeChapterOne(profile);
  const save = createSaveData({
    playerName: "陈舟",
    stats: initialStats(),
    currentNodeId: null,
    currentBackground: "classroom",
    portraitVisible: false,
    sceneLabel: "第一章",
    timeLabel: "第一周",
    history: [],
    settings: { speed: 22, fontSize: 20, reducedMotion: false, skipRead: false },
    mode: "story",
    notebook: defaultNotebookState(),
    promises,
    decisionIds: [],
    openingProfile: profile,
    location: { kind: "chapter-one-planner", week: 1 },
    chapterOne: initialized.chapterOne,
    progress: initialized.progress
  });
  return { profile, save };
}

describe("save migration", () => {
  it("loads and migrates the legacy demo save", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      LEGACY_SAVE_KEY,
      JSON.stringify({
        version: 1,
        playerName: "陈舟",
        stats: { ...initialStats(), bond: 19 },
        currentNodeId: "intro_02",
        currentBackground: "classroom",
        portraitVisible: false,
        sceneLabel: "高三（7）班",
        timeLabel: "周四 · 21:37",
        history: [],
        settings: { speed: 42, fontSize: 20, reducedMotion: true },
        savedAt: "2026-07-15T00:00:00.000Z"
      })
    );

    const save = readStoredSave(storage, story);
    expect(save?.version).toBe(4);
    expect(save?.stats.bond).toBe(19);
    expect(save?.currentNodeId).toBe("intro_02");
    expect(save?.mode).toBe("story");
    expect(save?.notebook.slots).toHaveLength(6);
    expect(save?.promises).toEqual([]);
    expect(save?.readNodeIds).toContain("intro_02");
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
  });

  it("rejects and removes a save that points to an unknown story node", () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ currentNodeId: "missing-node" }));

    expect(readStoredSave(storage, story)).toBeNull();
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });

  it("migrates the engineering-foundation v2 key to v4 defaults", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      FOUNDATION_SAVE_KEY,
      JSON.stringify({
        version: 2,
        gameVersion: "0.2.0",
        playerName: "陈舟",
        stats: initialStats(),
        currentNodeId: "choice_note",
        currentBackground: "classroom",
        portraitVisible: false,
        sceneLabel: "高三（7）班",
        timeLabel: "周四 · 21:37",
        history: [],
        settings: { speed: 22, fontSize: 20, reducedMotion: false },
        savedAt: "2026-07-15T00:00:00.000Z"
      })
    );

    const save = readStoredSave(storage, story);
    expect(save?.version).toBe(4);
    expect(save?.mode).toBe("story");
    expect(save?.notebook.committed).toBe(false);
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
  });

  it("migrates the formal-prologue v3 key without dropping the profile", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      PREVIOUS_SAVE_KEY,
      JSON.stringify({
        version: 3,
        gameVersion: "0.3.0",
        playerName: "陈舟",
        stats: initialStats(),
        currentNodeId: "resolve_ending",
        currentBackground: "gate",
        portraitVisible: false,
        sceneLabel: "学校东门外",
        timeLabel: "周四 · 21:58",
        history: [],
        settings: { speed: 22, fontSize: 20, reducedMotion: false },
        mode: "story",
        notebook: defaultNotebookState(),
        promises: [],
        decisionIds: [],
        openingProfile: null,
        savedAt: "2026-07-15T00:00:00.000Z"
      })
    );
    const save = readStoredSave(storage, story);
    expect(save?.version).toBe(4);
    expect(save?.location).toEqual({ kind: "story", graphId: "prologue", nodeId: "resolve_ending" });
  });

  it("round-trips a planner location without requiring a story node", () => {
    const profile = createOpeningProfile({
      playerName: "陈舟",
      mode: "story",
      endingId: "alliance",
      stats: initialStats(),
      notebook: defaultNotebookState(),
      promises: [],
      decisionIds: [],
      createdAt: "2026-07-15T00:00:00.000Z"
    });
    const initialized = initializeChapterOne(profile);
    const save = createSaveData({
      playerName: "陈舟",
      stats: initialStats(),
      currentNodeId: null,
      currentBackground: "classroom",
      portraitVisible: false,
      sceneLabel: "第一章",
      timeLabel: "第一周",
      history: [],
      settings: { speed: 22, fontSize: 20, reducedMotion: false, skipRead: false },
      mode: "story",
      notebook: defaultNotebookState(),
      promises: [],
      decisionIds: [],
      openingProfile: profile,
      location: { kind: "chapter-one-planner", week: 1 },
      chapterOne: initialized.chapterOne,
      progress: initialized.progress
    });
    const parsed = parseSaveData(JSON.stringify(save), story);
    expect(parsed?.currentNodeId).toBeNull();
    expect(parsed?.location).toEqual({ kind: "chapter-one-planner", week: 1 });
    expect(parsed?.chapterOne?.plans[0]?.assignments).toBeDefined();
  });

  it("rejects a chapter location when its opening profile is missing", () => {
    const { save } = plannerFixture();
    const corrupted = JSON.parse(JSON.stringify(save));
    corrupted.openingProfile = null;
    expect(parseSaveData(JSON.stringify(corrupted), story)).toBeNull();
  });

  it("rejects an unresolved exam save after the fourth action instead of soft-locking", () => {
    const { save } = plannerFixture();
    const corrupted = JSON.parse(JSON.stringify(save));
    const state = corrupted.chapterOne;
    state.currentWeek = 4;
    state.phase = "exam";
    state.plans.forEach((plan: { committed: boolean; resolved: boolean }) => {
      plan.committed = true;
      plan.resolved = true;
    });
    state.results = [1, 2, 3, 4].map((week) => ({
      week,
      title: `第${week}周`,
      completed: [],
      changes: [],
      echoes: [],
      nextWeek: [],
      zhouAction: ""
    }));
    state.seatGame = {
      turn: 1,
      carrierSeatId: "r6c2",
      attention: 0,
      log: [],
      resolved: true,
      outcome: "returned"
    };
    state.sentence = {
      fragmentIds: ["open-ask", "close-note"],
      text: "我想问能说的部分。",
      actionTypes: ["ask", "boundary"],
      pageAction: "intact"
    };
    state.exam = {
      step: 4,
      actionIds: ["scan-first", "skip-mark", "recall-routine", "check-errors"],
      resolved: false,
      band: null,
      effectiveScore: null,
      note: ""
    };
    corrupted.location = { kind: "chapter-one-exam" };
    const parsed = parseSaveData(JSON.stringify(corrupted), story);
    expect(parsed?.chapterOne).toBeNull();
    expect(parsed?.location).toEqual({ kind: "opening-profile" });
  });

  it("repairs unknown planner activities to an open slot", () => {
    const { save } = plannerFixture();
    const corrupted = JSON.parse(JSON.stringify(save));
    const assignments = corrupted.chapterOne.plans[0].assignments;
    const slotId = Object.keys(assignments)[0]!;
    assignments[slotId].activityId = "not-a-real-activity";
    const parsed = parseSaveData(JSON.stringify(corrupted), story);
    expect(parsed?.chapterOne?.plans[0]?.assignments[slotId]?.activityId).toBe("open");
  });

  it("restores the lock and activity for a linked promise obligation", () => {
    const { save } = plannerFixture(true);
    const corrupted = JSON.parse(JSON.stringify(save));
    const assignments = corrupted.chapterOne.plans[0].assignments;
    const linked = Object.values(assignments).find(
      (assignment) => (assignment as { obligationId?: string }).obligationId
    ) as { locked: boolean; source: string; activityId: string; obligationId: string };
    linked.locked = false;
    linked.source = "player";
    linked.activityId = "rest";

    const parsed = parseSaveData(JSON.stringify(corrupted), story);
    const repaired = Object.values(parsed!.chapterOne!.plans[0]!.assignments).find(
      (assignment) => assignment.obligationId === linked.obligationId
    );
    expect(repaired).toMatchObject({
      locked: true,
      source: "promise",
      activityId: "promise-review"
    });
  });

  it("keeps manual save slots independent from the automatic save", () => {
    const storage = new MemoryStorage();
    const { save } = plannerFixture();
    writeManualSave(storage, save, "slot-2");
    expect(readManualSave(storage, story, "slot-2")?.location).toEqual(save.location);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    storage.setItem("after-evening-study-manual-save-3", "not json");
    expect(readManualSave(storage, story, "slot-3")).toBeNull();
    expect(storage.getItem("after-evening-study-manual-save-3")).toBeNull();
  });

  it("preserves the replay setting through v4 parsing", () => {
    const { save } = plannerFixture();
    const raw = JSON.parse(JSON.stringify(save));
    raw.settings.skipRead = true;
    const parsed = parseSaveData(JSON.stringify(raw), story);
    expect(parsed?.settings.skipRead).toBe(true);
  });
});
