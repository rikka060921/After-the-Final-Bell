import "../styles.css";

import {
  backgrounds,
  GAME_VERSION,
  defaultMode,
  defaultNotebookState,
  defaultSettings,
  initialStats,
  statMeta
} from "./config";
import { demoShareText } from "./demo-release";
import { endings, resolveEnding } from "./endings";
import {
  countNotebookSlots,
  cycleNotebookSlot as cycleNotebookSlotState,
  getNotebookEffects,
  notebookDecisionId,
  notebookSlotLabels
} from "./notebook";
import { createOpeningProfile } from "./opening-profile";
import { currentExamStage, playExamAction } from "./chapter-one/exam";
import { initializeChapterOne } from "./chapter-one/opening";
import { defaultLongTermProgress } from "./chapter-one/persistence";
import {
  advanceAfterReview,
  assignActivity as assignChapterOneActivity,
  resetCurrentWeek,
  resolveCurrentWeek
} from "./chapter-one/schedule";
import { archiveSeatGame, playSeatAction } from "./chapter-one/seat-game";
import { submitSentenceAssembly } from "./chapter-one/sentence";
import { createChapterOneUI, type ChapterOneUI } from "./chapter-one/ui";
import { resolveWeekEventChoice } from "./chapter-one/week-events";
import { initializeChapterTwo } from "./chapter-two/opening";
import { playBusAction } from "./chapter-two/bus";
import { sendAsyncMessage } from "./chapter-two/message";
import { chooseResultFraming } from "./chapter-two/result";
import { createChapterTwoUI, type ChapterTwoUI } from "./chapter-two/ui";
import {
  createSaveData,
  hasStoredSave,
  readManualSave,
  readStoredSave,
  writeManualSave,
  writeStoredSave
} from "./save";
import { applyStatEffects } from "./state";
import { story } from "./story";
import { nextUnreadLinearNode } from "./story-progress";
import { CHAPTER_CATALOG, chapterAvailability } from "./chapter-catalog";
import {
  VISIBLE_STAT_KEYS,
  type BackgroundKey,
  type ChapterOneActivityId,
  type ChapterOneState,
  type ChapterTwoState,
  type EndingId,
  type GameLocation,
  type GameMode,
  type GameSettings,
  type GameStats,
  type HistoryEntry,
  type LongTermProgress,
  type NotebookState,
  type OpeningProfile,
  type PromiseEntry,
  type SeatActionId,
  type SentenceAssemblyRecord,
  type AsyncMessageId,
  type BusActionId,
  type ResultFramingId,
  type SaveDataV4,
  type StatChange,
  type StatEffects,
  type StoryChoice
} from "./types";

const $ = <T extends Element = HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
};
const $$ = <T extends Element = HTMLElement>(selector: string): T[] => [...document.querySelectorAll<T>(selector)];
const find = <T extends Element = HTMLElement>(selector: string): T | null => document.querySelector<T>(selector);

const dom = {
  game: $("#game"),
  background: $("#background"),
  title: $("#title-screen"),
  mode: $("#mode-screen"),
  name: $("#name-screen"),
  hud: $("#hud"),
  dialogue: $("#dialogue-box"),
  speaker: $("#speaker"),
  text: $("#dialogue-text"),
  scene: $("#scene-tag"),
  progress: $("#progress-label"),
  next: $("#next-indicator"),
  chapter: $("#chapter-label"),
  time: $("#time-label"),
  countdown: $("#countdown-label"),
  portrait: $<HTMLImageElement>("#portrait"),
  choices: $("#choices"),
  notebook: $("#notebook-overlay"),
  ending: $("#ending-screen"),
  profile: $("#opening-profile-screen"),
  planner: $("#chapter-one-planner-screen"),
  weekEvents: $("#week-events-screen"),
  seatGame: $("#seat-game-screen"),
  sentenceGame: $("#sentence-game-screen"),
  weekReview: $("#week-review-screen"),
  exam: $("#exam-screen"),
  chapterOneComplete: $("#chapter-one-complete-screen"),
  chapterTwoResult: $("#chapter-two-result-screen"),
  chapterTwoMessage: $("#chapter-two-message-screen"),
  chapterTwoBus: $("#chapter-two-bus-screen"),
  chapterTwoComplete: $("#chapter-two-complete-screen"),
  toast: $("#toast-stack")
};

let playerName = "陈舟";
let stats: GameStats = initialStats();
let currentNodeId: string | null = null;
let currentBackground: BackgroundKey | null = "classroom";
let portraitVisible = false;
let isTyping = false;
let fullText = "";
let typingTimer: ReturnType<typeof setInterval> | number | null = null;
let history: HistoryEntry[] = [];
let readNodeIds: string[] = [];
let inputLocked = false;
let settings: GameSettings = defaultSettings();
let gameMode: GameMode = defaultMode();
let notebook: NotebookState = defaultNotebookState();
let promises: PromiseEntry[] = [];
let decisionIds: string[] = [];
let openingProfile: OpeningProfile | null = null;
let gameLocation: GameLocation = { kind: "story", graphId: "prologue", nodeId: "intro_01" };
let chapterOne: ChapterOneState | null = null;
let chapterTwo: ChapterTwoState | null = null;
let longTermProgress: LongTermProgress = defaultLongTermProgress();
let chapterOneUI: ChapterOneUI;
let chapterTwoUI: ChapterTwoUI;
let audioContext: AudioContext | null = null;

function interpolate(text = ""): string {
  return text.replaceAll("{{player}}", playerName);
}

function storyTarget(nodeId: string): string {
  return settings.skipRead ? nextUnreadLinearNode(story, nodeId, readNodeIds) : nodeId;
}

function initAudio() {
  if (!audioContext) {
    const AudioCtx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) audioContext = new AudioCtx();
  }
}

function tone(frequency = 520, duration = .05, volume = .025) {
  if (!audioContext || settings.reducedMotion) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function hideAllScreens() {
  $$<HTMLElement>(".screen").forEach((el) => {
    el.classList.remove("is-visible");
    el.hidden = true;
    el.inert = true;
  });
}

function revealScreen(screen: HTMLElement, focusSelector?: string) {
  screen.hidden = false;
  screen.inert = false;
  screen.classList.add("is-visible");
  if (focusSelector) {
    requestAnimationFrame(() => screen.querySelector<HTMLElement>(focusSelector)?.focus());
  }
}

function openPanel(id: string) {
  const panel = document.getElementById(id);
  if (!panel) return;
  panel.hidden = false;
  panel.inert = false;
  panel.classList.add("is-visible");
  requestAnimationFrame(() => panel.querySelector<HTMLElement>("button, input, [tabindex]")?.focus());
}

function closePanel(id: string) {
  const panel = document.getElementById(id);
  if (!panel) return;
  panel.classList.remove("is-visible");
  panel.inert = true;
  panel.hidden = true;
}

function closeTransientPanels() {
  $$<HTMLElement>(".side-panel, .modal-panel").forEach((panel) => {
    panel.classList.remove("is-visible");
    panel.inert = true;
    panel.hidden = true;
  });
}

function showTitle() {
  if (typingTimer !== null) clearInterval(typingTimer);
  hideAllScreens();
  closeTransientPanels();
  dom.notebook.classList.remove("is-visible");
  revealScreen(dom.title, "#title-heading");
  dom.hud.classList.remove("is-visible");
  dom.dialogue.classList.remove("is-visible");
  dom.choices.replaceChildren();
  dom.portrait.hidden = true;
  setBackground("classroom", true);
  refreshContinueButton();
}

function applyGameMode() {
  const isCounty = gameMode === "county";
  document.body.classList.toggle("county-mode", isCounty);
  const label = isCounty ? "县中模式" : "故事模式";
  $("#mode-label").textContent = label;
  $("#difficulty-label").textContent = label;
  $("#name-mode-note").textContent = `当前：${label}`;
}

function showModeSelection() {
  hideAllScreens();
  closeTransientPanels();
  revealScreen(dom.mode, "h2");
}

function selectGameMode(mode: GameMode) {
  gameMode = mode;
  applyGameMode();
  showNameEntry();
}

function showNameEntry() {
  hideAllScreens();
  revealScreen(dom.name, "#player-name");
  applyGameMode();
  const field = $<HTMLInputElement>("#player-name");
  field.value = playerName;
  setTimeout(() => field.select(), 80);
}

function newGame() {
  playerName = ($<HTMLInputElement>("#player-name").value || "陈舟").trim().slice(0, 6) || "陈舟";
  stats = initialStats();
  currentNodeId = null;
  currentBackground = "classroom";
  portraitVisible = false;
  history = [];
  readNodeIds = [];
  inputLocked = false;
  notebook = defaultNotebookState();
  promises = [];
  decisionIds = [];
  openingProfile = null;
  chapterOne = null;
  chapterTwo = null;
  longTermProgress = defaultLongTermProgress();
  gameLocation = { kind: "story", graphId: "prologue", nodeId: "intro_01" };
  hideAllScreens();
  dom.hud.classList.add("is-visible");
  dom.dialogue.classList.add("is-visible");
  setBackground("classroom", true);
  applyGameMode();
  updateStatsUI();
  goTo("intro_01");
}

function setBackground(key: BackgroundKey, immediate = false) {
  if (currentBackground === key && !immediate) return;
  currentBackground = key;
  dom.background.style.backgroundImage = `url("${backgrounds[key]}")`;
  if (!immediate) {
    dom.background.classList.remove("scene-shift");
    void dom.background.offsetWidth;
    dom.background.classList.add("scene-shift");
  }
}

function setPortrait(show: boolean, className = "") {
  portraitVisible = show;
  dom.portrait.hidden = !show;
  dom.portrait.className = "portrait" + (className ? ` ${className}` : "");
}

function addHistory(speaker: string, text: string) {
  const last = history[history.length - 1];
  if (last && last.node === currentNodeId) return;
  history.push({ node: currentNodeId ?? "unknown", speaker, text });
  if (history.length > 160) history.shift();
}

function renderHistory() {
  const list = $("#history-list");
  list.replaceChildren();
  if (!history.length) {
    list.innerHTML = "<p class='save-status'>还没有对话记录。</p>";
    return;
  }
  history.forEach((entry) => {
    const row = document.createElement("article");
    row.className = "history-entry";
    const name = document.createElement("strong");
    name.textContent = entry.speaker;
    const text = document.createElement("p");
    text.textContent = entry.text;
    row.append(name, text);
    list.append(row);
  });
  list.scrollTop = list.scrollHeight;
}

function renderNotebook() {
  const wrap = $("#notebook-slots");
  wrap.replaceChildren();
  notebook.slots.forEach((slot, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "notebook-slot";
    button.dataset.slot = slot;
    button.dataset.index = String(index);
    button.textContent = notebookSlotLabels[slot];
    button.setAttribute(
      "aria-label",
      `第${index + 1}格：${notebookSlotLabels[slot]}。点击切换版面用途。`
    );
    button.addEventListener("click", () => cycleNotebookSlot(index));
    wrap.append(button);
  });

  const counts = countNotebookSlots(notebook);
  $("#notebook-summary").textContent =
    `题解 ${counts.solution} 格 · 留言 ${counts.message} 格 · 留白 ${counts.blank} 格`;
}

function cycleNotebookSlot(index: number) {
  notebook = cycleNotebookSlotState(notebook, index);
  renderNotebook();
}

function commitNotebook() {
  if (notebook.committed || !currentNodeId) return;
  const next = story[currentNodeId]?.next;
  if (!next) return;
  notebook.committed = true;
  decisionIds.push(notebookDecisionId(notebook));
  applyEffects(getNotebookEffects(notebook));
  dom.notebook.classList.remove("is-visible");
  autoSave(next);
  goTo(next);
}

function typeText(text: string, onComplete?: () => void) {
  if (typingTimer !== null) clearInterval(typingTimer);
  fullText = text;
  dom.text.textContent = "";
  isTyping = true;
  dom.dialogue.classList.add("waiting");
  dom.next.textContent = "点击显示全文";

  if (settings.reducedMotion || settings.speed >= 42) {
    finishTyping(onComplete);
    return;
  }

  let index = 0;
  const tick = Math.max(12, 50 - settings.speed);
  typingTimer = window.setInterval(() => {
    index += 1;
    dom.text.textContent = fullText.slice(0, index);
    if (index >= fullText.length) finishTyping(onComplete);
  }, tick);
}

function finishTyping(onComplete?: () => void) {
  if (typingTimer !== null) clearInterval(typingTimer);
  typingTimer = null;
  dom.text.textContent = fullText;
  isTyping = false;
  dom.dialogue.classList.remove("waiting");
  dom.next.textContent = "点击继续⌄";
  if (typeof onComplete === "function") onComplete();
}

function goTo(nodeId: string, fromLoad = false) {
  const node = story[nodeId];
  if (!node) {
    console.error("Unknown story node:", nodeId);
    return;
  }
  inputLocked = false;
  currentNodeId = nodeId;
  const wasRead = readNodeIds.includes(nodeId);
  readNodeIds = [...new Set([...readNodeIds, nodeId])].slice(-240);
  gameLocation = { kind: "story", graphId: "prologue", nodeId };
  dom.choices.replaceChildren();
  if (node.bg) setBackground(node.bg);
  if (typeof node.portrait === "boolean") setPortrait(node.portrait, node.portraitClass || "");
  else if (node.portraitClass !== undefined && portraitVisible) setPortrait(true, node.portraitClass);

  const speaker = interpolate(node.speaker || "旁白");
  const text = interpolate(node.text || "");
  dom.speaker.textContent = speaker;
  dom.scene.textContent = node.scene || dom.scene.textContent;
  dom.time.textContent = node.time || dom.time.textContent;
  dom.progress.textContent = `序章 · ${node.step || "--"}${wasRead ? " · 已读" : ""}`;
  dom.chapter.textContent = Number(node.step || 0) >= 21 ? "第三节 · 校门外" : Number(node.step || 0) >= 11 ? "第二节 · 走廊" : "第一节 · 错题本";
  addHistory(speaker, text);

  if (node.overlay === "notebook") {
    dom.text.textContent = text;
    isTyping = false;
    renderNotebook();
    dom.notebook.classList.add("is-visible");
    dom.next.textContent = "查看错题本";
    return;
  }

  typeText(text, () => {
    if (node.choices) revealChoices(node.choices);
    if (node.end) dom.next.textContent = "查看本章结局⌄";
  });

  if (!fromLoad) autoSave();
}

function completeCurrentText() {
  if (!isTyping) return false;
  if (!currentNodeId) return false;
  const node = story[currentNodeId];
  if (!node) return false;
  finishTyping(() => {
    if (node.choices) revealChoices(node.choices);
    if (node.end) dom.next.textContent = "查看本章结局⌄";
  });
  return true;
}

function advance() {
  if (inputLocked || !currentNodeId) return;
  if (completeCurrentText()) return;
  const node = story[currentNodeId];
  if (!node) return;
  if (node.choices || node.overlay) return;
  tone(430, .035, .012);
  if (node.end) {
    showEnding();
    return;
  }
  if (node.next) goTo(storyTarget(node.next));
}

function revealChoices(choices: StoryChoice[]) {
  if (dom.choices.children.length) return;
  dom.next.textContent = "请选择";
  choices.forEach((choice, index) => {
    const button = document.createElement("button");
    button.className = "choice-btn";
    button.style.animationDelay = `${index * 60}ms`;
    button.innerHTML = `<span class="choice-index">${index + 1}</span><span class="choice-copy"></span><span class="choice-hint"></span>`;
    const copy = button.querySelector<HTMLElement>(".choice-copy");
    const hint = button.querySelector<HTMLElement>(".choice-hint");
    if (copy) copy.textContent = interpolate(choice.text);
    if (hint) {
      const readMark = readNodeIds.includes(choice.next) ? " · 已读" : "";
      hint.textContent = gameMode === "story" ? `${choice.hint || ""}${readMark}` : readMark.trim();
    }
    button.addEventListener("click", () => choose(choice));
    dom.choices.append(button);
  });
}

function choose(choice: StoryChoice) {
  if (inputLocked) return;
  inputLocked = true;
  tone(660, .085, .025);
  const choiceText = interpolate(choice.text);
  history.push({ node: `${currentNodeId}-choice`, speaker: "你的选择", text: choiceText });
  const decisionId = choice.id ?? choice.next;
  if (!decisionIds.includes(decisionId)) decisionIds.push(decisionId);
  if (choice.promise) {
    const entry: PromiseEntry = { ...choice.promise, createdAtNode: currentNodeId ?? "choice_pact" };
    promises = [...promises.filter((promise) => promise.id !== entry.id), entry];
    renderLedger();
  }
  dom.choices.replaceChildren();
  applyEffects(choice.effects || {});
  const targetNode = storyTarget(choice.next);
  autoSave(targetNode);
  setTimeout(() => goTo(targetNode), settings.reducedMotion ? 0 : 260);
}

function renderLedger() {
  const list = $("#ledger-list");
  list.replaceChildren();
  if (!promises.length) {
    const empty = document.createElement("p");
    empty.className = "ledger-empty";
    empty.textContent = "还没有写下承诺。空白并不等于失败，它只是尚未占用未来。";
    list.append(empty);
    return;
  }

  promises.forEach((promise) => {
    const article = document.createElement("article");
    article.className = `ledger-entry${promise.status === "withheld" ? " is-withheld" : ""}`;
    const pressure = promise.pressure === "high" ? "负担较高" : promise.pressure === "medium" ? "需要协调" : "负担较低";
    article.innerHTML = `
      <header><strong></strong><em></em></header>
      <p></p>
      <small></small>
    `;
    const title = article.querySelector("strong");
    const badge = article.querySelector("em");
    const summary = article.querySelector("p");
    const cadence = article.querySelector("small");
    if (title) title.textContent = promise.title;
    if (badge) badge.textContent = promise.status === "withheld" ? "保留未约定" : pressure;
    if (summary) summary.textContent = promise.summary;
    if (cadence) cadence.textContent = `占用未来：${promise.cadence}`;
    list.append(article);
  });
}

function applyEffects(effects: StatEffects) {
  const result = applyStatEffects(stats, effects);
  stats = result.stats;
  updateStatsUI();
  showChanges(result.changes);
}

function showChanges(changes: StatChange[]) {
  changes.slice(0, 4).forEach((change, index) => {
    if (change.key === "mutual") return;
    const meta = statMeta[change.key];
    const toast = document.createElement("div");
    const goodDirection = meta.positive ? change.delta > 0 : change.delta < 0;
    toast.className = "toast" + (goodDirection ? "" : " negative");
    toast.style.animationDelay = `${index * 70}ms`;
    toast.textContent = gameMode === "story"
      ? `${meta.label} ${change.delta > 0 ? "+" : ""}${change.delta}`
      : `${meta.label}${change.delta > 0 ? "有所上升" : "有所下降"}`;
    dom.toast.append(toast);
    setTimeout(() => toast.remove(), 3100 + index * 70);
  });
}

function describeStat(value: number): string {
  if (value >= 75) return "很高";
  if (value >= 55) return "偏高";
  if (value >= 35) return "中等";
  if (value >= 15) return "偏低";
  return "很低";
}

function describeQuickStat(key: "study" | "stress" | "bond", value: number): string {
  if (key === "study") return value >= 65 ? "扎实" : value >= 45 ? "尚可" : "吃力";
  if (key === "stress") return value >= 70 ? "绷紧" : value >= 50 ? "偏高" : "尚稳";
  return value >= 30 ? "亲近" : value >= 12 ? "靠近" : "疏远";
}

function updateStatsUI() {
  $("#quick-study").textContent = gameMode === "story" ? String(Math.round(stats.study)) : describeQuickStat("study", stats.study);
  $("#quick-stress").textContent = gameMode === "story" ? String(Math.round(stats.stress)) : describeQuickStat("stress", stats.stress);
  $("#quick-bond").textContent = gameMode === "story" ? String(Math.round(stats.bond)) : describeQuickStat("bond", stats.bond);
  const list = $("#stat-list");
  list.replaceChildren();
  VISIBLE_STAT_KEYS.forEach((key) => {
    const meta = statMeta[key];
    const row = document.createElement("div");
    row.className = "stat-row";
    row.dataset.stat = key;
    const displayValue = gameMode === "story" ? String(Math.round(stats[key])) : describeStat(stats[key]);
    row.innerHTML = `<label>${meta.label}</label><div class="stat-track"><div class="stat-fill"></div></div><b>${displayValue}</b>`;
    const fill = row.querySelector<HTMLElement>(".stat-fill");
    const displayWidth = gameMode === "story" ? stats[key] : Math.ceil(stats[key] / 25) * 25;
    if (fill) fill.style.width = `${displayWidth}%`;
    list.append(row);
  });
}

function buildOpeningProfile(endingId: EndingId): OpeningProfile {
  return createOpeningProfile({
    playerName,
    mode: gameMode,
    endingId,
    stats,
    notebook,
    promises,
    decisionIds
  });
}

function renderOpeningProfile() {
  if (!openingProfile) return;
  const summary = $("#opening-summary");
  summary.replaceChildren();
  openingProfile.summary.forEach((text) => {
    const item = document.createElement("span");
    item.textContent = text;
    summary.append(item);
  });

  const promiseWrap = $("#opening-promise");
  promiseWrap.replaceChildren();
  const promise = openingProfile.promises[0];
  const title = document.createElement("strong");
  const body = document.createElement("p");
  if (promise) {
    title.textContent = promise.status === "withheld" ? "未写下的约定" : `承诺：${promise.title}`;
    body.textContent = `${promise.summary} 第一章占用：${promise.cadence}`;
  } else {
    title.textContent = "承诺账本仍为空";
    body.textContent = "第一章不会替你补上一句从未说出口的话。";
  }
  promiseWrap.append(title, body);
}

function showOpeningProfile() {
  if (!openingProfile) openingProfile = buildOpeningProfile(resolveEnding(stats));
  gameLocation = { kind: "opening-profile" };
  hideAllScreens();
  closeTransientPanels();
  dom.hud.classList.remove("is-visible");
  dom.dialogue.classList.remove("is-visible");
  renderOpeningProfile();
  revealScreen(dom.profile, "#profile-title");
  autoSave();
}

function showEnding() {
  const endingId = resolveEnding(stats);
  const ending = endings[endingId];
  openingProfile = buildOpeningProfile(endingId);
  hideAllScreens();
  closeTransientPanels();
  dom.hud.classList.remove("is-visible");
  dom.dialogue.classList.remove("is-visible");
  dom.choices.replaceChildren();
  dom.portrait.hidden = true;
  $("#ending-title").textContent = ending.title;
  $("#ending-quote").textContent = ending.quote;
  $("#ending-body").textContent = ending.body;
  const statWrap = $("#ending-stats");
  statWrap.replaceChildren();
  (["study", "stress", "agency", "bond", "risk", "rebellion"] as const).forEach((key) => {
    const badge = document.createElement("span");
    badge.textContent = `${statMeta[key].label} ${gameMode === "story" ? Math.round(stats[key]) : describeStat(stats[key])}`;
    statWrap.append(badge);
  });
  const mutualBadge = document.createElement("span");
  mutualBadge.textContent = `隐藏共担 ${gameMode === "story" ? Math.round(stats.mutual) : describeStat(stats.mutual)}`;
  statWrap.append(mutualBadge);
  revealScreen(dom.ending, "#ending-title");
  autoSave();
  tone(760, .45, .035);
}

function chapterLocationForState(state: ChapterOneState): GameLocation {
  if (state.phase === "planning") return { kind: "chapter-one-planner", week: state.currentWeek };
  if (state.phase === "week-events") return { kind: "chapter-one-events", week: state.currentWeek };
  if (state.phase === "seat-game") return { kind: "chapter-one-seat" };
  if (state.phase === "sentence-game") return { kind: "chapter-one-sentence" };
  if (state.phase === "review") return { kind: "chapter-one-review", week: state.currentWeek };
  if (state.phase === "exam") return { kind: "chapter-one-exam" };
  return { kind: "chapter-one-complete" };
}

function chapterTwoLocationForState(state: ChapterTwoState): GameLocation {
  if (state.phase === "result-letter") return { kind: "chapter-two-result" };
  if (state.phase === "async-message") return { kind: "chapter-two-message" };
  if (state.phase === "bus-route") return { kind: "chapter-two-bus" };
  return { kind: "chapter-two-complete" };
}

function showChapterOneState(save = true) {
  if (!chapterOne || !openingProfile) return;
  if (typingTimer !== null) clearInterval(typingTimer);
  hideAllScreens();
  closeTransientPanels();
  dom.notebook.classList.remove("is-visible");
  dom.hud.classList.remove("is-visible");
  dom.dialogue.classList.remove("is-visible");
  dom.choices.replaceChildren();
  dom.portrait.hidden = true;
  setBackground("classroom", true);
  gameLocation = chapterLocationForState(chapterOne);

  if (chapterOne.phase === "planning") {
    chapterOneUI.renderPlanner(chapterOne, openingProfile, gameMode, longTermProgress);
    revealScreen(dom.planner, "#planner-title");
  } else if (chapterOne.phase === "week-events") {
    chapterOneUI.renderWeekEvents(chapterOne, longTermProgress, gameMode);
    revealScreen(dom.weekEvents, "#week-event-title");
  } else if (chapterOne.phase === "seat-game") {
    chapterOneUI.renderSeatGame(chapterOne);
    revealScreen(dom.seatGame, "#seat-game-title");
  } else if (chapterOne.phase === "sentence-game") {
    chapterOneUI.renderSentenceGame(longTermProgress, gameMode);
    revealScreen(dom.sentenceGame, "#sentence-title");
  } else if (chapterOne.phase === "review") {
    chapterOneUI.renderReview(chapterOne, longTermProgress);
    revealScreen(dom.weekReview, "#review-title");
  } else if (chapterOne.phase === "exam") {
    chapterOneUI.renderExam(chapterOne, gameMode);
    revealScreen(dom.exam, "#exam-title");
  } else {
    chapterOneUI.renderComplete(chapterOne, longTermProgress);
    revealScreen(dom.chapterOneComplete, "#chapter-complete-title");
  }
  if (save) autoSave();
}

function showChapterTwoState(save = true) {
  if (!chapterTwo || !openingProfile) return;
  if (typingTimer !== null) clearInterval(typingTimer);
  hideAllScreens();
  closeTransientPanels();
  dom.notebook.classList.remove("is-visible");
  dom.hud.classList.remove("is-visible");
  dom.dialogue.classList.remove("is-visible");
  dom.choices.replaceChildren();
  dom.portrait.hidden = true;
  setBackground("gate", true);
  gameLocation = chapterTwoLocationForState(chapterTwo);
  if (chapterTwo.phase === "result-letter") {
    chapterTwoUI.renderResult(chapterTwo, gameMode);
    revealScreen(dom.chapterTwoResult, "#chapter-two-result-title");
  } else if (chapterTwo.phase === "async-message") {
    chapterTwoUI.renderMessage(chapterTwo);
    revealScreen(dom.chapterTwoMessage, "#chapter-two-message-title");
  } else if (chapterTwo.phase === "bus-route") {
    chapterTwoUI.renderBus(chapterTwo);
    revealScreen(dom.chapterTwoBus, "#chapter-two-bus-title");
  } else {
    chapterTwoUI.renderComplete(chapterTwo);
    revealScreen(dom.chapterTwoComplete, "#chapter-two-complete-title");
  }
  if (save) autoSave();
}

function startChapterOne() {
  if (!openingProfile) return;
  if (!chapterOne) {
    const initialized = initializeChapterOne(openingProfile);
    chapterOne = initialized.chapterOne;
    longTermProgress = initialized.progress;
  }
  tone(620, .12, .025);
  showChapterOneState();
}

function startChapterTwo() {
  if (!openingProfile || !chapterOne) return;
  if (!chapterTwo) {
    try {
      chapterTwo = initializeChapterTwo(chapterOne, longTermProgress, stats);
    } catch (error) {
      $("#chapter-two-complete-summary").textContent = error instanceof Error ? error.message : "第二章暂时无法开始。";
      return;
    }
  }
  tone(620, .12, .025);
  showChapterTwoState();
}

function handleChapterAssignment(slotId: string, activityId: ChapterOneActivityId) {
  if (!chapterOne) return;
  chapterOne = assignChapterOneActivity(chapterOne, slotId, activityId);
  autoSave();
  chapterOneUI.renderPlanner(chapterOne, openingProfile!, gameMode, longTermProgress);
  requestAnimationFrame(() =>
    dom.planner.querySelector<HTMLButtonElement>(`[data-slot-id="${slotId}"]`)?.focus()
  );
}

function handleChapterReset() {
  if (!chapterOne || !openingProfile) return;
  chapterOne = resetCurrentWeek(chapterOne);
  autoSave();
  chapterOneUI.renderPlanner(chapterOne, openingProfile, gameMode, longTermProgress);
  $("#schedule-status").textContent = "已恢复本周开始时的承诺与人物安排，其余格重新留白。";
}

function handleChapterCommit() {
  if (!chapterOne) return;
  try {
    const resolved = resolveCurrentWeek(chapterOne, longTermProgress, stats);
    chapterOne = resolved.chapterOne;
    longTermProgress = resolved.progress;
    stats = resolved.stats;
    updateStatsUI();
    tone(690, .15, .025);
    showChapterOneState();
  } catch (error) {
    $("#schedule-status").textContent = error instanceof Error ? error.message : "无法开始这一周。";
  }
}

function handleWeekEventChoice(choiceId: string) {
  if (!chapterOne) return;
  try {
    const resolved = resolveWeekEventChoice(chapterOne, longTermProgress, stats, choiceId);
    chapterOne = resolved.chapterOne;
    longTermProgress = resolved.progress;
    stats = resolved.stats;
    updateStatsUI();
    tone(560, .08, .018);
    showChapterOneState();
  } catch (error) {
    $("#week-event-status").textContent = error instanceof Error ? error.message : "当前行动无法执行。";
  }
}

function handleSeatAction(actionId: SeatActionId) {
  if (!chapterOne) return;
  chapterOne = playSeatAction(chapterOne, actionId);
  autoSave();
  chapterOneUI.renderSeatGame(chapterOne);
  requestAnimationFrame(() => {
    const target = chapterOne?.seatGame.resolved ? $("#seat-finish-btn") : find("#seat-action-list button");
    (target as HTMLElement | null)?.focus();
  });
}

function handleSeatFinish() {
  if (!chapterOne) return;
  const archived = archiveSeatGame(chapterOne, longTermProgress);
  chapterOne = archived.chapterOne;
  longTermProgress = archived.progress;
  showChapterOneState();
}

function handleSentenceSubmit(
  fragmentIds: string[],
  pageAction: SentenceAssemblyRecord["pageAction"]
) {
  if (!chapterOne) return;
  try {
    const submitted = submitSentenceAssembly(
      chapterOne,
      longTermProgress,
      fragmentIds,
      pageAction
    );
    chapterOne = submitted.chapterOne;
    longTermProgress = submitted.progress;
    tone(580, .12, .02);
    showChapterOneState();
  } catch (error) {
    $("#sentence-status").textContent = error instanceof Error ? error.message : "这句话还不能写下。";
  }
}

function handleReviewContinue() {
  if (!chapterOne) return;
  try {
    const advanced = advanceAfterReview(chapterOne, longTermProgress);
    chapterOne = advanced.chapterOne;
    longTermProgress = advanced.progress;
    tone(640, .13, .02);
    showChapterOneState();
  } catch (error) {
    console.warn("Cannot advance chapter-one review", error);
  }
}

function handleExamAction(actionId: string) {
  if (!chapterOne) return;
  try {
    const resolved = playExamAction(chapterOne, longTermProgress, stats, actionId);
    chapterOne = resolved.chapterOne;
    longTermProgress = resolved.progress;
    stats = resolved.stats;
    updateStatsUI();
    tone(500, .06, .015);
    if (chapterOne.phase === "exam") {
      gameLocation = { kind: "chapter-one-exam" };
      autoSave();
      chapterOneUI.renderExam(chapterOne, gameMode);
      requestAnimationFrame(() => find<HTMLButtonElement>("#exam-actions button")?.focus());
    } else {
      showChapterOneState();
    }
  } catch (error) {
    $("#exam-status").textContent = error instanceof Error ? error.message : "这个考场动作现在不可用。";
  }
}

function handleChapterTwoFraming(framingId: ResultFramingId) {
  if (!chapterTwo) return;
  try {
    const result = chooseResultFraming(chapterTwo, longTermProgress, stats, framingId);
    chapterTwo = result.chapterTwo;
    longTermProgress = result.progress;
    stats = result.stats;
    updateStatsUI();
    showChapterTwoState();
  } catch (error) {
    $("#chapter-two-result-status").textContent = error instanceof Error ? error.message : "这份成绩单还不能这样解释。";
  }
}

function handleChapterTwoMessage(messageId: AsyncMessageId) {
  if (!chapterTwo) return;
  try {
    const result = sendAsyncMessage(chapterTwo, longTermProgress, stats, messageId);
    chapterTwo = result.chapterTwo;
    longTermProgress = result.progress;
    stats = result.stats;
    updateStatsUI();
    showChapterTwoState();
  } catch (error) {
    $("#chapter-two-message-status").textContent = error instanceof Error ? error.message : "这条留言还不能发送。";
  }
}

function handleChapterTwoBusAction(actionId: BusActionId) {
  if (!chapterTwo) return;
  try {
    const result = playBusAction(chapterTwo, longTermProgress, stats, actionId);
    chapterTwo = result.chapterTwo;
    longTermProgress = result.progress;
    stats = result.stats;
    updateStatsUI();
    showChapterTwoState();
  } catch (error) {
    $("#chapter-two-bus-status").textContent = error instanceof Error ? error.message : "这条路线现在不可用。";
  }
}

async function copyDemoSummary(): Promise<void> {
  if (!chapterTwo || chapterTwo.phase !== "complete") return;
  const summary = demoShareText(chapterTwo, playerName);
  const status = $("#demo-copy-status");
  const fallback = $<HTMLTextAreaElement>("#demo-copy-fallback");
  fallback.value = summary;
  fallback.hidden = true;
  try {
    if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
    await Promise.race([
      navigator.clipboard.writeText(summary),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Clipboard request timed out")), 800);
      })
    ]);
    status.textContent = "试玩总结已复制，可以直接粘贴分享。";
    tone(760, .08, .025);
  } catch {
    fallback.hidden = false;
    fallback.focus();
    fallback.select();
    status.textContent = "浏览器没有允许自动复制，已选中下方文字，请按 Ctrl+C。";
  }
}

function saveChapterOneNow() {
  autoSave();
  $("#schedule-status").textContent = "第一章进度已保存。";
  tone(720, .1, .02);
}

function savePayload(nextNode: string | null = null) {
  const location: GameLocation = nextNode
    ? { kind: "story", graphId: "prologue", nodeId: nextNode }
    : gameLocation;
  const nodeId = location.kind === "story" ? location.nodeId : currentNodeId;
  return createSaveData({
    playerName,
    stats,
    currentNodeId: nodeId,
    currentBackground: currentBackground ?? "classroom",
    portraitVisible,
    sceneLabel: dom.scene.textContent ?? "",
    timeLabel: dom.time.textContent ?? "",
    history,
    settings,
    readNodeIds,
    mode: gameMode,
    notebook,
    promises,
    decisionIds,
    openingProfile,
    location,
    chapterOne,
    chapterTwo,
    progress: longTermProgress
  });
}

function autoSave(nextNode: string | null = null) {
  try {
    writeStoredSave(localStorage, savePayload(nextNode));
    refreshContinueButton();
  } catch (error) {
    console.warn("Autosave failed", error);
  }
}

function manualSave() {
  autoSave();
  $("#save-status").textContent = `已保存 · ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
  tone(720, .12, .02);
}

function locationLabel(location: GameLocation): string {
  if (location.kind === "story") return `序章 · ${story[location.nodeId]?.step ?? "--"}`;
  if (location.kind === "opening-profile") return "第一章 · 开局档案";
  if (location.kind === "chapter-one-planner") return `第一章 · 第${location.week}周排程`;
  if (location.kind === "chapter-one-events") return `第一章 · 第${location.week}周执行`;
  if (location.kind === "chapter-one-seat") return "第一章 · 座位路线";
  if (location.kind === "chapter-one-sentence") return "第一章 · 句子拼装";
  if (location.kind === "chapter-one-review") return `第一章 · 第${location.week}周复盘`;
  if (location.kind === "chapter-one-exam") return "第一章 · 一模";
  if (location.kind === "chapter-one-complete") return "第一章 · 章末";
  if (location.kind === "chapter-two-result") return "第二章 · 成绩单";
  if (location.kind === "chapter-two-message") return "第二章 · 异步留言";
  if (location.kind === "chapter-two-bus") return "第二章 · 错峰公交";
  return "第二章 · 章末";
}

function renderSaveSlots() {
  const list = $("#save-slot-list");
  list.replaceChildren();
  (["slot-1", "slot-2", "slot-3"] as const).forEach((slot) => {
    const save = readManualSave(localStorage, story, slot);
    const card = document.createElement("article");
    card.className = "save-slot";
    const copy = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = `槽位 ${slot.slice(-1)}`;
    const detail = document.createElement("p");
    detail.textContent = save
      ? `${locationLabel(save.location)} · ${new Date(save.savedAt).toLocaleString("zh-CN", { hour12: false })}`
      : "空槽位 · 尚未保存";
    copy.append(title, detail);
    const actions = document.createElement("div");
    actions.className = "save-slot-actions";
    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "primary-btn";
    saveButton.textContent = "保存到这里";
    saveButton.addEventListener("click", () => {
      writeManualSave(localStorage, savePayload(), slot);
      renderSaveSlots();
      $("#save-status").textContent = `已保存到槽位 ${slot.slice(-1)}。`;
      tone(720, .12, .02);
    });
    const loadButton = document.createElement("button");
    loadButton.type = "button";
    loadButton.className = "ghost-btn";
    loadButton.textContent = "读取";
    loadButton.disabled = !save;
    loadButton.addEventListener("click", () => {
      const latest = readManualSave(localStorage, story, slot);
      if (!latest) {
        renderSaveSlots();
        return;
      }
      closePanel("save-slots-panel");
      applyLoadedSave(latest);
    });
    actions.append(saveButton, loadButton);
    card.append(copy, actions);
    list.append(card);
  });
}

function renderChapterCatalog() {
  const list = $("#chapter-catalog-list");
  list.replaceChildren();
  CHAPTER_CATALOG.forEach((chapter) => {
    const status = chapterAvailability(longTermProgress.facts, chapter);
    const entry = document.createElement("article");
    entry.className = `chapter-catalog-entry${status === "locked" ? " is-locked" : ""}`;
    const copy = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = `${chapter.label} · ${chapter.title}`;
    const summary = document.createElement("p");
    summary.textContent = chapter.summary;
    const state = document.createElement("small");
    state.textContent = status === "locked" ? "完成前置章节后解锁" : status === "in-development" ? "已解锁 · 当前版本开发中" : "可玩";
    copy.append(title, summary, state);
    const action = document.createElement("button");
    action.type = "button";
    const canEnter =
      chapter.id === "prologue" ||
      (chapter.id === "chapter-one" && Boolean(openingProfile)) ||
      (chapter.id === "chapter-two" && chapterOne?.phase === "complete");
    action.className = status === "locked" || !canEnter ? "ghost-btn" : "primary-btn";
    action.disabled = status === "locked" || !canEnter;
    action.textContent = chapter.id === "prologue"
      ? "重新开始"
      : chapter.id === "chapter-one"
        ? "进入第一章"
        : chapter.id === "chapter-two"
          ? "进入第二章"
          : "开发中";
    action.addEventListener("click", () => {
      closePanel("chapter-catalog-panel");
      if (chapter.id === "prologue") resetAndReplay();
      else if (chapter.id === "chapter-one" && openingProfile) startChapterOne();
      else if (chapter.id === "chapter-two" && chapterOne?.phase === "complete") startChapterTwo();
    });
    entry.append(copy, action);
    list.append(entry);
  });
}

function applyLoadedSave(save: SaveDataV4) {
    playerName = save.playerName || "陈舟";
    stats = { ...initialStats(), ...save.stats };
    history = save.history;
    readNodeIds = save.readNodeIds;
    settings = { ...defaultSettings(), ...save.settings };
    gameMode = save.mode;
    notebook = save.notebook;
    promises = save.promises;
    decisionIds = save.decisionIds;
    openingProfile = save.openingProfile;
    chapterOne = save.chapterOne;
    chapterTwo = save.chapterTwo;
    longTermProgress = save.progress;
    gameLocation = save.location;
    currentNodeId = save.currentNodeId;
    applySettings();
    applyGameMode();
    hideAllScreens();
    closeTransientPanels();
    currentBackground = null;
    setBackground(save.currentBackground || "classroom", true);
    setPortrait(Boolean(save.portraitVisible));
    updateStatsUI();
    renderLedger();

    if (save.location.kind === "story") {
      dom.hud.classList.add("is-visible");
      dom.dialogue.classList.add("is-visible");
      const loadedStep = Number(story[save.location.nodeId]?.step || 0);
      dom.scene.textContent = save.sceneLabel || (loadedStep >= 21 ? "学校东门外" : loadedStep >= 11 ? "三楼东走廊" : "高三（7）班");
      dom.time.textContent = save.timeLabel || (loadedStep >= 21 ? "周四 · 21:58" : loadedStep >= 11 ? "周四 · 21:48" : "周四 · 21:37");
      goTo(save.location.nodeId, true);
    } else if (save.location.kind === "opening-profile") {
      showOpeningProfile();
    } else if (chapterTwo && openingProfile && save.location.kind.startsWith("chapter-two-")) {
      showChapterTwoState(false);
    } else if (chapterOne && openingProfile) {
      showChapterOneState(false);
    } else if (openingProfile) {
      showOpeningProfile();
    } else {
      showTitle();
    }
    tone(560, .09, .02);
}

function loadGame() {
  try {
    const save = readStoredSave(localStorage, story);
    if (!save) return;
    applyLoadedSave(save);
  } catch (error) {
    console.warn("Load failed", error);
    refreshContinueButton();
  }
}

function refreshContinueButton() {
  $<HTMLButtonElement>("#continue-btn").disabled = !hasStoredSave(localStorage, story);
}

function applySettings() {
  document.documentElement.style.setProperty("--font-size", `${settings.fontSize}px`);
  document.body.classList.toggle("reduced-motion", settings.reducedMotion);
  $<HTMLInputElement>("#speed-range").value = String(settings.speed);
  $<HTMLInputElement>("#font-range").value = String(settings.fontSize);
  $<HTMLInputElement>("#motion-toggle").checked = settings.reducedMotion;
  $<HTMLInputElement>("#skip-read-toggle").checked = settings.skipRead;
}

function resetAndReplay() {
  showModeSelection();
  $<HTMLInputElement>("#player-name").value = playerName;
}

chapterOneUI = createChapterOneUI({
  onAssign: handleChapterAssignment,
  onResetWeek: handleChapterReset,
  onCommitWeek: handleChapterCommit,
  onWeekEventChoice: handleWeekEventChoice,
  onSave: saveChapterOneNow,
  onReturnTitle: showTitle,
  onSeatAction: handleSeatAction,
  onSeatFinish: handleSeatFinish,
  onSentenceSubmit: handleSentenceSubmit,
  onReviewContinue: handleReviewContinue,
  onExamAction: handleExamAction,
  onReplay: resetAndReplay
});

chapterTwoUI = createChapterTwoUI({
  onResultFraming: handleChapterTwoFraming,
  onMessage: handleChapterTwoMessage,
  onBusAction: handleChapterTwoBusAction,
  onCopySummary: () => { void copyDemoSummary(); },
  onReplay: resetAndReplay,
  onReturnTitle: showTitle
});

dom.dialogue.addEventListener("click", advance);
dom.dialogue.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    advance();
  }
});

$("#new-game-btn").addEventListener("click", () => { initAudio(); tone(); showModeSelection(); });
$("#continue-btn").addEventListener("click", () => { initAudio(); loadGame(); });
$<HTMLButtonElement>("[data-mode=\"story\"]").addEventListener("click", () => selectGameMode("story"));
$<HTMLButtonElement>("[data-mode=\"county\"]").addEventListener("click", () => selectGameMode("county"));
$("#confirm-name-btn").addEventListener("click", () => { initAudio(); newGame(); });
$<HTMLInputElement>("#player-name").addEventListener("keydown", (event) => { if (event.key === "Enter") newGame(); });
$("#close-notebook-btn").addEventListener("click", () => {
  tone(520, .06, .02);
  commitNotebook();
});

$("#stats-btn").addEventListener("click", () => { updateStatsUI(); openPanel("stats-panel"); });
$("#menu-btn").addEventListener("click", () => openPanel("menu-panel"));
$$<HTMLButtonElement>('[data-close]').forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.close) closePanel(button.dataset.close);
}));
$("#save-btn").addEventListener("click", manualSave);
$("#load-btn").addEventListener("click", loadGame);
$("#history-btn").addEventListener("click", () => { renderHistory(); openPanel("history-panel"); });
$("#ledger-btn").addEventListener("click", () => { renderLedger(); openPanel("ledger-panel"); });
$("#save-slots-btn").addEventListener("click", () => { renderSaveSlots(); openPanel("save-slots-panel"); });
$("#title-catalog-btn").addEventListener("click", () => { renderChapterCatalog(); openPanel("chapter-catalog-panel"); });
$("#menu-catalog-btn").addEventListener("click", () => { renderChapterCatalog(); openPanel("chapter-catalog-panel"); });
$("#settings-btn").addEventListener("click", () => openPanel("settings-panel"));
$("#restart-btn").addEventListener("click", showTitle);
$("#replay-btn").addEventListener("click", resetAndReplay);
$("#title-btn").addEventListener("click", showTitle);
$("#carry-forward-btn").addEventListener("click", showOpeningProfile);
$("#profile-start-btn").addEventListener("click", startChapterOne);
$("#chapter-two-start-btn").addEventListener("click", startChapterTwo);
$("#profile-replay-btn").addEventListener("click", resetAndReplay);
$("#profile-title-btn").addEventListener("click", showTitle);

$<HTMLInputElement>("#speed-range").addEventListener("input", (event) => {
  settings.speed = Number((event.currentTarget as HTMLInputElement).value);
  autoSave();
});
$<HTMLInputElement>("#font-range").addEventListener("input", (event) => {
  settings.fontSize = Number((event.currentTarget as HTMLInputElement).value);
  applySettings();
  autoSave();
});
$<HTMLInputElement>("#motion-toggle").addEventListener("change", (event) => {
  settings.reducedMotion = (event.currentTarget as HTMLInputElement).checked;
  applySettings();
  autoSave();
});
$<HTMLInputElement>("#skip-read-toggle").addEventListener("change", (event) => {
  settings.skipRead = (event.currentTarget as HTMLInputElement).checked;
  autoSave();
});

document.addEventListener("keydown", (event) => {
  const target = event.target as Element | null;
  const standaloneScreenVisible =
    dom.title.classList.contains("is-visible") ||
    dom.mode.classList.contains("is-visible") ||
    dom.name.classList.contains("is-visible") ||
    dom.ending.classList.contains("is-visible") ||
    dom.profile.classList.contains("is-visible") ||
    Boolean(find(".chapter-screen.is-visible"));
  if (event.key === "Escape") {
    if (find("dialog[open]")) return;
    const open = find(".side-panel.is-visible, .modal-panel.is-visible");
    if (open?.id) closePanel(open.id);
    else if (!standaloneScreenVisible) openPanel("menu-panel");
    return;
  }
  if (target?.closest("input, button, select, textarea, dialog") || standaloneScreenVisible) return;
  if (event.key.toLowerCase() === "s") { manualSave(); return; }
  if (event.key.toLowerCase() === "l") { loadGame(); return; }
  const number = Number(event.key);
  if (number >= 1 && number <= dom.choices.children.length) {
    (dom.choices.children.item(number - 1) as HTMLButtonElement | null)?.click();
    return;
  }
  if ((event.key === "Enter" || event.key === " ") && !find(".side-panel.is-visible, .modal-panel.is-visible, .overlay.is-visible")) {
    event.preventDefault();
    advance();
  }
});

Object.values(backgrounds).forEach((src) => { const image = new Image(); image.src = src; });
$("#title-version").textContent = `公开试玩版 · v${GAME_VERSION}`;
$("#demo-version").textContent = `PUBLIC DEMO · v${GAME_VERSION}`;
applySettings();
applyGameMode();
updateStatsUI();
renderLedger();
renderNotebook();
refreshContinueButton();
showTitle();
