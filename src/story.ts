import type { StoryGraph } from "./types";

export const story: StoryGraph = {
  intro_01: {
    step: "01", bg: "classroom", portrait: false, speaker: "旁白",
    scene: "澜河市第一高级中学 · 高三（7）班", time: "周四 · 21:37",
    text: "晚自习结束七分钟后，教室里还剩下十二个人。有人刷题，有人等家长，还有人只是累得不想站起来。",
    next: "intro_02"
  },
  intro_02: {
    step: "02", speaker: "旁白",
    text: "你把数学卷塞进桌洞，摸到一本不属于自己的灰色错题本。封皮右下角，写着周棠的名字。",
    next: "intro_03"
  },
  intro_03: {
    step: "03", speaker: "{{player}}",
    text: "她什么时候放进来的……",
    next: "notebook_01"
  },
  notebook_01: {
    step: "04", speaker: "旁白", overlay: "notebook",
    text: "翻到折角的那一页，红笔订正下面多出一行很轻的蓝色字。",
    next: "choice_note"
  },
  choice_note: {
    step: "05", speaker: "旁白",
    text: "下课后的教室很安静。笔尖悬在纸上，你决定——",
    choices: [
      {
        text: "把第17题推导写全，再补一句：“晚自习后，我讲给你听。”",
        hint: "认真回应 · 兼顾学习与关系",
        effects: { study: 6, energy: -3, agency: 2, bond: 4, risk: 1, mutual: 2 },
        next: "note_reply_warm"
      },
      {
        text: "只改正她漏掉的步骤，不回复那句话。",
        hint: "更安全 · 也更疏离",
        effects: { study: 8, stress: 3, agency: 1 },
        next: "note_reply_cold"
      },
      {
        text: "写：“不会就别做了。校门口透十分钟气？”",
        hint: "很甜 · 风险也很明显",
        effects: { study: -2, stress: -5, bond: 6, risk: 4, rebellion: 3, mutual: -1 },
        next: "note_reply_rebel"
      }
    ]
  },
  note_reply_warm: {
    step: "06", speaker: "旁白",
    text: "你把步骤写得比平时工整，最后那句却挤在页脚，像一道不敢占分的附加题。",
    next: "teacher_01"
  },
  note_reply_cold: {
    step: "06", speaker: "旁白",
    text: "你用黑笔把公式补齐，又把那行蓝字盖在手掌下面。正确答案很安全，安全得没有声音。",
    next: "teacher_01"
  },
  note_reply_rebel: {
    step: "06", speaker: "旁白",
    text: "那句话写完，你心里突然轻了一块。可墨迹还没干，教室后门就响了。",
    next: "teacher_01"
  },
  teacher_01: {
    step: "07", speaker: "张老师",
    scene: "高三（7）班 · 后门", time: "周四 · 21:42",
    text: "{{player}}，还没走？这三张专题卷带回去。二次函数是你现在最容易补起来的分。",
    next: "teacher_02"
  },
  teacher_02: {
    step: "08", speaker: "旁白",
    text: "他说得没有错。可你的太阳穴已经跳了一整晚，书包里还有英语周测和一份没签字的成绩单。",
    next: "choice_paper"
  },
  choice_paper: {
    step: "09", speaker: "旁白",
    text: "你接过那三张还带着油墨味的卷子。",
    choices: [
      {
        text: "自己选两类薄弱题，每类只做三道。",
        hint: "主动学习 · 效率优先",
        effects: { study: 6, energy: -6, stress: 3, agency: 5 },
        next: "paper_plan"
      },
      {
        text: "三张全部写完，哪怕今晚不睡。",
        hint: "学业大涨 · 过载危险",
        effects: { study: 9, energy: -10, stress: 9, agency: -4 },
        next: "paper_all"
      },
      {
        text: "坦白说：“老师，我今晚已经学不进去了。”",
        hint: "承认极限 · 提升自主感",
        effects: { study: 1, stress: -7, agency: 8, rebellion: -2 },
        next: "paper_pause"
      }
    ]
  },
  paper_plan: {
    step: "10", speaker: "张老师",
    text: "知道自己缺哪儿，比多写一张有用。明早拿给我看，别贪多。",
    next: "corridor_01"
  },
  paper_all: {
    step: "10", speaker: "张老师",
    text: "有这个劲头是好事。但你眼睛都红了，做完也不一定能记住。",
    next: "corridor_01"
  },
  paper_pause: {
    step: "10", speaker: "张老师",
    text: "……行。今天别硬撑。明早告诉我，你准备从哪三道题重新开始。",
    next: "corridor_01"
  },
  corridor_01: {
    step: "11", bg: "corridor", portrait: true, portraitClass: "soft", speaker: "旁白",
    scene: "三楼东走廊", time: "周四 · 21:48",
    text: "周棠站在饮水机旁，怀里少了一本错题本。她看见你，先看你的脸，再看你书包露出来的卷角。",
    next: "corridor_02"
  },
  corridor_02: {
    step: "12", speaker: "周棠",
    text: "我本来只想借你订正。那句话……你就当我困糊涂了。",
    next: "choice_notice"
  },
  choice_notice: {
    step: "13", speaker: "旁白",
    text: "她笑了一下，可右手一直压着英语卷背面的红笔批注。",
    choices: [
      {
        text: "先问她：“你今天的英语作文，是不是也出了问题？”",
        hint: "看见对方 · 共担上升",
        effects: { bond: 3, stress: -4, mutual: 5 },
        next: "notice_her"
      },
      {
        text: "先把自己今晚的烦躁、卷子和家长签字全说出来。",
        hint: "自己轻松 · 对方会承压",
        effects: { stress: -8, bond: 3, mutual: -3 },
        next: "notice_self"
      },
      {
        text: "逗她：“讲题收费。明早一杯豆浆。”",
        hint: "轻松暧昧 · 小幅共担",
        effects: { bond: 5, stress: -3, mutual: 1 },
        next: "notice_joke"
      }
    ]
  },
  notice_her: {
    step: "14", speaker: "周棠",
    text: "你看见了啊。跑题，四十二分。……我妈还以为我这次能进年级前五十。",
    next: "plan_01"
  },
  notice_self: {
    step: "14", speaker: "周棠",
    text: "你慢点说。我听着呢。只是……你说完以后，也得听我说五分钟。",
    next: "plan_01"
  },
  notice_joke: {
    step: "14", speaker: "周棠",
    text: "最多半杯。剩下半杯得付给我，我可以帮你看英语周测。",
    next: "plan_01"
  },
  plan_01: {
    step: "15", speaker: "周棠",
    text: "离一模还有二十一天。我们总不能每天都靠在走廊碰运气。",
    next: "choice_plan"
  },
  choice_plan: {
    step: "16", speaker: "旁白",
    text: "窗外操场的灯灭了一排。你们只剩下不到十分钟。",
    choices: [
      {
        text: "约定每周二、周四互批错题，只占一个课间。",
        hint: "稳定 · 学习与关系共同推进",
        effects: { study: 5, energy: -3, bond: 5, agency: 4, mutual: 5, risk: 2 },
        next: "plan_study"
      },
      {
        text: "每天晚自习后一起走到校门，哪怕只有十分钟。",
        hint: "很甜 · 暴露风险较高",
        effects: { study: -2, stress: -6, bond: 8, risk: 7, rebellion: 2 },
        next: "plan_walk"
      },
      {
        text: "一模之前暂停联系，把所有时间留给分数。",
        hint: "暂时切断 · 关系会降温",
        effects: { study: 7, bond: -5, stress: 4, agency: -1, mutual: -2, risk: -3 },
        next: "plan_stop"
      }
    ]
  },
  plan_study: {
    step: "17", speaker: "周棠",
    text: "那就一人一本。不会的画圆，快撑不住的时候画个方框。圆是题，方框是人。",
    next: "footsteps_01"
  },
  plan_walk: {
    step: "17", speaker: "周棠",
    text: "十分钟也够了。就是你别每次都走在摄像头底下，像故意让人抓。",
    next: "footsteps_01"
  },
  plan_stop: {
    step: "17", speaker: "周棠",
    text: "……好。那本子你留着吧。一模之后，如果我们还想说话，就从第17题开始。",
    next: "footsteps_01"
  },
  footsteps_01: {
    step: "18", speaker: "旁白",
    text: "楼梯口传来钥匙碰撞声。值班老师正在逐层锁门，脚步离你们只隔一个转角。",
    next: "choice_hide"
  },
  choice_hide: {
    step: "19", speaker: "旁白",
    text: "周棠下意识抓住了你的袖口。",
    choices: [
      {
        text: "拉她躲进没有开灯的西侧楼梯间。",
        hint: "秘密时刻 · 风险快速上升",
        effects: { bond: 5, risk: 6, stress: -3, rebellion: 1 },
        next: "hide_stair"
      },
      {
        text: "把错题本拿在手里，大方说是在交叉订正。",
        hint: "诚实可解释 · 风险下降",
        effects: { study: 2, bond: 2, risk: -3, agency: 2, mutual: 2 },
        next: "hide_open"
      },
      {
        text: "让她先走；如果老师问，就说是你忘了交作业。",
        hint: "承担风险 · 共担显著上升",
        effects: { bond: 4, risk: 1, stress: 2, mutual: 4 },
        next: "hide_take"
      }
    ]
  },
  hide_stair: {
    step: "20", speaker: "旁白",
    text: "楼梯间黑得只剩安全出口的一点绿光。她松开你的袖口，却没有立刻退开。",
    next: "hide_after"
  },
  hide_open: {
    step: "20", speaker: "值班老师",
    portrait: false,
    text: "订正可以，别磨蹭。十分钟后熄楼道灯，赶紧回家。",
    next: "hide_after"
  },
  hide_take: {
    step: "20", speaker: "周棠",
    text: "别什么都替我扛。我跟你一起下去。真被问了，就说我们都忘了时间。",
    next: "hide_after"
  },
  hide_after: {
    step: "21", bg: "gate", portrait: true, portraitClass: "", speaker: "旁白",
    scene: "学校东门外", time: "周四 · 21:58",
    text: "校门外的风比走廊硬。末班公交还差九分钟，早餐车已经盖上蓝色篷布。",
    next: "gate_01"
  },
  gate_01: {
    step: "22", speaker: "周棠",
    text: "{{player}}，我问你一件不好听的。你找我，是因为喜欢我，还是因为你只是太想逃离晚自习？",
    next: "choice_truth"
  },
  choice_truth: {
    step: "23", speaker: "旁白",
    text: "公交的灯从路口转过来。你必须在它到站以前回答。",
    choices: [
      {
        text: "“都有一点。但我不想再把你当出口，我想学会跟你一起往前走。”",
        hint: "诚实 · 信任与共担",
        effects: { bond: 4, agency: 5, mutual: 7, stress: -3 },
        next: "truth_honest"
      },
      {
        text: "“只要和你一起，考成什么样都不重要。”",
        hint: "即时浪漫 · 逃避现实",
        effects: { bond: 7, stress: -4, study: -3, rebellion: 5, mutual: -4 },
        next: "truth_escape"
      },
      {
        text: "“等一模以后再说吧。现在回答，只会影响我们。”",
        hint: "切断情绪 · 学业优先",
        effects: { study: 5, bond: -5, stress: 2, mutual: -2, risk: -2 },
        next: "truth_delay"
      }
    ]
  },
  truth_honest: {
    step: "24", speaker: "周棠",
    text: "那就别把“互相安慰”说得太伟大。我们都可以累，也都得对自己的选择负责。",
    next: "pact_01"
  },
  truth_escape: {
    step: "24", speaker: "周棠",
    text: "你现在这么说很好听。可如果成绩真的掉下去，我们会不会开始怪对方？",
    next: "pact_01"
  },
  truth_delay: {
    step: "24", speaker: "周棠",
    text: "正确答案。可我怎么觉得，这比答错还难受。",
    next: "pact_01"
  },
  pact_01: {
    step: "25", speaker: "旁白",
    text: "她把错题本重新递给你。最后一页是空白的，页眉印着“本周计划”。",
    next: "choice_pact"
  },
  choice_pact: {
    step: "26", speaker: "旁白",
    text: "你在空白页写下——",
    choices: [
      {
        text: "“各自选两个目标，其中一个不能和分数有关。”",
        hint: "可持续的共同计划",
        effects: { study: 2, stress: -3, agency: 6, bond: 4, mutual: 5 },
        next: "pact_balance"
      },
      {
        text: "“每天都见。所有事情都要告诉对方。”",
        hint: "亲密很高 · 边界不足",
        effects: { bond: 6, risk: 4, stress: -2, mutual: -1 },
        next: "pact_tight"
      },
      {
        text: "什么也不写，把笔还给她。",
        hint: "保留退路 · 关系降温",
        effects: { study: 3, agency: 2, bond: -3 },
        next: "pact_blank"
      }
    ]
  },
  pact_balance: {
    step: "27", speaker: "周棠",
    text: "我的第二个目标是，每天睡够六个半小时。你不许笑，这对我比英语一百三还难。",
    next: "closing_01"
  },
  pact_tight: {
    step: "27", speaker: "周棠",
    text: "所有事情？那你以后不回消息，我是不是可以直接去你们班抓人？",
    next: "closing_01"
  },
  pact_blank: {
    step: "27", speaker: "周棠",
    text: "空着也行。不是每一页都必须在今晚填满。",
    next: "closing_01"
  },
  closing_01: {
    step: "28", speaker: "旁白",
    text: "公交停在你们面前。车门打开，暖气和报站声一起涌出来。周棠上车前，轻轻敲了两下那本错题本。",
    next: "closing_02"
  },
  closing_02: {
    step: "29", speaker: "周棠",
    text: "第17题，明天别忘了。还有——你自己的那个目标，也别忘。",
    next: "resolve_ending"
  },
  resolve_ending: {
    step: "30", speaker: "旁白",
    text: "车门合上。距离一模还有二十一天，距离高考还有二百零五天。你第一次觉得，倒计时不只是在减少什么。",
    end: true
  }
};
