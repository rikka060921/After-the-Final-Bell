import { describe, expect, it } from "vitest";

import { defaultNotebookState, initialStats } from "../src/config";
import { createOpeningProfile } from "../src/opening-profile";
import { createWeekSlots } from "../src/chapter-one/model";
import { initializeChapterOne } from "../src/chapter-one/opening";
import { sanitizeChapterOneState } from "../src/chapter-one/persistence";
import {
  advanceAfterReview,
  assignActivity,
  canCommitWeek,
  getWeekPlan,
  resetCurrentWeek,
  resolveCurrentWeek
} from "../src/chapter-one/schedule";
import { currentWeekEvent, resolveWeekEventChoice } from "../src/chapter-one/week-events";
import { archiveSeatGame, playSeatAction } from "../src/chapter-one/seat-game";
import { submitSentenceAssembly } from "../src/chapter-one/sentence";
import { EXAM_STAGES, playExamAction, thirdHandwritingReveal } from "../src/chapter-one/exam";
import type { GameMode, PromiseEntry } from "../src/types";

function promise(id: string, status: PromiseEntry["status"] = "active"): PromiseEntry {
  return {
    id,
    title: id,
    summary: id,
    cadence: "test",
    pressure: id === "daily-total-contact" ? "high" : "low",
    status,
    createdAtNode: "choice_pact"
  };
}

function opening(promiseId = "two-independent-goals", mode: GameMode = "story") {
  return createOpeningProfile({
    playerName: "陈舟",
    mode,
    endingId: "alliance",
    stats: initialStats(),
    notebook: defaultNotebookState(),
    promises: [promise(promiseId, promiseId === "blank-page" ? "withheld" : "active")],
    decisionIds: ["notice_her", "truth_honest", `pact_${promiseId}`],
    createdAt: "2026-07-15T00:00:00.000Z"
  });
}

function fillSixOpenSlots(state: ReturnType<typeof initializeChapterOne>["chapterOne"]) {
  let next = state;
  const plan = getWeekPlan(next);
  const available = Object.values(plan.assignments).filter((assignment) => !assignment.locked).slice(0, 6);
  for (const assignment of available) next = assignActivity(next, assignment.slotId, "rest");
  return next;
}

function finishWeekEvents(
  state: ReturnType<typeof initializeChapterOne>["chapterOne"],
  progress: ReturnType<typeof initializeChapterOne>["progress"],
  stats = initialStats()
) {
  let chapterOne = state;
  let nextProgress = progress;
  let nextStats = stats;
  while (chapterOne.phase === "week-events") {
    const event = currentWeekEvent(chapterOne, nextProgress);
    if (!event) throw new Error("Missing current week event");
    ({ chapterOne, progress: nextProgress, stats: nextStats } = resolveWeekEventChoice(
      chapterOne,
      nextProgress,
      nextStats,
      event.choices[0]!.id
    ));
  }
  return { chapterOne, progress: nextProgress, stats: nextStats };
}

describe("chapter one schedule", () => {
  it("creates exactly fourteen stable, unique slots per week", () => {
    for (const week of [1, 2, 3, 4] as const) {
      const slots = createWeekSlots(week);
      expect(slots).toHaveLength(14);
      expect(new Set(slots.map((slot) => slot.id)).size).toBe(14);
    }
  });

  it.each([
    ["two-independent-goals", 4],
    ["daily-total-contact", 20],
    ["blank-page", 0]
  ])("maps %s to structured obligations", (promiseId, count) => {
    const { chapterOne } = initializeChapterOne(opening(promiseId));
    expect(chapterOne.obligations).toHaveLength(count);
  });

  it("does not mutate old state and rejects overwriting a promise slot", () => {
    const { chapterOne } = initializeChapterOne(opening());
    const oldJson = JSON.stringify(chapterOne);
    const open = Object.values(getWeekPlan(chapterOne).assignments).find((item) => !item.locked)!;
    const changed = assignActivity(chapterOne, open.slotId, "rest");
    expect(JSON.stringify(chapterOne)).toBe(oldJson);
    expect(getWeekPlan(changed).assignments[open.slotId]?.activityId).toBe("rest");

    const locked = Object.values(getWeekPlan(chapterOne).assignments).find((item) => item.locked)!;
    expect(() => assignActivity(chapterOne, locked.slotId, "rest")).toThrow(/Promise obligations/);
  });

  it("requires exactly six player decisions and rejects a seventh", () => {
    const initialized = initializeChapterOne(opening("blank-page"));
    const five = Object.values(getWeekPlan(initialized.chapterOne).assignments).slice(0, 5);
    let state = initialized.chapterOne;
    five.forEach((assignment) => { state = assignActivity(state, assignment.slotId, "rest"); });
    expect(canCommitWeek(state)).toMatchObject({ ok: false });
    const sixth = Object.values(getWeekPlan(state).assignments).find((assignment) => assignment.activityId === "open")!;
    state = assignActivity(state, sixth.slotId, "own-goal");
    expect(canCommitWeek(state)).toMatchObject({ ok: true });
    const seventh = Object.values(getWeekPlan(state).assignments).find((assignment) => assignment.activityId === "open")!;
    expect(() => assignActivity(state, seventh.slotId, "rest")).toThrow(/6 次主动安排/);
  });

  it("plays three deterministic execution events before the weekly core interaction", () => {
    const initialized = initializeChapterOne(opening("blank-page"));
    const resolved = resolveCurrentWeek(
      fillSixOpenSlots(initialized.chapterOne),
      initialized.progress,
      initialStats()
    );
    expect(resolved.chapterOne.phase).toBe("week-events");
    expect(resolved.chapterOne.weekExecution?.eventIds).toHaveLength(3);
    const finished = finishWeekEvents(resolved.chapterOne, resolved.progress, resolved.stats);
    expect(finished.chapterOne.phase).toBe("seat-game");
    expect(finished.chapterOne.weekExecution?.choiceIds).toHaveLength(3);
    expect(finished.progress.facts.some((fact) => fact.startsWith("week-choice:"))).toBe(true);
  });

  it("restores an in-progress weekly execution from save data", () => {
    const initialized = initializeChapterOne(opening("blank-page"));
    const resolved = resolveCurrentWeek(
      fillSixOpenSlots(initialized.chapterOne),
      initialized.progress,
      initialStats()
    );
    const event = currentWeekEvent(resolved.chapterOne, resolved.progress)!;
    const advanced = resolveWeekEventChoice(
      resolved.chapterOne,
      resolved.progress,
      resolved.stats,
      event.choices[1]!.id
    );
    const restored = sanitizeChapterOneState(structuredClone(advanced.chapterOne));
    expect(restored?.phase).toBe("week-events");
    expect(restored?.weekExecution).toMatchObject({ cursor: 1 });
    expect(restored?.weekExecution?.choiceIds).toEqual([event.choices[1]!.id]);
  });

  it("renegotiates excessive daily contact through Zhou Tang's deterministic action", () => {
    const initialized = initializeChapterOne(opening("daily-total-contact"));
    let state = fillSixOpenSlots(initialized.chapterOne);
    let progress = initialized.progress;
    let stats = initialStats();
    let resolved = resolveCurrentWeek(state, progress, stats);
    ({ chapterOne: state, progress, stats } = finishWeekEvents(resolved.chapterOne, resolved.progress, resolved.stats));
    state = playSeatAction(state, "wait");
    state = playSeatAction(state, "pass-liang");
    state = playSeatAction(state, "wait");
    state = playSeatAction(state, "pass-zhou");
    ({ chapterOne: state, progress } = archiveSeatGame(state, progress));
    ({ chapterOne: state, progress } = advanceAfterReview(state, progress));
    state = fillSixOpenSlots(state);
    resolved = resolveCurrentWeek(state, progress, stats);
    ({ chapterOne: state, progress, stats } = finishWeekEvents(resolved.chapterOne, resolved.progress, resolved.stats));

    expect(progress.facts).toContain("daily-contact-renegotiated");
    expect(state.obligations.filter((item) => item.status === "renegotiated")).toHaveLength(6);
    expect(state.results.find((result) => result.week === 2)?.zhouAction).toContain("主动改变计划");

    const advanced = advanceAfterReview(state, progress);
    const beforeReset = Object.values(getWeekPlan(advanced.chapterOne).assignments).filter(
      (assignment) => assignment.source === "zhou-tang" && assignment.status === "rescheduled"
    );
    const reset = resetCurrentWeek(advanced.chapterOne);
    const afterReset = Object.values(getWeekPlan(reset).assignments).filter(
      (assignment) => assignment.source === "zhou-tang" && assignment.status === "rescheduled"
    );
    expect(beforeReset).toHaveLength(3);
    expect(afterReset.map((assignment) => assignment.slotId)).toEqual(
      beforeReset.map((assignment) => assignment.slotId)
    );
  });

  it("applies low-energy speed-training costs in chronological slot order", () => {
    const initialized = initializeChapterOne(opening("blank-page"));
    let state = initialized.chapterOne;
    for (const slot of createWeekSlots(1).slice(0, 6)) {
      state = assignActivity(state, slot.id, "math-speed");
    }
    const resolved = resolveCurrentWeek(
      state,
      initialized.progress,
      { ...initialStats(), energy: 30 }
    );
    expect(resolved.progress.academic.falseMastery).toBeGreaterThan(0);
    expect(resolved.progress.academic.sleepDebt).toBeGreaterThan(
      initialized.progress.academic.sleepDebt
    );
    expect(resolved.progress.academic.speed).toBeLessThan(
      initialized.progress.academic.speed + 6 * 4
    );
  });

  it("lets recovery prevent a later low-energy training penalty, but not erase an earlier one", () => {
    const initialized = initializeChapterOne(opening("blank-page"));
    const slots = createWeekSlots(1);
    const arrange = (first: "rest" | "math-speed", second: "rest" | "math-speed") => {
      let state = initialized.chapterOne;
      state = assignActivity(state, slots[0]!.id, first);
      state = assignActivity(state, slots[1]!.id, second);
      for (const slot of slots.slice(2, 6)) state = assignActivity(state, slot.id, "own-goal");
      return resolveCurrentWeek(
        state,
        initialized.progress,
        { ...initialStats(), energy: 30 }
      );
    };
    const recoverFirst = arrange("rest", "math-speed");
    const trainFirst = arrange("math-speed", "rest");
    expect(recoverFirst.progress.academic.falseMastery).toBe(
      initialized.progress.academic.falseMastery
    );
    expect(trainFirst.progress.academic.falseMastery).toBe(
      initialized.progress.academic.falseMastery + 2
    );
    expect(recoverFirst.progress.academic.speed).toBe(
      trainFirst.progress.academic.speed + 3
    );
  });

  it("derives exam rebellion once after the four-stage sequence", () => {
    const initialized = initializeChapterOne(opening("blank-page"));
    let state = initialized.chapterOne;
    state.currentWeek = 4;
    state.phase = "exam";
    let progress = initialized.progress;
    let stats = { ...initialStats(), energy: 60, stress: 80, agency: 20 };
    const initialRebellion = stats.rebellion;

    EXAM_STAGES.forEach((stage, index) => {
      ({ chapterOne: state, progress, stats } = playExamAction(
        state,
        progress,
        stats,
        stage.actions[0]!.id
      ));
      expect(stats.rebellion).toBe(initialRebellion + (index === 3 ? 3 : 0));
    });
  });

  it.each(["two-independent-goals", "blank-page"])(
    "writes Zhou's optional mutual-review invitation into week three for %s",
    (promiseId) => {
      const initialized = initializeChapterOne(opening(promiseId));
      let state = fillSixOpenSlots(initialized.chapterOne);
      let progress = initialized.progress;
      let stats = initialStats();
      let resolved = resolveCurrentWeek(state, progress, stats);
      ({ chapterOne: state, progress, stats } = finishWeekEvents(resolved.chapterOne, resolved.progress, resolved.stats));
      state = playSeatAction(state, "take-back");
      ({ chapterOne: state, progress } = archiveSeatGame(state, progress));
      ({ chapterOne: state, progress } = advanceAfterReview(state, progress));
      state = fillSixOpenSlots(state);
      resolved = resolveCurrentWeek(state, progress, stats);
      ({ chapterOne: state, progress, stats } = finishWeekEvents(resolved.chapterOne, resolved.progress, resolved.stats));
      ({ chapterOne: state, progress } = advanceAfterReview(state, progress));

      expect(state.currentWeek).toBe(3);
      expect(getWeekPlan(state).assignments["w3-d2-evening"]).toMatchObject({
        activityId: "mutual-review",
        source: "zhou-tang",
        locked: false
      });
    }
  );

  it.each(["two-independent-goals", "daily-total-contact", "blank-page"])(
    "completes all four weeks for promise %s without a direct score choice",
    (promiseId) => {
      const initialized = initializeChapterOne(opening(promiseId));
      let state = initialized.chapterOne;
      let progress = initialized.progress;
      let stats = initialStats();

      for (const week of [1, 2, 3, 4] as const) {
        state = fillSixOpenSlots(state);
        ({ chapterOne: state, progress, stats } = resolveCurrentWeek(state, progress, stats));
        ({ chapterOne: state, progress, stats } = finishWeekEvents(state, progress, stats));
        if (week === 1) {
          state = playSeatAction(state, "wait");
          state = playSeatAction(state, "pass-liang");
          state = playSeatAction(state, "wait");
          state = playSeatAction(state, "pass-zhou");
          ({ chapterOne: state, progress } = archiveSeatGame(state, progress));
        }
        if (week === 3) {
          ({ chapterOne: state, progress } = submitSentenceAssembly(
            state,
            progress,
            ["open-ask", "middle-boundary", "close-note"],
            "intact"
          ));
        }
        if (week === 4) {
          for (const stage of EXAM_STAGES) {
            const action = stage.actions[0]!;
            ({ chapterOne: state, progress, stats } = playExamAction(state, progress, stats, action.id));
          }
          expect(state.exam.band).not.toBeNull();
          expect(state.exam.actionIds.every((id) => !id.includes("score"))).toBe(true);
        }
        ({ chapterOne: state, progress } = advanceAfterReview(state, progress));
      }

      expect(state.phase).toBe("complete");
      expect(progress.facts).toContain("third-handwriting-seen");
      expect(thirdHandwritingReveal(progress).handwriting).toContain("别问她");
      expect(thirdHandwritingReveal(progress).handwriting).not.toContain("宋嘉禾");
    }
  );
});
