import { describe, expect, it } from "vitest";

import { fastForwardStep, nextUnreadLinearNode } from "../src/story-progress";
import { story } from "../src/story";

describe("read-story replay helper", () => {
  it("skips only a contiguous run of already-read linear nodes", () => {
    expect(nextUnreadLinearNode(story, "intro_01", ["intro_01", "intro_02"])).toBe("intro_03");
    expect(nextUnreadLinearNode(story, "intro_01", ["intro_01"])).toBe("intro_02");
  });

  it("stops at choices, overlays, and endings even when they were read", () => {
    expect(nextUnreadLinearNode(story, "choice_note", ["choice_note"])).toBe("choice_note");
    expect(nextUnreadLinearNode(story, "notebook_01", ["notebook_01"])).toBe("notebook_01");
    expect(nextUnreadLinearNode(story, "resolve_ending", ["resolve_ending"])).toBe("resolve_ending");
  });

  it("advances one linear node at a time during fast-forward", () => {
    expect(fastForwardStep(story, "intro_01", false, false)).toEqual({
      kind: "advance",
      nextNodeId: "intro_02"
    });
  });

  it("honors the read-only guard and stops at interaction boundaries", () => {
    expect(fastForwardStep(story, "intro_01", false, true)).toEqual({
      kind: "stop",
      reason: "unread"
    });
    expect(fastForwardStep(story, "choice_note", true, false)).toEqual({
      kind: "stop",
      reason: "interaction"
    });
    expect(fastForwardStep(story, "resolve_ending", true, false)).toEqual({
      kind: "stop",
      reason: "ending"
    });
  });
});
