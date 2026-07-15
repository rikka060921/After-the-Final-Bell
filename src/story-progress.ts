import type { StoryGraph } from "./types";

/**
 * Skips only already-read, linear story nodes. Choice points, overlays and
 * endings remain visible so replay never silently consumes a decision.
 */
export function nextUnreadLinearNode(
  graph: StoryGraph,
  startNodeId: string,
  readNodeIds: readonly string[]
): string {
  const read = new Set(readNodeIds);
  let current = startNodeId;
  let hops = 0;
  while (hops < 240) {
    const node = graph[current];
    if (!node || !read.has(current) || node.choices || node.overlay || node.end || !node.next) return current;
    const next = graph[node.next];
    if (!next) return current;
    current = node.next;
    hops += 1;
  }
  return current;
}
