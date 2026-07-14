import type { StoryGraph } from "./types";

export type StoryGraphIssue =
  | { type: "missing-start"; nodeId: string }
  | { type: "missing-target"; nodeId: string; targetId: string }
  | { type: "unreachable"; nodeId: string }
  | { type: "dead-end"; nodeId: string };

export function validateStoryGraph(graph: StoryGraph, startNodeId: string): StoryGraphIssue[] {
  if (!graph[startNodeId]) return [{ type: "missing-start", nodeId: startNodeId }];

  const issues: StoryGraphIssue[] = [];
  const reachable = new Set<string>();
  const pending = [startNodeId];

  while (pending.length) {
    const nodeId = pending.pop();
    if (!nodeId || reachable.has(nodeId)) continue;
    const node = graph[nodeId];
    if (!node) continue;
    reachable.add(nodeId);

    const targets = [node.next, ...(node.choices ?? []).map((choice) => choice.next)].filter(
      (target): target is string => Boolean(target)
    );

    if (!node.end && node.overlay !== "notebook" && targets.length === 0) {
      issues.push({ type: "dead-end", nodeId });
    }

    for (const targetId of targets) {
      if (!graph[targetId]) issues.push({ type: "missing-target", nodeId, targetId });
      else pending.push(targetId);
    }
  }

  for (const nodeId of Object.keys(graph)) {
    if (!reachable.has(nodeId)) issues.push({ type: "unreachable", nodeId });
  }

  return issues;
}
