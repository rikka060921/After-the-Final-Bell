import { describe, expect, it } from "vitest";

import { defaultNotebookState } from "../src/config";
import {
  countNotebookSlots,
  cycleNotebookSlot,
  getNotebookEffects,
  notebookDecisionId
} from "../src/notebook";

describe("interactive notebook", () => {
  it("cycles one page cell without mutating the previous state", () => {
    const original = defaultNotebookState();
    const changed = cycleNotebookSlot(original, 0);

    expect(original.slots[0]).toBe("solution");
    expect(changed.slots[0]).toBe("message");
  });

  it("summarizes and records a stable allocation decision", () => {
    const notebook = defaultNotebookState();
    expect(countNotebookSlots(notebook)).toEqual({ solution: 3, message: 2, blank: 1 });
    expect(notebookDecisionId(notebook)).toBe("notebook-s3-m2-b1");
  });

  it("turns layout priorities into small, bounded story effects", () => {
    const messageHeavy = {
      slots: ["message", "message", "message", "message", "solution", "blank"] as const,
      committed: false
    };
    const effects = getNotebookEffects({ ...messageHeavy, slots: [...messageHeavy.slots] });

    expect(effects.bond).toBe(3);
    expect(effects.risk).toBe(2);
    expect(effects.mutual).toBe(1);
  });

  it("does not change an already committed layout", () => {
    const committed = { ...defaultNotebookState(), committed: true };
    expect(cycleNotebookSlot(committed, 0)).toBe(committed);
  });
});
