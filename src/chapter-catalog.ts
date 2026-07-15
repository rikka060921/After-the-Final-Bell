export type ChapterId = "prologue" | "chapter-one" | "chapter-two" | "chapter-three";
export type ChapterAvailability = "available" | "locked" | "in-development";

export interface ChapterDefinition {
  id: ChapterId;
  label: string;
  title: string;
  summary: string;
  requiresFact?: string;
  availability: ChapterAvailability;
}

export const CHAPTER_CATALOG: readonly ChapterDefinition[] = [
  {
    id: "prologue",
    label: "序章",
    title: "错题本里的十分钟",
    summary: "在晚自习后的教室里，决定如何回应一页不属于你的字。",
    availability: "available"
  },
  {
    id: "chapter-one",
    label: "第一章",
    title: "座位表",
    summary: "在一模前的四周里，安排有限时间，也承担承诺留下的占用。",
    requiresFact: "prologue-complete",
    availability: "available"
  },
  {
    id: "chapter-two",
    label: "第二章",
    title: "两份答案",
    summary: "处理一模结果、寒假家庭安排与一次错峰约会。",
    requiresFact: "chapter-one-complete",
    availability: "in-development"
  },
  {
    id: "chapter-three",
    label: "第三章",
    title: "纸页的背面",
    summary: "返校后，第17题纸页消失，复印件留下新的边角。",
    requiresFact: "chapter-two-complete",
    availability: "locked"
  }
] as const;

export function chapterAvailability(
  facts: readonly string[],
  chapter: ChapterDefinition
): ChapterAvailability {
  if (!chapter.requiresFact || facts.includes(chapter.requiresFact)) return chapter.availability;
  return "locked";
}

export function availableChapters(facts: readonly string[]): ChapterDefinition[] {
  return CHAPTER_CATALOG.filter(
    (chapter) => chapterAvailability(facts, chapter) !== "locked"
  );
}
