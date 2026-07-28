import type {
  ChapterThreePhase,
  ChapterThreeState,
  InvestigationLeadId,
  PrivacyChoiceId,
  TestimonyId
} from "../types";
import {
  INVESTIGATION_LEADS,
  PRIVACY_CHOICES,
  TESTIMONIES,
  investigationLead,
  privacyChoice
} from "./model";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringArray(value: unknown, limit: number): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, limit)
    : [];
}

const phases = new Set<ChapterThreePhase>(["lead-board", "testimony-board", "privacy-choice", "complete"]);
const leadIds = new Set<InvestigationLeadId>(INVESTIGATION_LEADS.map((lead) => lead.id));
const testimonyIds = new Set<TestimonyId>(TESTIMONIES.map((item) => item.id));
const privacyChoiceIds = new Set<PrivacyChoiceId>(PRIVACY_CHOICES.map((choice) => choice.id));

export function sanitizeChapterThreeState(value: unknown): ChapterThreeState | null {
  if (!isRecord(value) || number(value.schemaVersion) !== 1) return null;
  const phase = text(value.phase) as ChapterThreePhase;
  if (!phases.has(phase)) return null;
  const leads = stringArray(value.leadIds, 3).filter((id): id is InvestigationLeadId => leadIds.has(id as InvestigationLeadId));
  if (new Set(leads).size !== leads.length) return null;
  const order = stringArray(value.testimonyOrder, 4).filter((id): id is TestimonyId => testimonyIds.has(id as TestimonyId));
  if (new Set(order).size !== order.length || !order.includes("copy-edge")) return null;
  const expectedTestimonies = new Set<TestimonyId>([
    "copy-edge",
    ...leads.map((id) => investigationLead(id)!.testimonyId)
  ]);
  if (order.some((id) => !expectedTestimonies.has(id))) return null;
  const pointsLeft = Math.max(0, Math.min(3, Math.trunc(number(value.pointsLeft))));
  if (pointsLeft !== 3 - leads.length || order.length !== leads.length + 1) return null;
  const quality = text(value.evidenceQuality) as ChapterThreeState["evidenceQuality"];
  if (!["pending", "clear", "mixed", "confused"].includes(quality)) return null;
  const choiceText = text(value.privacyChoice);
  const choice = choiceText as PrivacyChoiceId;
  if (choiceText && !privacyChoiceIds.has(choice)) return null;
  const outcome = text(value.outcome) as ChapterThreeState["outcome"];
  if (!["pending", "procedural", "protected", "exposed", "absorbed"].includes(outcome)) return null;

  const expectedPhase = pointsLeft > 0
    ? "lead-board"
    : quality === "pending"
      ? "testimony-board"
      : choiceText
        ? "complete"
        : "privacy-choice";
  if (phase !== expectedPhase) return null;
  if (pointsLeft > 0 && quality !== "pending") return null;
  if ((phase === "complete") !== (outcome !== "pending")) return null;
  const expectedOutcomes: Record<PrivacyChoiceId, ChapterThreeState["outcome"]> = {
    "teacher-with-parties": "procedural",
    "stop-investigation": "protected",
    "expose-plan": "exposed",
    "take-all-blame": "absorbed"
  };
  if (choiceText && outcome !== expectedOutcomes[choice]) return null;
  if (choiceText && Math.trunc(number(value.privacyExposure)) !== privacyChoice(choice)!.exposure) return null;

  return {
    schemaVersion: 1,
    phase,
    pointsLeft,
    leadIds: leads,
    testimonyOrder: order,
    evidenceQuality: quality,
    privacyChoice: choiceText ? choice : null,
    zhouDistance: Math.max(0, Math.min(9, number(value.zhouDistance))),
    privacyExposure: Math.max(0, Math.min(3, Math.trunc(number(value.privacyExposure)))),
    outcome,
    log: stringArray(value.log, 20),
    resolvedEventIds: stringArray(value.resolvedEventIds, 20)
  };
}
