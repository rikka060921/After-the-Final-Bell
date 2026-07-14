import "../styles.css";

import {
  backgrounds,
  defaultMode,
  defaultNotebookState,
  defaultSettings,
  initialStats,
  statMeta
} from "./config";
import { endings, resolveEnding } from "./endings";
import {
  countNotebookSlots,
  cycleNotebookSlot as cycleNotebookSlotState,
  getNotebookEffects,
  notebookDecisionId,
  notebookSlotLabels
} from "./notebook";
import { createOpeningProfile } from "./opening-profile";
import {
  createSaveData,
  hasStoredSave,
  readStoredSave,
  writeStoredSave
} from "./save";
import { applyStatEffects } from "./state";
import { story } from "./story";
import {
  VISIBLE_STAT_KEYS,
  type BackgroundKey,
  type EndingId,
  type GameMode,
  type GameSettings,
  type GameStats,
  type HistoryEntry,
  type NotebookState,
  type OpeningProfile,
  type PromiseEntry,
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
let inputLocked = false;
let settings: GameSettings = defaultSettings();
let gameMode: GameMode = defaultMode();
let notebook: NotebookState = defaultNotebookState();
let promises: PromiseEntry[] = [];
let decisionIds: string[] = [];
let openingProfile: OpeningProfile | null = null;
let audioContext: AudioContext | null = null;

function interpolate(text = ""): string {
  return text.replaceAll("{{player}}", playerName);
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
  $$(".screen").forEach((el) => el.classList.remove("is-visible"));
}

function openPanel(id: string) {
  document.getElementById(id)?.classList.add("is-visible");
}

function closePanel(id: string) {
  document.getElementById(id)?.classList.remove("is-visible");
}

function closeTransientPanels() {
  $$(".side-panel, .modal-panel").forEach((panel) => panel.classList.remove("is-visible"));
}

function showTitle() {
  if (typingTimer !== null) clearInterval(typingTimer);
  hideAllScreens();
  closeTransientPanels();
  dom.notebook.classList.remove("is-visible");
  dom.title.classList.add("is-visible");
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
  dom.mode.classList.add("is-visible");
}

function selectGameMode(mode: GameMode) {
  gameMode = mode;
  applyGameMode();
  showNameEntry();
}

function showNameEntry() {
  hideAllScreens();
  dom.name.classList.add("is-visible");
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
  inputLocked = false;
  notebook = defaultNotebookState();
  promises = [];
  decisionIds = [];
  openingProfile = null;
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
  dom.choices.replaceChildren();
  if (node.bg) setBackground(node.bg);
  if (typeof node.portrait === "boolean") setPortrait(node.portrait, node.portraitClass || "");
  else if (node.portraitClass !== undefined && portraitVisible) setPortrait(true, node.portraitClass);

  const speaker = interpolate(node.speaker || "旁白");
  const text = interpolate(node.text || "");
  dom.speaker.textContent = speaker;
  dom.scene.textContent = node.scene || dom.scene.textContent;
  dom.time.textContent = node.time || dom.time.textContent;
  dom.progress.textContent = `序章 · ${node.step || "--"}`;
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
  if (node.next) goTo(node.next);
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
    if (hint) hint.textContent = gameMode === "story" ? choice.hint || "" : "";
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
  autoSave(choice.next);
  setTimeout(() => goTo(choice.next), settings.reducedMotion ? 0 : 260);
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
  hideAllScreens();
  closeTransientPanels();
  dom.hud.classList.remove("is-visible");
  dom.dialogue.classList.remove("is-visible");
  renderOpeningProfile();
  dom.profile.classList.add("is-visible");
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
  dom.ending.classList.add("is-visible");
  autoSave();
  tone(760, .45, .035);
}

function savePayload(nextNode: string | null = null) {
  const nodeId = nextNode ?? currentNodeId;
  if (!nodeId) throw new Error("Cannot save before a story node is active");
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
    mode: gameMode,
    notebook,
    promises,
    decisionIds,
    openingProfile
  });
}

function autoSave(nextNode: string | null = null) {
  if (!currentNodeId && !nextNode) return;
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

function loadGame() {
  try {
    const save = readStoredSave(localStorage, story);
    if (!save) return;
    playerName = save.playerName || "陈舟";
    stats = { ...initialStats(), ...save.stats };
    history = save.history;
    settings = { ...defaultSettings(), ...save.settings };
    gameMode = save.mode;
    notebook = save.notebook;
    promises = save.promises;
    decisionIds = save.decisionIds;
    openingProfile = save.openingProfile;
    applySettings();
    applyGameMode();
    hideAllScreens();
    closeTransientPanels();
    dom.hud.classList.add("is-visible");
    dom.dialogue.classList.add("is-visible");
    currentBackground = null;
    setBackground(save.currentBackground || "classroom", true);
    setPortrait(Boolean(save.portraitVisible));
    const loadedStep = Number(story[save.currentNodeId]?.step || 0);
    dom.scene.textContent = save.sceneLabel || (loadedStep >= 21 ? "学校东门外" : loadedStep >= 11 ? "三楼东走廊" : "高三（7）班");
    dom.time.textContent = save.timeLabel || (loadedStep >= 21 ? "周四 · 21:58" : loadedStep >= 11 ? "周四 · 21:48" : "周四 · 21:37");
    updateStatsUI();
    renderLedger();
    goTo(save.currentNodeId, true);
    tone(560, .09, .02);
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
}

function resetAndReplay() {
  showModeSelection();
  $<HTMLInputElement>("#player-name").value = playerName;
}

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
$("#settings-btn").addEventListener("click", () => openPanel("settings-panel"));
$("#restart-btn").addEventListener("click", showTitle);
$("#replay-btn").addEventListener("click", resetAndReplay);
$("#title-btn").addEventListener("click", showTitle);
$("#carry-forward-btn").addEventListener("click", showOpeningProfile);
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

document.addEventListener("keydown", (event) => {
  if (
    dom.title.classList.contains("is-visible") ||
    dom.mode.classList.contains("is-visible") ||
    dom.name.classList.contains("is-visible") ||
    dom.ending.classList.contains("is-visible") ||
    dom.profile.classList.contains("is-visible")
  ) return;
  if (event.key === "Escape") {
    const open = find(".side-panel.is-visible, .modal-panel.is-visible");
    if (open) open.classList.remove("is-visible");
    else openPanel("menu-panel");
    return;
  }
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
applySettings();
applyGameMode();
updateStatsUI();
renderLedger();
renderNotebook();
refreshContinueButton();
showTitle();
