import { WATER_MARGIN_SAGA, waterMarginSceneAsset } from "./waterMarginChronicle.js";

const enemy = (id, row) => ({ id, row });

const battle = (enemies, copper, xp, item, recruit = []) => ({
  enemies: enemies.map(([id, row]) => enemy(id, row)),
  reward: { copper, xp, item },
  recruit,
});

export const WATER_MARGIN_CHAPTERS = WATER_MARGIN_SAGA.map((arc, index) => {
  const recruit = arc.cast;
  return {
    id: arc.id,
    index,
    label: arc.label,
    title: arc.title,
    location: arc.location,
    bg: waterMarginSceneAsset(arc.sceneId),
    summary: arc.summary,
    objective: arc.stakes,
    parRounds: 6,
    intro: [
      { speaker: "旁白", text: arc.summary },
      { speaker: "旁白", text: `出处：${arc.source}。这一回把${arc.location}的旧事与梁山众人重新连在一起。` },
      { speaker: "宋江", portrait: "songjiang", text: arc.stakes },
    ],
    choice: {
      prompt: arc.choice?.prompt || `在${arc.location}，梁山如何处理这一场旧事？`,
      options: arc.choice?.options || [
        { text: "先救百姓，再追查官军幕后主使。", effect: { brotherhood: 2 }, response: "梁山的旗先落在百姓身后，阵前留出一条退路。" },
        { text: "抢占关隘，迫使敌军回援。", effect: { order: 2 }, response: "梁山越过旧路，守住关隘，也把下一场交锋引到开阔地。" },
      ],
    },
    outro: [
      { speaker: "旁白", text: `${arc.title}的烽烟暂息。${arc.location}留下了梁山众人的脚印，也留下了下一段要还的旧债。` },
      { speaker: "宋江", portrait: "songjiang", text: "兄弟们，今日不是最后一战。路走到哪里，便要护到哪里。" },
    ],
    battle: battle(
      index < 3
        ? [["runner", 0], ["archer", 1], ["instructor", 2]]
        : index < 10
          ? [["captain", 0], ["archer", 1], ["instructor", 2]]
          : [["instructor", 0], ["daming_captain", 1], ["archer", 2]],
      220 + index * 45,
      140 + index * 32,
      ["patrol_armor", "bamboo_token", "imperial_seal"][index % 3],
      recruit,
    ),
  };
});

export const WATER_MARGIN_MEMORIES = WATER_MARGIN_SAGA
  .filter((arc) => ["stone_tablet", "nine_dragons", "birthday_gifts", "amnesty", "liao", "tian_hu", "wang_qing", "fang_la", "afterwards"].includes(arc.id))
  .map((arc, index) => {
    const enemies = [
      ["captain", 0],
      ["archer", 1],
      ["instructor", 2],
    ];
    return {
      id: `memory_${arc.id}`,
      index,
      label: arc.label,
      title: arc.title,
      location: arc.location,
      bg: waterMarginSceneAsset(arc.sceneId),
      summary: arc.summary,
      objective: arc.stakes,
      parRounds: 5,
      intro: [
        { speaker: "旁白", text: arc.summary },
        { speaker: "旁白", text: `这一回出自${arc.source}。梁山散落在各地的人与事，都在此处归卷。` },
        { speaker: "宋江", portrait: "songjiang", text: arc.stakes },
      ],
      choice: {
        prompt: arc.choice?.prompt || `在${arc.location}，梁山如何处理这段旧事？`,
        options: arc.choice?.options || [
          { text: "先护百姓，再追查幕后主使。", effect: { brotherhood: 2 }, response: "梁山把百姓送到安全处，才回身处理旧案。" },
          { text: "占住要路，逼敌军退阵。", effect: { order: 2 }, response: "梁山守住要路，把下一场交锋引到开阔地。" },
        ],
      },
      outro: [
        { speaker: "旁白", text: `${arc.title}的战事暂息，梁山留下了一条可走的旧路。` },
        { speaker: "宋江", portrait: "songjiang", text: "一百单八人的故事，不止在聚义厅。路走到哪里，便要护到哪里。" },
      ],
      battle: {
        enemies: enemies.map(([id, row]) => ({ id, row })),
        reward: { copper: 190 + index * 40, xp: 120 + index * 30, item: "patrol_armor" },
        recruit: arc.cast.slice(0, 3),
      },
    };
  });

const tacticPresets = [
  { id: "protect", name: "先护百姓", icon: "shield-check", tone: "blue", desc: "全队开场获得 1 层护御，受到的伤害降低 6%。", effects: { teamModifiers: { damageReductionPct: 0.06 }, heroOpeningStatuses: [{ status: "guard", duration: 1 }] } },
  { id: "cutoff", name: "夺路断后", icon: "crosshair", tone: "gold", desc: "敌军开场损失 12% 护势，全队破势提高 15%。", effects: { teamModifiers: { poisePct: 0.15, enemyStartPoisePct: 0.12 } } },
];

export const WATER_MARGIN_CHAPTER_TACTICS = Object.fromEntries(
  WATER_MARGIN_SAGA.map((arc, index) => [
    arc.id,
    tacticPresets.map((preset) => ({
      ...preset,
      id: `${arc.id}_${preset.id}`,
      name: index % 2 ? "留证破阵" : preset.name,
    })),
  ]),
);

export const WATER_MARGIN_CHAPTER_TACTIC_IDS = new Set(
  Object.values(WATER_MARGIN_CHAPTER_TACTICS).flat().map((tactic) => tactic.id),
);

export function getWaterMarginChapterTactics(chapterId) {
  return WATER_MARGIN_CHAPTER_TACTICS[chapterId] || [];
}
