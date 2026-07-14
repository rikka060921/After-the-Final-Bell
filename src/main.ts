import "../styles.css";

import { backgrounds, defaultSettings, initialStats, statMeta } from "./config";
import { endings, resolveEnding } from "./endings";
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
  type GameSettings,
  type GameStats,
  type HistoryEntry,
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

function showNameEntry() {
  hideAllScreens();
  dom.name.classList.add("is-visible");
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
  hideAllScreens();
  dom.hud.classList.add("is-visible");
  dom.dialogue.classList.add("is-visible");
  setBackground("classroom", true);
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
    if (hint) hint.textContent = choice.hint || "";
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
  dom.choices.replaceChildren();
  applyEffects(choice.effects || {});
  autoSave(choice.next);
  setTimeout(() => goTo(choice.next), settings.reducedMotion ? 0 : 260);
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
    toast.textContent = `${meta.label} ${change.delta > 0 ? "+" : ""}${change.delta}`;
    dom.toast.append(toast);
    setTimeout(() => toast.remove(), 3100 + index * 70);
  });
}

function updateStatsUI() {
  $("#quick-study").textContent = String(Math.round(stats.study));
  $("#quick-stress").textContent = String(Math.round(stats.stress));
  $("#quick-bond").textContent = String(Math.round(stats.bond));
  const list = $("#stat-list");
  list.replaceChildren();
  VISIBLE_STAT_KEYS.forEach((key) => {
    const meta = statMeta[key];
    const row = document.createElement("div");
    row.className = "stat-row";
    row.dataset.stat = key;
    row.innerHTML = `<label>${meta.label}</label><div class="stat-track"><div class="stat-fill"></div></div><b>${Math.round(stats[key])}</b>`;
    const fill = row.querySelector<HTMLElement>(".stat-fill");
    if (fill) fill.style.width = `${stats[key]}%`;
    list.append(row);
  });
}

function showEnding() {
  const ending = endings[resolveEnding(stats)];
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
    badge.textContent = `${statMeta[key].label} ${Math.round(stats[key])}`;
    statWrap.append(badge);
  });
  const mutualBadge = document.createElement("span");
  mutualBadge.textContent = `隐藏共担 ${Math.round(stats.mutual)}`;
  statWrap.append(mutualBadge);
  dom.ending.classList.add("is-visible");
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
    settings
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
    applySettings();
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
  hideAllScreens();
  dom.name.classList.add("is-visible");
  $<HTMLInputElement>("#player-name").value = playerName;
}

dom.dialogue.addEventListener("click", advance);
dom.dialogue.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    advance();
  }
});

$("#new-game-btn").addEventListener("click", () => { initAudio(); tone(); showNameEntry(); });
$("#continue-btn").addEventListener("click", () => { initAudio(); loadGame(); });
$("#confirm-name-btn").addEventListener("click", () => { initAudio(); newGame(); });
$<HTMLInputElement>("#player-name").addEventListener("keydown", (event) => { if (event.key === "Enter") newGame(); });
$("#close-notebook-btn").addEventListener("click", () => {
  tone(520, .06, .02);
  dom.notebook.classList.remove("is-visible");
  const next = currentNodeId ? story[currentNodeId]?.next : undefined;
  if (next) goTo(next);
});

$("#stats-btn").addEventListener("click", () => { updateStatsUI(); openPanel("stats-panel"); });
$("#menu-btn").addEventListener("click", () => openPanel("menu-panel"));
$$<HTMLButtonElement>('[data-close]').forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.close) closePanel(button.dataset.close);
}));
$("#save-btn").addEventListener("click", manualSave);
$("#load-btn").addEventListener("click", loadGame);
$("#history-btn").addEventListener("click", () => { renderHistory(); openPanel("history-panel"); });
$("#settings-btn").addEventListener("click", () => openPanel("settings-panel"));
$("#restart-btn").addEventListener("click", showTitle);
$("#replay-btn").addEventListener("click", resetAndReplay);
$("#title-btn").addEventListener("click", showTitle);

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
  if (dom.title.classList.contains("is-visible") || dom.name.classList.contains("is-visible") || dom.ending.classList.contains("is-visible")) return;
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
updateStatsUI();
refreshContinueButton();
showTitle();
