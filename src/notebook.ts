import type { NotebookSlot, NotebookState, StatEffects } from "./types";

export const notebookSlotLabels: Record<NotebookSlot, string> = {
  solution: "题解",
  message: "留言",
  blank: "留白"
};

const slotOrder: NotebookSlot[] = ["solution", "message", "blank"];

export function countNotebookSlots(notebook: NotebookState): Record<NotebookSlot, number> {
  return notebook.slots.reduce<Record<NotebookSlot, number>>(
    (counts, slot) => {
      counts[slot] += 1;
      return counts;
    },
    { solution: 0, message: 0, blank: 0 }
  );
}

export function cycleNotebookSlot(notebook: NotebookState, index: number): NotebookState {
  const current = notebook.slots[index];
  if (!current || notebook.committed) return notebook;
  const nextSlots = [...notebook.slots];
  const currentIndex = slotOrder.indexOf(current);
  nextSlots[index] = slotOrder[(currentIndex + 1) % slotOrder.length] ?? "solution";
  return { slots: nextSlots, committed: false };
}

export function getNotebookEffects(notebook: NotebookState): StatEffects {
  const counts = countNotebookSlots(notebook);
  return {
    study: Math.max(0, counts.solution - 2),
    energy: counts.solution >= 4 ? -1 : 0,
    bond: Math.max(0, counts.message - 1),
    risk: counts.message >= 4 ? 2 : counts.message >= 3 ? 1 : 0,
    stress: -Math.max(0, counts.blank - 1),
    agency: counts.blank >= 3 ? 2 : 0,
    mutual: counts.solution > 0 && counts.message > 0 && counts.blank > 0 ? 1 : 0
  };
}

export function notebookDecisionId(notebook: NotebookState): string {
  const counts = countNotebookSlots(notebook);
  return `notebook-s${counts.solution}-m${counts.message}-b${counts.blank}`;
}
