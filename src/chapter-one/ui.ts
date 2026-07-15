import type {
  ChapterOneActivityId,
  ChapterOneState,
  GameMode,
  LongTermProgress,
  OpeningProfile,
  SeatActionId,
  SentenceAssemblyRecord
} from "../types";
import { currentExamStage, thirdHandwritingReveal } from "./exam";
import { deriveChapterOneContext } from "./context";
import { activityById, createWeekSlots, getWeekDefinition } from "./model";
import {
  activitiesForSlot,
  canCommitWeek,
  currentWeekLabel,
  getWeekPlan,
  PLAYER_ACTION_LIMIT,
  selectedPlayerActivities
} from "./schedule";
import { getSeatActions, seatOutcomeText } from "./seat-game";
import {
  assembleSentence,
  availableSentenceFragments,
  pageActionLabel,
  validateSentenceSelection,
  type SentencePosition
} from "./sentence";
import { evaluateWeekGoals } from "./week-goals";
import { currentWeekEvent } from "./week-events";

const $ = <T extends Element = HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing chapter-one element: ${selector}`);
  return element;
};

export interface ChapterOneUICallbacks {
  onAssign(slotId: string, activityId: ChapterOneActivityId): void;
  onResetWeek(): void;
  onCommitWeek(): void;
  onWeekEventChoice(choiceId: string): void;
  onSave(): void;
  onReturnTitle(): void;
  onSeatAction(actionId: SeatActionId): void;
  onSeatFinish(): void;
  onSentenceSubmit(fragmentIds: string[], pageAction: SentenceAssemblyRecord["pageAction"]): void;
  onReviewContinue(): void;
  onExamAction(actionId: string): void;
  onReplay(): void;
}

export interface ChapterOneUI {
  renderPlanner(
    state: ChapterOneState,
    profile: OpeningProfile,
    _mode: GameMode,
    progress: LongTermProgress
  ): void;
  renderWeekEvents(state: ChapterOneState, progress: LongTermProgress, mode: GameMode): void;
  renderSeatGame(state: ChapterOneState): void;
  renderSentenceGame(progress: LongTermProgress, mode: GameMode): void;
  renderReview(state: ChapterOneState, progress: LongTermProgress): void;
  renderExam(state: ChapterOneState, mode: GameMode): void;
  renderComplete(state: ChapterOneState, progress: LongTermProgress): void;
}

function setText(selector: string, value: string): void {
  $(selector).textContent = value;
}

function listContent(items: string[]): HTMLUListElement {
  const list = document.createElement("ul");
  const values = items.length ? items : ["没有新增记录。"];
  values.forEach((value) => {
    const item = document.createElement("li");
    item.textContent = value;
    list.append(item);
  });
  return list;
}

function promiseSummary(state: ChapterOneState, profile: OpeningProfile): string {
  const due = state.obligations.filter(
    (obligation) => obligation.week === state.currentWeek && obligation.status === "due"
  );
  const promise = profile.promises[0];
  if (!promise || promise.status === "withheld") return "没有自动占用。留白是一次有效选择，不会被判成失约。";
  if (!due.length) return `“${promise.title}”本周没有待履行的固定格。`;
  return `“${promise.title}”已占用 ${due.length} 格。锁定格只能通过剧情中的协商改约。`;
}

export function createChapterOneUI(callbacks: ChapterOneUICallbacks): ChapterOneUI {
  const slotDialog = $<HTMLDialogElement>("#slot-editor");
  const slotForm = $<HTMLFormElement>("#slot-editor-form");
  let editingSlotId: string | null = null;
  let returnFocus: HTMLButtonElement | null = null;

  $("#schedule-reset-btn").addEventListener("click", callbacks.onResetWeek);
  $("#schedule-commit-btn").addEventListener("click", callbacks.onCommitWeek);
  $("#planner-save-btn").addEventListener("click", callbacks.onSave);
  $("#planner-title-btn").addEventListener("click", callbacks.onReturnTitle);
  $("#review-title-btn").addEventListener("click", callbacks.onReturnTitle);
  $("#review-continue-btn").addEventListener("click", callbacks.onReviewContinue);
  $("#seat-finish-btn").addEventListener("click", callbacks.onSeatFinish);
  $("#chapter-complete-title-btn").addEventListener("click", callbacks.onReturnTitle);
  $("#chapter-complete-replay-btn").addEventListener("click", callbacks.onReplay);

  slotDialog.addEventListener("close", () => {
    returnFocus?.focus();
    returnFocus = null;
  });

  slotForm.addEventListener("submit", (event) => {
    const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value !== "confirm") return;
    event.preventDefault();
    if (!editingSlotId) return;
    const selected = slotForm.querySelector<HTMLInputElement>('input[name="slot-activity"]:checked');
    if (!selected) return;
    try {
      callbacks.onAssign(editingSlotId, selected.value as ChapterOneActivityId);
      setText("#schedule-status", `${editingSlotId} 已改为 ${activityById.get(selected.value as ChapterOneActivityId)?.label ?? selected.value}。`);
      slotDialog.close("confirm");
    } catch (error) {
      setText("#schedule-status", error instanceof Error ? error.message : "无法写入这格时间。");
    }
  });

  function openSlotEditor(
    state: ChapterOneState,
    slotId: string,
    trigger: HTMLButtonElement
  ): void {
    const slot = createWeekSlots(state.currentWeek).find((candidate) => candidate.id === slotId);
    const assignment = getWeekPlan(state).assignments[slotId];
    if (!slot || !assignment || assignment.locked) return;
    editingSlotId = slotId;
    returnFocus = trigger;
    setText("#slot-editor-title", `${slot.dayLabel} · ${slot.periodLabel}`);
    setText("#slot-editor-context", "每一格只安排一件事；留白不会暗中扣除资源。");
    const options = $("#slot-activity-options");
    options.replaceChildren();
    activitiesForSlot(slot.period).forEach((activity) => {
      const label = document.createElement("label");
      label.className = "activity-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "slot-activity";
      input.value = activity.id;
      input.checked = activity.id === assignment.activityId;
      const content = document.createElement("span");
      const category = document.createElement("em");
      category.textContent = activity.category;
      const title = document.createElement("strong");
      title.textContent = activity.label;
      const description = document.createElement("small");
      description.textContent = activity.description;
      content.append(category, title, description);
      label.append(input, content);
      options.append(label);
    });
    slotDialog.showModal();
    requestAnimationFrame(() => slotForm.querySelector<HTMLInputElement>('input[name="slot-activity"]:checked')?.focus());
  }

  function renderPlanner(
    state: ChapterOneState,
    profile: OpeningProfile,
    mode: GameMode,
    progress: LongTermProgress
  ): void {
    const definition = getWeekDefinition(state.currentWeek);
    const context = deriveChapterOneContext(state, progress);
    const plan = getWeekPlan(state);
    setText("#planner-title", currentWeekLabel(state));
    setText("#planner-date", definition.dateRange);
    setText("#planner-prompt", context.prompt);

    const weekList = $("#week-progress-list");
    weekList.replaceChildren();
    ([1, 2, 3, 4] as const).forEach((week) => {
      const weekDefinition = getWeekDefinition(week);
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.disabled = true;
      const priorPlan = state.plans.find((candidate) => candidate.week === week);
      button.dataset.state = priorPlan?.resolved ? "done" : week === state.currentWeek ? "current" : "future";
      if (week === state.currentWeek) button.setAttribute("aria-current", "step");
      button.textContent = `第${week}周 · ${weekDefinition.title}`;
      const small = document.createElement("small");
      small.textContent = priorPlan?.resolved ? "已写入" : week === state.currentWeek ? "正在安排" : "尚未开始";
      button.append(small);
      item.append(button);
      weekList.append(item);
    });

    const pressure = $("#pressure-list");
    pressure.replaceChildren(...context.pressure.map((line) => {
      const item = document.createElement("li");
      item.textContent = line;
      return item;
    }));
    const promise = $("#planner-promise");
    promise.replaceChildren();
    const promiseTitle = document.createElement("strong");
    promiseTitle.textContent = "承诺占用";
    promise.append(promiseTitle, document.createTextNode(promiseSummary(state, profile)));

    const goals = $("#planner-goal-list");
    goals.replaceChildren(...evaluateWeekGoals(state).map((goal) => {
      const item = document.createElement("li");
      item.dataset.complete = String(goal.complete);
      const marker = document.createElement("span");
      marker.textContent = goal.complete ? "完成" : "待处理";
      const copy = document.createElement("div");
      const label = document.createElement("strong");
      label.textContent = goal.label;
      const detail = document.createElement("small");
      detail.textContent = goal.detail;
      copy.append(label, detail);
      item.append(marker, copy);
      return item;
    }));

    setText("#planner-echo-title", context.echoTitle);
    const echoList = $("#planner-echo-list");
    echoList.replaceChildren(...context.echoLines.map((line) => {
      const item = document.createElement("li");
      item.textContent = line;
      return item;
    }));

    const slots = createWeekSlots(state.currentWeek);
    const days = $("#schedule-days");
    days.replaceChildren();
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const daySlots = slots.filter((slot) => slot.dayIndex === dayIndex);
      const day = document.createElement("li");
      day.className = "schedule-day";
      const heading = document.createElement("h4");
      heading.textContent = daySlots[0]?.dayLabel ?? `第${dayIndex + 1}天`;
      const slotList = document.createElement("ol");
      slotList.className = "day-slots";
      daySlots.forEach((slot) => {
        const assignment = plan.assignments[slot.id];
        if (!assignment) return;
        const activity = activityById.get(assignment.activityId);
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "time-slot";
        button.disabled = assignment.locked;
        button.dataset.slotId = slot.id;
        button.dataset.state = assignment.locked
          ? "promise"
          : assignment.source === "zhou-tang"
            ? "zhou"
          : assignment.status === "rescheduled"
            ? "rescheduled"
            : assignment.activityId === "open"
              ? "blank"
              : "planned";
        button.setAttribute("aria-haspopup", "dialog");
        button.setAttribute("aria-controls", "slot-editor");
        const stateId = `${slot.id}-state`;
        button.setAttribute("aria-describedby", stateId);
        button.setAttribute(
          "aria-label",
          `${slot.dayLabel}${slot.periodLabel}，${activity?.label ?? "留白"}，${assignment.locked ? "承诺占用，不可直接覆盖" : "可编辑"}`
        );
        const time = document.createElement("span");
        time.className = "slot-time";
        time.textContent = slot.periodLabel;
        const title = document.createElement("strong");
        title.textContent = activity?.shortLabel ?? "留白";
        const stateLabel = document.createElement("span");
        stateLabel.className = "slot-state";
        stateLabel.id = stateId;
        stateLabel.textContent = assignment.locked
          ? "承诺占用 · 需协商改约"
          : assignment.source === "zhou-tang"
            ? "周棠提出 · 可调整"
          : assignment.status === "rescheduled"
            ? "周棠已改约 · 可重新安排"
            : assignment.activityId === "open"
              ? "尚未安排"
              : "已安排";
        button.append(time, title, stateLabel);
        if (!assignment.locked) button.addEventListener("click", () => openSlotEditor(state, slot.id, button));
        item.append(button);
        slotList.append(item);
      });
      day.append(heading, slotList);
      days.append(day);
    }

    const activeCount = Object.values(plan.assignments).filter((item) => item.activityId !== "open").length;
    const blanks = 14 - activeCount;
    const playerActions = selectedPlayerActivities(plan);
    const fixed = activeCount - playerActions;
    setText("#allocation-summary", `主动 ${playerActions}/${PLAYER_ACTION_LIMIT} · 固定 ${fixed} · 留白 ${blanks}`);
    const permission = canCommitWeek(state);
    const commit = $<HTMLButtonElement>("#schedule-commit-btn");
    commit.disabled = !permission.ok;
    setText("#schedule-guidance", permission.reason);
  }

  function renderWeekEvents(
    state: ChapterOneState,
    progress: LongTermProgress,
    mode: GameMode
  ): void {
    const event = currentWeekEvent(state, progress);
    const execution = state.weekExecution;
    if (!event || !execution) return;
    setText("#week-event-label", `第一章 · 第${state.currentWeek}周执行`);
    setText("#week-event-title", event.title);
    setText("#week-event-scene", event.scene);
    setText("#week-event-prompt", event.prompt);
    const step = execution.cursor + 1;
    const total = execution.eventIds.length;
    const progressBar = $<HTMLElement>("#week-event-progress");
    progressBar.setAttribute("aria-valuenow", String(step));
    progressBar.setAttribute("aria-valuemax", String(total));
    progressBar.setAttribute("aria-valuetext", `第 ${step} 个执行事件，共 ${total} 个`);
    $<HTMLElement>("#week-event-progress-fill").style.width = `${(step / total) * 100}%`;

    const actions = $("#week-event-actions");
    actions.replaceChildren(...event.choices.map((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "week-event-choice";
      const title = document.createElement("strong");
      title.textContent = choice.label;
      const description = document.createElement("small");
      description.textContent = choice.description;
      button.append(title, description);
      if (mode === "story") {
        const hint = document.createElement("em");
        hint.textContent = choice.hint;
        button.append(hint);
      }
      button.addEventListener("click", () => callbacks.onWeekEventChoice(choice.id));
      return button;
    }));

    const log = $("#week-event-log");
    log.replaceChildren(...execution.log.map((line) => {
      const item = document.createElement("li");
      item.textContent = line;
      return item;
    }));
    setText("#week-event-status", `本周执行事件 ${step}/${total}`);
  }

  function renderSeatGame(state: ChapterOneState): void {
    const map = $("#seat-map");
    map.replaceChildren();
    const table = document.createElement("table");
    table.className = "seat-map";
    const caption = document.createElement("caption");
    caption.textContent = "讲台在上方；共六列八排。纸页路线也在右侧动作列表完整呈现。";
    table.append(caption);
    const body = document.createElement("tbody");
    const people: Record<string, { name: string; person: string }> = {
      r1c3: { name: "郭祺", person: "guo" },
      r2c5: { name: "周棠", person: "zhou" },
      r5c3: { name: "梁硕", person: "liang" },
      r6c2: { name: "陈舟", person: "player" }
    };
    for (let row = 1; row <= 8; row += 1) {
      const tr = document.createElement("tr");
      for (let column = 1; column <= 6; column += 1) {
        const id = `r${row}c${column}`;
        const cell = document.createElement("td");
        const person = people[id];
        const watched = state.seatGame.turn % 2 === 0 ? [3, 4].includes(column) : row <= 3;
        cell.dataset.state = id === state.seatGame.carrierSeatId ? "carrier" : watched ? "watched" : "clear";
        if (person) cell.dataset.person = person.person;
        const title = document.createElement("strong");
        title.textContent = person?.name ?? `${row}-${column}`;
        const detail = document.createElement("span");
        detail.textContent = id === state.seatGame.carrierSeatId ? "纸页所在" : watched ? "当前视线内" : "当前未覆盖";
        cell.append(title, detail);
        tr.append(cell);
      }
      body.append(tr);
    }
    table.append(body);
    map.append(table);

    setText(
      "#seat-turn-state",
      state.seatGame.resolved
        ? seatOutcomeText(state)
        : `第 ${state.seatGame.turn + 1} 轮 · 注意痕迹 ${state.seatGame.attention >= 2 ? "明显" : state.seatGame.attention ? "轻微" : "未形成"} · 纸页在 ${people[state.seatGame.carrierSeatId]?.name ?? "桌面"}`
    );
    const actions = $("#seat-action-list");
    actions.replaceChildren();
    getSeatActions(state).forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "seat-action-btn";
      const title = document.createElement("strong");
      title.textContent = action.label;
      const description = document.createElement("small");
      description.textContent = action.description;
      button.append(title, description);
      button.addEventListener("click", () => callbacks.onSeatAction(action.id));
      actions.append(button);
    });
    const log = $("#seat-log");
    log.replaceChildren(...state.seatGame.log.map((line) => {
      const item = document.createElement("li");
      item.textContent = line;
      return item;
    }));
    const finish = $<HTMLButtonElement>("#seat-finish-btn");
    finish.hidden = !state.seatGame.resolved;
    setText("#seat-status", state.seatGame.log.at(-1) ?? "座位玩法开始。 ");
  }

  function renderSentenceGame(progress: LongTermProgress, mode: GameMode): void {
    const fields = $("#sentence-fields");
    fields.replaceChildren();
    const positionCopy: Record<SentencePosition, { title: string; note: string }> = {
      open: { title: "一 · 开口", note: "先说你现在要处理的事实或感受。" },
      middle: { title: "二 · 补充（可留白）", note: "补上边界、等待或要求；也可以不补。" },
      close: { title: "三 · 落句", note: "提出下一次具体怎么做，或结束这次沟通。" }
    };
    (["open", "middle", "close"] as SentencePosition[]).forEach((position) => {
      const fieldset = document.createElement("fieldset");
      fieldset.className = "sentence-field";
      const legend = document.createElement("legend");
      legend.textContent = positionCopy[position].title;
      const note = document.createElement("p");
      note.textContent = positionCopy[position].note;
      fieldset.append(legend, note);
      if (position === "middle") {
        const empty = document.createElement("label");
        empty.className = "fragment-option";
        empty.innerHTML = '<input type="radio" name="sentence-middle" value="" checked><span><strong>不补充，直接落句</strong><small>两段句子也是完整表达。</small></span>';
        fieldset.append(empty);
      }
      availableSentenceFragments(progress, position).forEach((fragment, index) => {
        const label = document.createElement("label");
        label.className = "fragment-option";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = `sentence-${position}`;
        input.value = fragment.id;
        if (position !== "middle" && index === 0) input.checked = true;
        const content = document.createElement("span");
        const text = document.createElement("strong");
        text.textContent = fragment.text;
        content.append(text);
        if (mode === "story") {
          const hint = document.createElement("small");
          hint.className = "choice-hint";
          hint.textContent = fragment.hint;
          content.append(hint);
        }
        label.append(input, content);
        fieldset.append(label);
      });
      fields.append(fieldset);
    });

    const updatePreview = () => {
      const ids = (["open", "middle", "close"] as const)
        .map((position) => $<HTMLInputElement>(`input[name="sentence-${position}"]:checked`).value)
        .filter(Boolean);
      const validation = validateSentenceSelection(progress, ids);
      setText("#assembled-sentence", validation.fragments.length ? assembleSentence(validation.fragments) : "请选择开口与落句。 ");
    setText("#sentence-validation", validation.reason);
      $<HTMLButtonElement>("#sentence-submit-btn").disabled = !validation.ok;
    };
    fields.querySelectorAll("input").forEach((input) => input.addEventListener("change", updatePreview));
    updatePreview();
  }

  const sentenceForm = $<HTMLFormElement>("#sentence-form");
  sentenceForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const ids = (["open", "middle", "close"] as const)
      .map((position) => sentenceForm.querySelector<HTMLInputElement>(`input[name="sentence-${position}"]:checked`)?.value ?? "")
      .filter(Boolean);
    const pageAction = sentenceForm.querySelector<HTMLInputElement>('input[name="page-action"]:checked')?.value as SentenceAssemblyRecord["pageAction"] | undefined;
    if (!pageAction) return;
    callbacks.onSentenceSubmit(ids, pageAction);
  });

  function renderReview(state: ChapterOneState, progress: LongTermProgress): void {
    const result = state.results.find((candidate) => candidate.week === state.currentWeek);
    if (!result) return;
    setText("#review-title", result.title);
    setText("#review-zhou-action", result.zhouAction);
    const grid = $("#week-review-grid");
    grid.replaceChildren();
    const groups = [
      ["已完成", result.completed],
      ["计划的变化", result.changes],
      ["留下的回声", result.echoes],
      ["下周已占用", result.nextWeek]
    ] as const;
    groups.forEach(([title, values]) => {
      const card = document.createElement("section");
      card.className = "review-card";
      const heading = document.createElement("h3");
      heading.textContent = title;
      card.append(heading, listContent(values));
      grid.append(card);
    });
    const pattern = progress.facts.find((fact) => fact.startsWith("first-communication-pattern:"));
    const page = progress.facts.find((fact) => fact.startsWith("page17-state:"));
    const patternLabels: Record<string, string> = {
      control: "把不安写成命令",
      avoidance: "用没事回避修复",
      "listening-boundary": "先倾听，再提出边界",
      "responsible-expression": "承认感受并承担表达",
      listening: "接受自己无权知道全部",
      "direct-explanation": "直接说明问题"
    };
    const patternKey = pattern?.split(":")[1] ?? "";
    const patternWrap = $("#review-pattern");
    patternWrap.replaceChildren();
    const patternTitle = document.createElement("strong");
    patternTitle.textContent = "长期记录";
    const patternText = document.createElement("p");
    patternText.textContent = patternKey
      ? `第一种沟通习惯：${patternLabels[patternKey] ?? patternKey}`
      : "沟通习惯仍在形成。";
    patternWrap.append(patternTitle, patternText);
    if (page) {
      const pageText = document.createElement("p");
      pageText.textContent = pageActionLabel(page.split(":")[1] as SentenceAssemblyRecord["pageAction"]);
      patternWrap.append(pageText);
    }
    setText("#review-continue-btn", state.currentWeek === 4 ? "完成第一章" : "把这一周写进错题本");
  }

  function renderExam(state: ChapterOneState, mode: GameMode): void {
    const stage = currentExamStage(state);
    if (!stage) return;
    setText("#exam-paper-label", stage.paper);
    setText("#exam-title", stage.title);
    setText("#exam-scene", stage.scene);
    const progressValue = state.exam.step + 1;
    $<HTMLElement>("#exam-progress-fill").style.width = `${(progressValue / 4) * 100}%`;
    const progress = $<HTMLElement>("#exam-progress");
    progress.setAttribute("aria-valuenow", String(progressValue));
    progress.setAttribute("aria-valuetext", `第 ${progressValue} 个局面，共四个`);
    const actions = $("#exam-actions");
    actions.replaceChildren();
    stage.actions.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "exam-action-btn";
      const title = document.createElement("strong");
      title.textContent = action.label;
      const description = document.createElement("small");
      description.textContent = action.description;
      button.append(title, description);
      if (mode === "story") button.title = "方法会影响考场节奏；不会直接指定成绩";
      button.addEventListener("click", () => callbacks.onExamAction(action.id));
      actions.append(button);
    });
    setText("#exam-status", `一模第 ${state.exam.step + 1} 个局面，共四个。`);
  }

  function renderComplete(state: ChapterOneState, progress: LongTermProgress): void {
    const reveal = thirdHandwritingReveal(progress);
    setText("#third-hand-route", reveal.route);
    setText("#third-hand-description", reveal.description);
    setText("#third-hand-writing", reveal.handwriting);
    setText(
      "#chapter-one-exam-summary",
      state.exam.band
        ? `一模记录：${state.exam.band}。${state.exam.note}`
        : "一模记录尚未生成。"
    );
  }

  return {
    renderPlanner,
    renderWeekEvents,
    renderSeatGame,
    renderSentenceGame,
    renderReview,
    renderExam,
    renderComplete
  };
}
