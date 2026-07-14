import { describe, expect, it } from "vitest";

import { LEGACY_SAVE_KEY, PREVIOUS_SAVE_KEY, SAVE_KEY, initialStats } from "../src/config";
import { readStoredSave, type StorageLike } from "../src/save";
import { story } from "../src/story";

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
    expect(save?.version).toBe(3);
    expect(save?.stats.bond).toBe(19);
    expect(save?.currentNodeId).toBe("intro_02");
    expect(save?.mode).toBe("story");
    expect(save?.notebook.slots).toHaveLength(6);
    expect(save?.promises).toEqual([]);
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
  });

  it("rejects and removes a save that points to an unknown story node", () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ currentNodeId: "missing-node" }));

    expect(readStoredSave(storage, story)).toBeNull();
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });

  it("migrates the engineering-foundation v2 key to v3 defaults", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      PREVIOUS_SAVE_KEY,
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
    expect(save?.version).toBe(3);
    expect(save?.mode).toBe("story");
    expect(save?.notebook.committed).toBe(false);
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
  });
});
