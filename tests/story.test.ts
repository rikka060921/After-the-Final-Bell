import { describe, expect, it } from "vitest";

import { resolveEnding } from "../src/endings";
import { applyStatEffects } from "../src/state";
import { story } from "../src/story";
import { validateStoryGraph } from "../src/story-graph";
import { initialStats } from "../src/config";
import type { EndingId, GameStats } from "../src/types";

describe("demo story graph", () => {
  it("contains the preserved demo scope", () => {
    const nodes = Object.values(story);
    expect(nodes).toHaveLength(44);
    expect(nodes.filter((node) => node.choices?.length)).toHaveLength(7);
    expect(nodes.flatMap((node) => node.choices ?? [])).toHaveLength(21);
  });

  it("has no missing targets, dead ends, or unreachable nodes", () => {
    expect(validateStoryGraph(story, "intro_01")).toEqual([]);
  });

  it("can still reach every demo ending through real choices", () => {
    const reached = new Set<EndingId>();

    const visit = (nodeId: string, stats: GameStats): void => {
      const node = story[nodeId];
      if (!node) throw new Error(`Missing story node: ${nodeId}`);
      if (node.end) {
        reached.add(resolveEnding(stats));
        return;
      }
      if (node.choices) {
        for (const choice of node.choices) {
          visit(choice.next, applyStatEffects(stats, choice.effects ?? {}).stats);
        }
        return;
      }
      if (node.next) visit(node.next, stats);
    };

    visit("intro_01", initialStats());
    expect([...reached].sort()).toEqual(
      (["alliance", "blank", "correct", "overload", "stolen"] satisfies EndingId[]).sort()
    );
  });
});
