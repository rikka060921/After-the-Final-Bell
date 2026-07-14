import type { Ending, EndingId, GameStats } from "./types";

export const endings: Record<EndingId, Ending> = {
  alliance: {
    title: "十分钟同盟",
    quote: "“圆是题，方框是人。题可以明天再会，人不能一直假装没事。”",
    body: "你们没有用恋爱逃离高考，也没有为了正确答案否定彼此。二十一天不一定能改变命运，但足够学会一种更难的事：既看见对方，也不放弃自己。"
  },
  stolen: {
    title: "偷来的春天",
    quote: "“十分钟很短。可如果每天都偷十分钟呢？”",
    body: "你们把压力挡在两个人之外，获得了迅速升温的甜蜜。只是秘密、疲惫与期待正在一起累积。春天已经来了，但它仍像从倒计时里偷来的。"
  },
  correct: {
    title: "正确答案",
    quote: "“有些空白不是不会，是不敢写。”",
    body: "你选择把所有不确定都推到一模之后。成绩获得了清晰的方向，关系却停在没有提交的草稿里。也许这确实是最安全的答案——至少今晚如此。"
  },
  overload: {
    title: "满格的红线",
    quote: "“再坚持一下。”你已经对自己说了太多次。",
    body: "卷子、期待和秘密同时压上来。你仍在前进，却越来越难说清这是自己的选择，还是因为不敢停下。逆反不会凭空消失，它只是在等一个出口。"
  },
  blank: {
    title: "空白页",
    quote: "“不是每一页都必须在今晚填满。”",
    body: "你们没有走近，也没有真正告别。错题本最后一页仍然空着，像一段暂时无法命名的关系。倒计时继续，而答案被留给未来。"
  }
};

export function resolveEnding(stats: GameStats): EndingId {
  if (stats.stress >= 74 || stats.rebellion >= 38 || stats.energy <= 30) return "overload";
  if (stats.bond >= 30 && stats.risk >= 16 && stats.mutual < 10) return "stolen";
  if (stats.study >= 70 && stats.bond < 16) return "correct";
  if (stats.bond < 12 || stats.mutual < -5) return "blank";
  return "alliance";
}
