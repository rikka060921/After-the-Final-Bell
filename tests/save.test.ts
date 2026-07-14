import { describe, expect, it } from "vitest";

import { LEGACY_SAVE_KEY, SAVE_KEY, initialStats } from "../src/config";
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
    expect(save?.version).toBe(2);
    expect(save?.stats.bond).toBe(19);
    expect(save?.currentNodeId).toBe("intro_02");
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
  });

  it("rejects and removes a save that points to an unknown story node", () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ currentNodeId: "missing-node" }));

    expect(readStoredSave(storage, story)).toBeNull();
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });
});
