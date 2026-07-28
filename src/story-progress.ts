import type { StoryGraph } from "./types";

export type FastForwardStep =
  | { kind: "advance"; nextNodeId: string }
  | { kind: "stop"; reason: "unread" | "interaction" | "ending" | "dead-end" | "missing" };

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

/**
 * Resolves one automatic fast-forward step. Interactive nodes are never
 * consumed, and the optional read-only guard stops before unseen dialogue.
 */
export function fastForwardStep(
  graph: StoryGraph,
  nodeId: string,
  wasRead: boolean,
  readOnly: boolean
): FastForwardStep {
  const node = graph[nodeId];
  if (!node) return { kind: "stop", reason: "missing" };
  if (node.choices || node.overlay) return { kind: "stop", reason: "interaction" };
  if (node.end) return { kind: "stop", reason: "ending" };
  if (readOnly && !wasRead) return { kind: "stop", reason: "unread" };
  if (!node.next || !graph[node.next]) return { kind: "stop", reason: "dead-end" };
  return { kind: "advance", nextNodeId: node.next };
}
