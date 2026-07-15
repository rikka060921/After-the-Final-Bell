import { resolveNextEvent, type DeterministicEvent, type EventContext } from "../event-engine";
import type { ChapterOneState, LongTermProgress } from "../types";

export type ZhouWeekTwoActionId =
  | "chapter1-zhou-renegotiate-contact"
  | "chapter1-zhou-offer-mutual-review"
  | "chapter1-zhou-open-invitation";

interface ZhouActionContext extends EventContext {
  readonly state: ChapterOneState;
}

const ZHOU_WEEK_TWO_ACTIONS: readonly DeterministicEvent<
  ZhouActionContext,
  ZhouWeekTwoActionId
>[] = [
  {
    id: "chapter1-zhou-renegotiate-contact",
    priority: 30,
    when: ({ state }) => state.obligations.some(
      (obligation) => obligation.promiseId === "daily-total-contact" && obligation.week > 2 && obligation.status === "due"
    ),
    resolve: () => "chapter1-zhou-renegotiate-contact"
  },
  {
    id: "chapter1-zhou-offer-mutual-review",
    priority: 20,
    when: ({ facts }) => facts.includes("opening-promise:two-independent-goals"),
    resolve: () => "chapter1-zhou-offer-mutual-review"
  },
  {
    id: "chapter1-zhou-open-invitation",
    priority: 10,
    when: () => true,
    resolve: () => "chapter1-zhou-open-invitation"
  }
] as const;

export function selectZhouWeekTwoAction(
  state: ChapterOneState,
  progress: LongTermProgress
): ZhouWeekTwoActionId | null {
  const resolved = resolveNextEvent(
    ZHOU_WEEK_TWO_ACTIONS,
    {
      state,
      facts: progress.facts,
      numbers: {
        pressure: state.relationships.zhouPressure,
        mutual: progress.tendencies.listening + progress.tendencies.explanation
      }
    },
    state.resolvedEventIds
  );
  return resolved?.result ?? null;
}
