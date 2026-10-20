/**
 * 官军与地方势力的敌将名册。
 *
 * 设计原则：
 * - 立绘复用现有好汉 cutout（美术已到位），但**身份、姓名、招式全部重写**，
 *   玩家看到的是"官军将领"，不是"某某好汉"。
 * - 四个梯度对应战役推进：tier1 第一~三回、tier2 第四~五回、
 *   tier3 第六~七回、tier4 第八回~终回。
 * - 每家 3 招，首领 4 招；招式只使用 battle.js 已支持的效果词汇。
 * - 同一张立绘只出现一次，避免战斗里出现两个一样的人。
 *
 * 只放数据，不含规则。规则由 src/battle.js 读取。
 */

const g = (
  id,
  name,
  title,
  heroArt,
  path,
  tier,
  stats,
  poise,
  boss,
  skills,
  bossPhase = null,
) => ({
  id,
  name,
  title,
  sprite: `/assets/characters/${heroArt}/cutout.webp`,
  path,
  tier,
  boss,
  base: { hp: stats[0], atk: stats[1], def: stats[2], spd: stats[3] },
  poise,
  portraitPosition: "50% 28%",
  skills,
  ...(bossPhase ? { bossPhase } : {}),
});

const strike = (id, name, power, status, chance, duration = 2) => ({
  id,
  name,
  target: "frontEnemy",
  power,
  weight: 4,
  effects: [{ type: "status", status, duration, chance }],
});

const sweep = (id, name, power, status, chance, duration = 2) => ({
  id,
  name,
  target: "allEnemies",
  power,
  weight: 2,
  effects: [{ type: "status", status, duration, chance }],
});

const pick = (id, name, power, status, chance, duration = 2) => ({
  id,
  name,
  target: "lowestEnemy",
  power,
  weight: 3,
  effects: [{ type: "status", status, duration, chance }],
});

const brace = (id, name, status, duration = 2) => ({
  id,
  name,
  target: "self",
  power: 0,
  weight: 2,
  effects: [{ type: "selfStatus", status, duration }],
});

const rally = (id, name, status, duration = 2) => ({
  id,
  name,
  target: "allAllies",
  power: 0,
  weight: 2,
  effects: [{ type: "teamStatus", status, duration }],
});

/** 第一~三回：开封府与沧州道上的官军小队 */
const TIER_ONE = [
  g("gen_yaban", "押班·张德", "开封府押班", "suochao", "gang", 1, [255, 40, 26, 31], 95, false, [
    strike("gen_yaban_1", "杀威棒", 1.15, "armorBreak", 0.5),
    sweep("gen_yaban_2", "列队冲撞", 0.68, "stun", 0.28),
    brace("gen_yaban_3", "结阵自守"),
  ]),
  g("gen_shichang", "什长·焦成", "弓手什长", "muhong", "ling", 1, [215, 42, 23, 34], 85, false, [
    pick("gen_shichang_1", "点名箭", 1.1, "armorBreak", 0.45),
    sweep("gen_shichang_2", "齐射压制", 0.62, "armorBreak", 0.35),
    brace("gen_shichang_3", "退步张弦"),
  ]),
  g("gen_paijun", "牌军·郝勇", "开封府牌军", "xuanzan", "shou", 1, [275, 36, 29, 28], 100, false, [
    strike("gen_paijun_1", "铁牌磕击", 1.2, "stun", 0.35),
    rally("gen_paijun_2", "盾墙号令", "guard", 2),
    brace("gen_paijun_3", "立牌抵御"),
  ]),
  g("gen_butou", "步头·彭虎", "沧州牢城步头", "hantao", "tao", 1, [250, 44, 25, 33], 90, false, [
    strike("gen_butou_1", "锁链横扫", 1.12, "bleeding", 0.5),
    pick("gen_butou_2", "绊腿", 0.9, "stun", 0.4),
    brace("gen_butou_3", "咬牙硬顶"),
  ]),
  g("gen_majun", "马军·韩烈", "沧州马军", "pengqi", "gang", 1, [265, 41, 27, 36], 95, false, [
    strike("gen_majun_1", "马踏", 1.22, "armorBreak", 0.4),
    sweep("gen_majun_2", "回骑冲阵", 0.7, "stun", 0.25),
    brace("gen_majun_3", "勒马急停"),
  ]),
  g("gen_jianjun", "监军·魏钦", "沧州道监军", "shantinggui", "shou", 1, [430, 43, 30, 30], 120, true, [
    strike("gen_jianjun_1", "军令如山", 1.25, "armorBreak", 0.6),
    sweep("gen_jianjun_2", "三通鼓", 0.72, "inspiration", 0.0),
    pick("gen_jianjun_3", "斩逃令", 1.35, "bleeding", 0.55),
    rally("gen_jianjun_4", "督战", "inspiration", 3),], { text: "擂鼓催战，全军义气暴涨。", selfStatuses: { inspiration: 3 } }),
];

/** 第四~五回：牢城、寨堡与地方武装 */
const TIER_TWO = [
  g("gen_jieji", "节级·牛二", "沧州牢城节级", "weidingguo", "tao", 2, [430, 46, 30, 32], 115, false, [
    strike("gen_jieji_1", "水火棍", 1.2, "stun", 0.45),
    pick("gen_jieji_2", "杀威棒", 1.15, "armorBreak", 0.55),
    brace("gen_jieji_3", "受财自保"),
  ]),
  g("gen_zhaizhu", "寨主·燕彪", "清风寨寨主", "dengfei", "gang", 2, [470, 49, 31, 34], 125, false, [
    strike("gen_zhaizhu_1", "劈山刀", 1.3, "bleeding", 0.45),
    sweep("gen_zhaizhu_2", "寨众围杀", 0.74, "armorBreak", 0.3),
    brace("gen_zhaizhu_3", "背墙顽抗"),
  ]),
  g("gen_jiaoshi", "教师·吕奉", "寨堡枪棒教师", "lvfang", "ling", 2, [420, 50, 29, 36], 120, false, [
    strike("gen_jiaoshi_1", "教师枪", 1.18, "armorBreak", 0.4),
    pick("gen_jiaoshi_2", "挑腕", 1.05, "sealed", 0.35),
    brace("gen_jiaoshi_3", "架式收起"),
  ]),
  g("gen_yuhou", "虞候·郭盛", "青州虞候", "guosheng", "shou", 2, [490, 46, 34, 31], 130, false, [
    strike("gen_yuhou_1", "方天画戟", 1.26, "armorBreak", 0.5),
    sweep("gen_yuhou_2", "横戟扫阵", 0.7, "stun", 0.3),
    rally("gen_yuhou_3", "整队", "guard", 2),
  ]),
  g("gen_tuanlian", "团练·王英", "青州团练", "wangying", "tao", 2, [440, 48, 30, 35], 125, false, [
    pick("gen_tuanlian_1", "撩阴刀", 1.24, "bleeding", 0.5),
    strike("gen_tuanlian_2", "连环斫", 1.1, "armorBreak", 0.45),
    brace("gen_tuanlian_3", "退步换气"),
  ]),
  g("gen_zhizhai", "知寨·鲍信", "清风寨知寨", "baoxu", "gang", 2, [560, 50, 34, 33], 145, true, [
    strike("gen_zhizhai_1", "宰牛刀", 1.3, "bleeding", 0.6),
    sweep("gen_zhizhai_2", "寨门齐攻", 0.78, "armorBreak", 0.4),
    pick("gen_zhizhai_3", "酒后狂斫", 1.4, "stun", 0.35),
    brace("gen_zhizhai_4", "醉里自护"),], { healPct: 0.12, text: "酒后死战，{heal} 生命回流，寨众杀性更盛。", selfStatuses: { inspiration: 2 } }),
];

/** 第六~七回：州府行刑与祝家庄式堡寨 */
const TIER_THREE = [
  g("gen_xingxing", "行刑官·单雄", "江州行刑官", "jindajian", "shou", 3, [600, 52, 36, 31], 140, true, [
    strike("gen_xingxing_1", "断头刀", 1.35, "bleeding", 0.55),
    pick("gen_xingxing_2", "点名待斩", 1.2, "stun", 0.45),
    brace("gen_xingxing_3", "验刀而立"),
    sweep("gen_xingxing_4", "法场惊堂", 0.78, "armorBreak", 0.4),], { yiqi: 100, text: "掷下朱笔，断头令已出，全队陷入流血与破甲。", selfStatuses: { inspiration: 3 }, heroStatuses: { bleeding: 2, armorBreak: 2 } }),
  g("gen_douji", "都级·裴虎", "江州都级", "peixuan", "gang", 3, [560, 54, 35, 34], 140, false, [
    strike("gen_douji_1", "朴刀劈", 1.28, "armorBreak", 0.5),
    sweep("gen_douji_2", "衙役合围", 0.76, "stun", 0.3),
    brace("gen_douji_3", "倚门而立"),
  ]),
  g("gen_zhujiaoshi", "教师·郑寿", "祝家庄教师", "zhengtianshou", "tao", 3, [540, 56, 34, 38], 145, false, [
    strike("gen_zhujiaoshi_1", "盘龙棍", 1.26, "stun", 0.45),
    pick("gen_zhujiaoshi_2", "点穴棍", 1.12, "sealed", 0.45),
    brace("gen_zhujiaoshi_3", "棍花护身"),
  ]),
  g("gen_panjun", "判官·杨春", "祝家庄判官", "yangchun", "ling", 3, [520, 53, 35, 35], 140, false, [
    pick("gen_panjun_1", "冷箭", 1.2, "armorBreak", 0.5),
    sweep("gen_panjun_2", "堡上齐射", 0.74, "armorBreak", 0.4),
    brace("gen_panjun_3", "依垛隐蔽"),
  ]),
  g("gen_guanjia", "管家·陈达", "祝家庄管家", "chenkang", "shou", 3, [620, 50, 39, 32], 155, false, [
    rally("gen_guanjia_1", "犒军", "guard", 3),
    strike("gen_guanjia_2", "铁尺", 1.22, "armorBreak", 0.5),
    brace("gen_guanjia_3", "闭门落锁"),
  ]),
  g("gen_zhu_zhu", "祝家庄主·祝彪", "祝家庄少庄主", "shiyong", "gang", 3, [680, 58, 38, 36], 165, true, [
    strike("gen_zhu_zhu_1", "盘陀刀", 1.34, "bleeding", 0.55),
    sweep("gen_zhu_zhu_2", "连环绊马", 0.8, "stun", 0.35),
    pick("gen_zhu_zhu_3", "背水一击", 1.45, "armorBreak", 0.5),
    rally("gen_zhu_zhu_4", "庄丁死战", "inspiration", 3),], { healPct: 0.1, text: "闭门死守，{heal} 生命回流并结起护御。", selfStatuses: { guard: 2, inspiration: 2 } }),
];

/** 第八回~终回：大名府与梁山周边的正规军 */
const TIER_FOUR = [
  g("gen_dutong", "都监·闻达", "大名府都监", "xueyong", "gang", 4, [700, 52, 38, 36], 160, true, [
    strike("gen_dutong_1", "重刀劈阵", 1.34, "armorBreak", 0.55),
    sweep("gen_dutong_2", "都监号令", 0.8, "armorBreak", 0.45),
    brace("gen_dutong_3", "披挂重整"),
    rally("gen_dutong_4", "都监点兵", "inspiration", 3),], { healPct: 0.14, text: "困兽反扑，恢复 {heal} 生命并披上两层护御。", selfStatuses: { guard: 2, inspiration: 2 } }),
  g("gen_tongzhi", "统制·李成", "大名府统制", "lili", "shou", 4, [640, 50, 38, 34], 160, false, [
    strike("gen_tongzhi_1", "铁枪贯阵", 1.3, "sealed", 0.45),
    rally("gen_tongzhi_2", "列阵", "guard", 3),
    brace("gen_tongzhi_3", "按兵不动"),
  ]),
  g("gen_zhihui", "指挥使·索元", "大名府指挥使", "sunxin", "ling", 4, [640, 52, 34, 40], 158, false, [
    pick("gen_zhihui_1", "神臂弓", 1.32, "armorBreak", 0.5),
    sweep("gen_zhihui_2", "轮射", 0.82, "bleeding", 0.4),
    brace("gen_zhihui_3", "换箭上弦"),
  ]),
  g("gen_fujiang", "副将·王定", "大名府副将", "wangdingliu", "tao", 4, [620, 55, 36, 38], 155, false, [
    strike("gen_fujiang_1", "三尖刀", 1.28, "bleeding", 0.5),
    pick("gen_fujiang_2", "追斩", 1.36, "stun", 0.35),
    brace("gen_fujiang_3", "游走喘息"),
  ]),
  g("gen_jiedushi", "节度使·段景", "大名府节度使", "duanjingzhu", "shou", 4, [760, 58, 42, 33], 170, true, [
    strike("gen_jiedushi_1", "节钺斩", 1.4, "bleeding", 0.6),
    sweep("gen_jiedushi_2", "三军齐动", 0.86, "stun", 0.4),
    pick("gen_jiedushi_3", "军法处置", 1.38, "sealed", 0.5),
    rally("gen_jiedushi_4", "死守大名", "guard", 3),], { text: "节钺高举，亲军死战，全队护御与鼓舞同起。", selfStatuses: { guard: 3, inspiration: 2 }, heroStatuses: { armorBreak: 2 } }),
  g("gen_lianren", "廉访使·焦谦", "大名府廉访使", "jiaoqian", "ling", 4, [660, 52, 36, 40], 158, true, [
    pick("gen_lianren_1", "密令", 1.3, "armorBreak", 0.55),
    sweep("gen_lianren_2", "查缉", 0.8, "sealed", 0.4),
    strike("gen_lianren_3", "快手锁拿", 1.26, "stun", 0.45),
    brace("gen_lianren_4", "退入后堂"),], { healPct: 0.14, text: "密令未绝，恢复 {heal} 生命并唤出伏手。", selfStatuses: { guard: 2, inspiration: 2 }, heroStatuses: { armorBreak: 2 } }),
];

export const ENEMY_GENERALS = Object.freeze(
  Object.fromEntries(
    [...TIER_ONE, ...TIER_TWO, ...TIER_THREE, ...TIER_FOUR].map((general) => [
      general.id,
      Object.freeze(general),
    ]),
  ),
);

/** 每个梯度可用的敌将 id，供章节与演武按进度抽人。 */
export const ENEMY_GENERALS_BY_TIER = Object.freeze({
  1: TIER_ONE.map((general) => general.id),
  2: TIER_TWO.map((general) => general.id),
  3: TIER_THREE.map((general) => general.id),
  4: TIER_FOUR.map((general) => general.id),
});

export function enemyGeneralsForTier(tier) {
  return (ENEMY_GENERALS_BY_TIER[tier] || []).map((id) => ENEMY_GENERALS[id]);
}
