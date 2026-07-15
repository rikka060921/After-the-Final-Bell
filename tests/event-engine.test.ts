import { describe, expect, it } from "vitest";

import {
  appendResolvedEvent,
  eligibleEvents,
  resolveNextEvent,
  type EventContext
} from "../src/event-engine";

interface TestContext extends EventContext {
  readonly day: number;
}

const context: TestContext = { facts: ["mutual-help"], numbers: { pressure: 4 }, day: 3 };

describe("deterministic event engine", () => {
  it("chooses highest priority, then stable ID order", () => {
    const events = [
      { id: "z-later", priority: 2, when: () => true, resolve: () => "z" },
      { id: "a-earlier", priority: 2, when: () => true, resolve: () => "a" },
      { id: "blocked", priority: 9, when: (value: TestContext) => value.day < 2, resolve: () => "x" }
    ];
    expect(eligibleEvents(events, context).map((event) => event.id)).toEqual(["a-earlier", "z-later"]);
    expect(resolveNextEvent(events, context)?.result).toBe("a");
  });

  it("does not repeat resolved events and keeps resolution pure", () => {
    const event = { id: "one-shot", priority: 1, when: () => true, resolve: (value: TestContext) => value.day };
    expect(resolveNextEvent([event], context, ["one-shot"])).toBeNull();
    expect(appendResolvedEvent(["one-shot"], "one-shot")).toEqual(["one-shot"]);
    expect(appendResolvedEvent([], "one-shot")).toEqual(["one-shot"]);
  });
});
