import { describe, expect, it } from "vitest";

import { defaultNotebookState, initialStats } from "../src/config";
import { createOpeningProfile } from "../src/opening-profile";
import type { PromiseEntry } from "../src/types";

const balancedPromise: PromiseEntry = {
  id: "two-independent-goals",
  title: "两个目标",
  summary: "各自选择两个目标，其中至少一个与分数无关。",
  cadence: "第一章每周复盘一次",
  pressure: "low",
  status: "active",
  createdAtNode: "choice_pact"
};

describe("chapter-one opening profile", () => {
  it("captures mode, notebook layout, promise, and long-term patterns", () => {
    const notebook = defaultNotebookState();
    const profile = createOpeningProfile({
      playerName: "陈舟",
      mode: "story",
      endingId: "alliance",
      stats: { ...initialStats(), agency: 65, mutual: 10 },
      notebook,
      promises: [balancedPromise],
      decisionIds: ["notebook-s3-m2-b1", "pact_balance"],
      createdAt: "2026-07-15T00:00:00.000Z"
    });

    expect(profile.summary).toContain("你已经开始主动安排边界和节奏。");
    expect(profile.summary).toContain("你们初步形成了双向共担。");
    expect(profile.summary.some((line) => line.includes("两个目标"))).toBe(true);
    expect(profile.notebook).not.toBe(notebook);
  });

  it("does not turn a withheld promise into an active commitment", () => {
    const profile = createOpeningProfile({
      playerName: "陈舟",
      mode: "county",
      endingId: "blank",
      stats: initialStats(),
      notebook: defaultNotebookState(),
      promises: [{ ...balancedPromise, status: "withheld", title: "保留空白" }],
      decisionIds: [],
      createdAt: "2026-07-15T00:00:00.000Z"
    });

    expect(profile.summary).toContain("你保留了空白，没有用仓促承诺填满它。");
  });
});
