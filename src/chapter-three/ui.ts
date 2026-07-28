import type {
  ChapterThreeState,
  GameMode,
  InvestigationLeadId,
  PrivacyChoiceId,
  TestimonyId
} from "../types";
import { INVESTIGATION_LEADS, PRIVACY_CHOICES, testimony } from "./model";

const $ = <T extends Element = HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing chapter-three element: ${selector}`);
  return element;
};

function setText(selector: string, value: string): void {
  $(selector).textContent = value;
}

export interface ChapterThreeUICallbacks {
  onLead(id: InvestigationLeadId): void;
  onMoveTestimony(id: TestimonyId, direction: "up" | "down"): void;
  onSubmitOrder(): void;
  onPrivacyChoice(id: PrivacyChoiceId): void;
  onReplay(): void;
  onReturnTitle(): void;
}

export interface ChapterThreeUI {
  renderLeads(state: ChapterThreeState, mode: GameMode): void;
  renderTestimony(state: ChapterThreeState): void;
  renderPrivacy(state: ChapterThreeState, mode: GameMode): void;
  renderComplete(state: ChapterThreeState): void;
}

function distanceLabel(distance: number): string {
  if (distance <= 1) return "周棠愿意和你一起核对边界";
  if (distance <= 3) return "周棠仍在观察你的调查方式";
  return "周棠正在拉开距离";
}

export function createChapterThreeUI(callbacks: ChapterThreeUICallbacks): ChapterThreeUI {
  $("#chapter-three-order-submit").addEventListener("click", callbacks.onSubmitOrder);
  $("#chapter-three-replay-btn").addEventListener("click", callbacks.onReplay);
  $("#chapter-three-title-btn").addEventListener("click", callbacks.onReturnTitle);

  function renderLeads(state: ChapterThreeState, mode: GameMode): void {
    setText("#chapter-three-points", `剩余调查点 ${state.pointsLeft} / 3`);
    setText("#chapter-three-distance", distanceLabel(state.zhouDistance));
    const wrap = $("#chapter-three-lead-list");
    wrap.replaceChildren(...INVESTIGATION_LEADS.map((lead) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "investigation-lead";
      const selected = state.leadIds.includes(lead.id);
      button.disabled = selected || state.pointsLeft <= 0;
      button.dataset.selected = String(selected);
      const actor = document.createElement("span");
      actor.textContent = lead.actor;
      const title = document.createElement("strong");
      title.textContent = selected ? `${lead.label} · 已核对` : lead.label;
      const description = document.createElement("small");
      description.textContent = selected
        ? lead.result
        : `${lead.description}${mode === "story" ? ` ${lead.cost}` : ""}`;
      button.append(actor, title, description);
      button.addEventListener("click", () => callbacks.onLead(lead.id));
      return button;
    }));
    const log = $("#chapter-three-lead-log");
    log.replaceChildren(...state.log.slice(1).map((line) => {
      const item = document.createElement("li");
      item.textContent = line;
      return item;
    }));
    setText("#chapter-three-lead-status", state.pointsLeft > 0 ? `还可核对 ${state.pointsLeft} 条信息源。` : "证词板已经生成。");
  }

  function renderTestimony(state: ChapterThreeState): void {
    const board = $("#chapter-three-testimony-list");
    board.replaceChildren(...state.testimonyOrder.map((id, index) => {
      const item = testimony(id)!;
      const row = document.createElement("li");
      row.className = "testimony-row";
      const rank = document.createElement("span");
      rank.className = "testimony-rank";
      rank.textContent = String(index + 1);
      const copy = document.createElement("div");
      const source = document.createElement("strong");
      source.textContent = item.source;
      const statement = document.createElement("p");
      statement.textContent = item.statement;
      const provenance = document.createElement("small");
      provenance.textContent = item.provenance;
      copy.append(source, statement, provenance);
      const controls = document.createElement("div");
      controls.className = "testimony-controls";
      (["up", "down"] as const).forEach((direction) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "icon-btn";
        button.textContent = direction === "up" ? "↑" : "↓";
        button.title = direction === "up" ? "提高可核对顺位" : "降低可核对顺位";
        button.setAttribute("aria-label", `${direction === "up" ? "上移" : "下移"}${item.source}`);
        button.disabled = direction === "up" ? index === 0 : index === state.testimonyOrder.length - 1;
        button.addEventListener("click", () => callbacks.onMoveTestimony(id, direction));
        controls.append(button);
      });
      row.append(rank, copy, controls);
      return row;
    }));
    setText("#chapter-three-order-status", "把可直接核对的来源放在上方，把转述和推测留在下方。");
  }

  function renderPrivacy(state: ChapterThreeState, mode: GameMode): void {
    const qualityText = state.evidenceQuality === "clear"
      ? "来源已经分开：你知道哪些能证明，哪些只能保留。"
      : state.evidenceQuality === "mixed"
        ? "时间线大致可用，但仍有一段转述被赋予了过多重量。"
        : "信息板仍把完整故事放在可核对记录之前。";
    setText("#chapter-three-quality", qualityText);
    setText("#chapter-three-privacy-distance", distanceLabel(state.zhouDistance));
    const wrap = $("#chapter-three-privacy-actions");
    wrap.replaceChildren(...PRIVACY_CHOICES.map((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "exam-action-btn";
      const title = document.createElement("strong");
      title.textContent = choice.label;
      const description = document.createElement("small");
      description.textContent = `${choice.description}${mode === "story" ? ` 隐私暴露 ${choice.exposure} / 3` : ""}`;
      button.append(title, description);
      button.addEventListener("click", () => callbacks.onPrivacyChoice(choice.id));
      return button;
    }));
    setText("#chapter-three-privacy-status", "这不是找出唯一告密者，而是决定你有权提交什么。");
  }

  function renderComplete(state: ChapterThreeState): void {
    const outcome = state.outcome === "procedural"
      ? "你没有替任何人写完证词，而是建立了当事人可以在场、更正和拒绝的程序。"
      : state.outcome === "protected"
        ? "你接受关系里存在无权知道的部分，传言暂时没有消失，隐私却没有成为代价。"
        : state.outcome === "exposed"
          ? "你证明了清白，也让宋嘉禾的离校计划成为新的传言中心。"
          : "你用自己承担了眼前冲突，也让所有人失去纠正事实的机会。";
    setText("#chapter-three-complete-summary", outcome);
    setText("#chapter-three-complete-distance", `${distanceLabel(state.zhouDistance)} · 隐私暴露 ${state.privacyExposure} / 3`);
    const log = $("#chapter-three-complete-log");
    log.replaceChildren(...state.log.map((line) => {
      const item = document.createElement("li");
      item.textContent = line;
      return item;
    }));
  }

  return { renderLeads, renderTestimony, renderPrivacy, renderComplete };
}
