#!/usr/bin/env node
// Regenerates Godot gameplay JSON from the shared campaign source.
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";

const data = await import("../src/data.js");
const { CHAPTER_TACTICS } = await import("../src/chapter-tactics.js");
const assetPath = (value) => value?.replace(/^\/?assets\//, "res://assets/");

const pickHero = (hero) => ({
  id: hero.id,
  name: hero.name,
  nickname: hero.nickname,
  star: hero.star,
  role: hero.role,
  path: hero.path,
  preferred_row: hero.preferredRow,
  cutout: assetPath(hero.cutout),
  keyart: assetPath(hero.keyart),
  palette: hero.palette,
  base: hero.base,
  passive: hero.passive,
  skills: hero.skills,
  bio: hero.bio,
});

const pickEquipment = (item) => {
  const copy = structuredClone(item);
  if (typeof copy.icon === "string") copy.icon = assetPath(copy.icon);
  return copy;
};

const startingEquipment = {
  linchong: { weapon: "worn_spear", armor: "lamellar_vest", token: "crimson_tassel" },
  luzhishen: { weapon: "iron_staff", armor: "monk_robe", token: "imperial_seal" },
  wusong: { weapon: "ring_saber", armor: "patrol_armor", token: "tiger_tooth" },
  daizong: { weapon: "dispatch_blade", armor: "scout_boots", token: "courier_token" },
  andaoquan: { weapon: "needle_case", armor: "physician_robe", token: "herb_satchel" },
  shiqian: { weapon: "climbing_hook", armor: "night_cloth", token: "lockpick_roll" },
  likui: { weapon: "black_axe_pair", armor: "blood_tunic", token: "ox_head_belt" },
  huarong: { weapon: "horn_bow", armor: "feather_scale", token: "hawk_tassel" },
  songjiang: { weapon: "righteous_polearm", armor: "timely_cloak", token: "liangshan_banner" },
  husanniang: { weapon: "sun_moon_blades", armor: "red_brocade_armor", token: "crimson_lasso" },
  wuyong: { weapon: "strategist_chain", armor: "crane_cloak", token: "wisdom_fan" },
  yanqing: { weapon: "wanderer_spear", armor: "swallow_armor", token: "wrestling_belt" },
};

// Godot's importer writes sidecars next to assets. Preserve them when the
// generated asset tree is refreshed so exported builds keep valid textures.
const importSidecars = {};
for (const folder of ["characters", "enemies", "environments", "audio", "video", "vfx"]) {
  const sourceFolder = new URL("../godot/assets/" + folder + "/", import.meta.url);
  const visit = async (directory) => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
      if (entry.isDirectory()) {
        await visit(child);
      } else if (entry.name.endsWith(".import")) {
        importSidecars[child.pathname] = await readFile(child);
      }
    }
  };
  await visit(sourceFolder);
}

const chapterRules = {
  ferry: {
    id: "ferry_wake",
    name: "雪夜渡口",
    desc: "林冲、鲁智深取得破阵先机，官军前阵开局承受护势压力。",
    effects: {
      enemyStartPoisePct: 0.12,
      teamModifiers: { startYiqi: 8 },
    },
  },
  bianjing: {
    id: "capital_crossfire",
    name: "雪巷夹击",
    desc: "官军后阵弓手开局获得鼓舞，先拆远射再取文书。",
    effects: {
      enemyOpeningStatuses: [{ row: 2, status: "inspiration", duration: 2 }],
    },
  },
  boar_forest: {
    id: "forest_ambush",
    name: "林深伏杀",
    desc: "禁军教官开局获得护御；梁山好汉获得护势与先手。",
    effects: {
      enemyOpeningStatuses: [{ row: 0, status: "guard", duration: 2 }],
      teamModifiers: { poisePct: 0.18, startYiqi: 8 },
    },
  },
  cangzhou: {
    id: "medicine_fire",
    name: "药火救人",
    desc: "好汉治疗提高 20%，开阵获得护御；官军受火势影响承受更多破势。",
    effects: {
      teamModifiers: { healPct: 0.2, openingGuard: 1, poisePct: 0.15 },
    },
  },
  qingfeng: {
    id: "moon_archers",
    name: "月下齐射",
    desc: "后阵官军身法与鼓舞更强，后阵好汉需先避开箭雨。",
    effects: {
      enemyModifiers: { spdPct: 0.08 },
      enemyOpeningStatuses: [{ row: 2, status: "inspiration", duration: 2 }],
    },
  },
  jiangzhou: {
    id: "execution_market",
    name: "法场夺人",
    desc: "刽子手破甲更强；梁山开阵获得义气，首名官军倒下后余军获得护御。",
    effects: {
      teamModifiers: { startYiqi: 12 },
      onEnemyDefeat: { guard: 1 },
    },
  },
  zhujiazhuang: {
    id: "snow_maze",
    name: "盘陀雪路",
    desc: "庄门教师开局护御；梁山队伍身法更快，治疗提高 12%。",
    effects: {
      teamModifiers: { spdPct: 0.05, healPct: 0.12 },
      enemyOpeningStatuses: [{ row: 0, status: "guard", duration: 2 }],
    },
  },
  damingfu: {
    id: "lantern_city",
    name: "灯市疑阵",
    desc: "梁山开局获得鼓舞与义气；都监在低位会背水反扑。",
    effects: {
      teamModifiers: { openingInspiration: 1, startYiqi: 8 },
    },
  },
  liangshan: {
    id: "last_stand",
    name: "水泊聚义",
    desc: "兄弟契与三路星火可改变战局；梁山开局获得护御，官军会誓死反扑。",
    effects: {
      teamModifiers: { openingGuard: 1, startYiqi: 8 },
      enemyOpeningStatuses: [{ row: 0, status: "inspiration", duration: 1 }],
    },
  },
};

const stageRecruits = {
  ferry: ["luzhishen"],
  bianjing: ["daizong", "shiqian"],
  boar_forest: ["wusong"],
  cangzhou: ["andaoquan"],
  qingfeng: ["huarong"],
  jiangzhou: ["songjiang", "likui"],
  zhujiazhuang: ["husanniang"],
  damingfu: ["wuyong", "yanqing"],
  liangshan: ["yangzhi", "gongsunsheng", "lujunyi", "zhangshun"],
};

const chronicleRecruits = {
  shijin: ["qinming", "chaiin"],
  guansheng: ["zhangqing", "xuning"],
  lijun: ["ruanxiaoqi", "sunerniang", "gudashao"],
  lingzhen: ["huyanzhuo", "liutang", "zhutong"],
  leiheng: ["liying", "jiezhen", "jiebao"],
  yangxiong: ["shixiu", "sunli", "yuehe"],
  yuehe: ["xiaorang", "jiangjing"],
};

const pickChapter = (chapter) => ({
  id: chapter.id,
  index: chapter.index,
  label: chapter.label,
  title: chapter.title,
  location: chapter.location,
  bg: assetPath(chapter.bg),
  summary: chapter.summary,
  objective: chapter.objective,
  par_rounds: chapter.parRounds,
  intro: chapter.intro,
  choice: chapter.choice,
  battle: {
    enemies: chapter.battle.enemies,
    reward: chapter.battle.reward,
    recruit: chapter.battle.recruit || [],
    boss: chapter.battle.boss || null,
    settlement: chapter.index === data.CHAPTERS.length - 1 ? "ending" : null,
  },
  special_rule: chapterRules[chapter.id] || null,
  outro: chapter.outro,
});

const pickRecruitment = (recruitment) => {
  const copy = structuredClone(recruitment);
  if (typeof copy.bg === "string") copy.bg = assetPath(copy.bg);
  return copy;
};

// The browser source uses state checks for achievements. Godot evaluates the
// same conditions through native helpers, so only definitions and rewards are
// exported here.
const achievementDefinitions = data.ACHIEVEMENTS.map(
  ({ check: _check, ...achievement }) => achievement,
);

const payload = {
  version: 2,
  rows: data.ROWS,
  paths: Object.fromEntries(
    Object.entries(data.PATHS).map(([id, path]) => [
      id,
      { ...path, icon: assetPath(path.icon) },
    ]),
  ),
  difficulties: data.DIFFICULTIES,
  equipment: Object.fromEntries(
    Object.entries(data.EQUIPMENT).map(([id, item]) => [id, pickEquipment(item)]),
  ),
  starting_equipment: startingEquipment,
  chain_formations: data.CHAIN_FORMATIONS,
  bonds: Object.fromEntries(
    Object.entries(data.HERO_BONDS).map(([id, bond]) => [id, structuredClone(bond)]),
  ),
  hero_order: data.HERO_ORDER,
  heroes: Object.fromEntries(
    Object.entries(data.HEROES).map(([id, hero]) => [id, pickHero(hero)]),
  ),
  chapters: data.CHAPTERS.map(pickChapter),
  enemies: Object.fromEntries(
    Object.entries(data.ENEMIES).map(([id, enemy]) => {
      const copy = structuredClone(enemy);
      for (const key of ["sprite", "keyart"]) {
        if (typeof copy[key] === "string") copy[key] = assetPath(copy[key]);
      }
      return [id, copy];
    }),
  ),
  camp_buildings: data.CAMP_BUILDINGS,
  camp_products: data.CAMP_PRODUCTS,
  camp_recipes: data.CAMP_RECIPES,
  facilities: data.FACILITIES,
  endings: data.ENDINGS,
  arena_boons: data.ARENA_BOONS,
  arena_encounters: data.ARENA_ENCOUNTERS,
  chapter_rules: chapterRules,
  stage_recruits: stageRecruits,
  chronicle_recruits: chronicleRecruits,
  hero_quests: data.HERO_QUESTS,
  hero_legends: data.HERO_LEGENDS,
  hero_trials: data.HERO_TRIALS,
  hero_doctrines: data.HERO_DOCTRINES,
  achievements: achievementDefinitions,
  hero_recruitments: Object.fromEntries(
    Object.entries(data.HERO_RECRUITMENTS).map(([heroId, recruitment]) => [
      heroId,
      pickRecruitment(recruitment),
    ]),
  ),
  chapter_tactics: CHAPTER_TACTICS,
};

await writeFile(
  new URL("../godot/data/game.json", import.meta.url),
  JSON.stringify(payload, null, 2) + "\n",
);

const assetsDir = new URL("../assets/", import.meta.url);
const godotAssetsDir = new URL("../godot/assets/", import.meta.url);
await mkdir(godotAssetsDir, { recursive: true });
const bundledAssets = ["characters", "enemies", "environments", "audio", "video", "vfx"];
for (const entry of await readdir(godotAssetsDir)) {
  if (!bundledAssets.includes(entry)) {
    await rm(new URL(entry + "/", godotAssetsDir), { recursive: true, force: true });
  }
}
for (const folder of bundledAssets) {
  await rm(new URL(folder + "/", godotAssetsDir), { recursive: true, force: true });
}
const skipFiles = /^(?:turnaround\.png|.*\.mp4|.*\.import)$/;
for (const folder of bundledAssets) {
  await cp(new URL(folder + "/", assetsDir), new URL(folder + "/", godotAssetsDir), {
    recursive: true,
    filter: (source) => !skipFiles.test(source.split("/").at(-1)),
    force: true,
  });
}
for (const [path, contents] of Object.entries(importSidecars)) {
  await writeFile(path, contents);
}
