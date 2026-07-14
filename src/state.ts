import { STAT_KEYS, type GameStats, type StatChange, type StatEffects, type StatKey } from "./types";

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function clampStat(key: StatKey, value: number): number {
  return key === "mutual" ? clamp(value, -30, 100) : clamp(value);
}

export function applyStatEffects(
  current: GameStats,
  effects: StatEffects
): { stats: GameStats; changes: StatChange[] } {
  const stats = { ...current };
  const changes: StatChange[] = [];

  for (const key of STAT_KEYS) {
    const delta = effects[key];
    if (!delta) continue;
    const before = stats[key];
    stats[key] = clampStat(key, before + delta);
    const actual = stats[key] - before;
    if (actual && key !== "mutual") changes.push({ key, delta: actual });
  }

  let derivedRebellion = 0;
  if (stats.stress >= 72 && stats.agency < 45) derivedRebellion += 3;
  if (stats.energy <= 30) derivedRebellion += 2;
  if (stats.stress < 55 && stats.agency >= 60) derivedRebellion -= 1;

  if (derivedRebellion) {
    const before = stats.rebellion;
    stats.rebellion = clampStat("rebellion", before + derivedRebellion);
    const actual = stats.rebellion - before;
    if (actual && !effects.rebellion) changes.push({ key: "rebellion", delta: actual });
  }

  return { stats, changes };
}
