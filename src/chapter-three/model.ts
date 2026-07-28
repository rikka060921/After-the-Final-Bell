import type {
  InvestigationLeadId,
  PrivacyChoiceId,
  StatEffects,
  TestimonyId
} from "../types";

export interface InvestigationLeadDefinition {
  id: InvestigationLeadId;
  actor: string;
  label: string;
  description: string;
  cost: string;
  testimonyId: TestimonyId;
  result: string;
  statEffects: StatEffects;
}

export interface TestimonyDefinition {
  id: TestimonyId;
  source: string;
  statement: string;
  provenance: string;
  reliability: number;
}

export interface PrivacyChoiceDefinition {
  id: PrivacyChoiceId;
  label: string;
  description: string;
  exposure: number;
}

export const INVESTIGATION_LEADS: readonly InvestigationLeadDefinition[] = [
  {
    id: "office-copy",
    actor: "办公室",
    label: "核对复印机记录",
    description: "用一个午休确认复印时间与纸张批次，不询问纸页内容。",
    cost: "学业时间 -2 · 获得可核对记录",
    testimonyId: "copy-time",
    result: "复印记录显示纸页在周棠离开办公室之后才被取走。",
    statEffects: { study: -2, agency: 1 }
  },
  {
    id: "guo-route",
    actor: "郭祺",
    label: "只问她碰过什么",
    description: "不要求动机，只确认她是否拿过原页以及把它放到哪里。",
    cost: "被注意 +1 · 获得第一手承认",
    testimonyId: "guo-admission",
    result: "郭祺承认拿过原页，却明确说办公室里的复印件不是她放的。",
    statEffects: { risk: 1, agency: 1 }
  },
  {
    id: "liang-version",
    actor: "梁骁",
    label: "让梁骁完整讲一遍",
    description: "他的版本细节最多，也最容易把别人转述的部分混进事实。",
    cost: "压力 +1 · 获得完整但二手的说法",
    testimonyId: "liang-story",
    result: "梁骁给出一条没有空白的路线，但他无法说明其中两段是谁亲眼看见。",
    statEffects: { stress: 1 }
  },
  {
    id: "zhou-boundary",
    actor: "周棠",
    label: "问她哪些内容不能公开",
    description: "承认你无权知道全部，只确认纸页是否涉及第三个人。",
    cost: "不增加事实 · 降低关系误判",
    testimonyId: "zhou-refusal",
    result: "周棠确认纸页涉及宋嘉禾，但拒绝用朋友的处境替你们证明清白。",
    statEffects: { bond: 1, mutual: 2, stress: -1 }
  },
  {
    id: "song-desk",
    actor: "宋嘉禾",
    label: "观察空座与请假记录",
    description: "不翻她的物品，只对照公开的请假时间和座位变化。",
    cost: "学业时间 -1 · 获得间接时间线",
    testimonyId: "song-absence",
    result: "宋嘉禾的请假早于传言，她的空座不是纸页事件之后才出现。",
    statEffects: { study: -1, stress: 1 }
  }
] as const;

export const TESTIMONIES: readonly TestimonyDefinition[] = [
  {
    id: "copy-edge",
    source: "复印件边角",
    statement: "裁切痕迹避开了留言，却保留了另一段计划的日期。",
    provenance: "你亲眼看到的实物",
    reliability: 6
  },
  {
    id: "copy-time",
    source: "复印机记录",
    statement: "复印件在周棠离开办公室后才被取走。",
    provenance: "可核对的时间记录",
    reliability: 5
  },
  {
    id: "guo-admission",
    source: "郭祺本人",
    statement: "她拿过原页，但没有把复印件放在办公室桌上。",
    provenance: "当事人对自己行为的承认",
    reliability: 4
  },
  {
    id: "song-absence",
    source: "公开请假记录",
    statement: "宋嘉禾的缺席发生在传言之前。",
    provenance: "公开记录，只能证明时间先后",
    reliability: 3
  },
  {
    id: "zhou-refusal",
    source: "周棠的边界",
    statement: "纸页涉及宋嘉禾，但她拒绝公开具体内容。",
    provenance: "第一手说明，不等于完整证词",
    reliability: 2
  },
  {
    id: "liang-story",
    source: "梁骁的完整版本",
    statement: "郭祺拿页、周棠复印、宋嘉禾离校是一条完整路线。",
    provenance: "混合了转述，两个关键环节无来源",
    reliability: 1
  }
] as const;

export const PRIVACY_CHOICES: readonly PrivacyChoiceDefinition[] = [
  {
    id: "teacher-with-parties",
    label: "请当事人在场再交给老师",
    description: "只提交时间线和纸页风险，不替宋嘉禾公开离校原因。",
    exposure: 1
  },
  {
    id: "stop-investigation",
    label: "停止调查，保留不确定",
    description: "接受自己无权知道全部，同时记录已经确认的风险。",
    exposure: 0
  },
  {
    id: "expose-plan",
    label: "公开离校计划证明清白",
    description: "最快终止恋爱传言，也会把宋嘉禾的处境交给全班。",
    exposure: 3
  },
  {
    id: "take-all-blame",
    label: "把所有责任揽到自己身上",
    description: "短期保护所有人，却让事实、程序和周棠的选择一起消失。",
    exposure: 1
  }
] as const;

export function investigationLead(id: InvestigationLeadId): InvestigationLeadDefinition | null {
  return INVESTIGATION_LEADS.find((lead) => lead.id === id) ?? null;
}

export function testimony(id: TestimonyId): TestimonyDefinition | null {
  return TESTIMONIES.find((item) => item.id === id) ?? null;
}

export function privacyChoice(id: PrivacyChoiceId): PrivacyChoiceDefinition | null {
  return PRIVACY_CHOICES.find((choice) => choice.id === id) ?? null;
}
