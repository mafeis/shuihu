import {
  CHAIN_FORMATIONS,
  EQUIPMENT,
  HERO_BONDS,
  HEROES,
  PATHS,
  ROWS,
  STAT_LABELS,
} from "../../data.js";
import {
  activeHeroBonds,
  deriveHeroStats,
  equipmentMatchesCategory,
  heroDoctrine,
  inventoryItems,
  recommendTeams,
} from "../../state.js";
import {
  recommendEquipment,
  scoreEquipmentSet,
} from "../../equipment-recommendation.js";
import {
  action,
  baseModel,
  heroBannerFromHero,
  modalModel,
} from "./common.js";

const EQUIPMENT_CATEGORIES = Object.freeze([
  { id: "all", name: "全部" },
  { id: "weapon", name: "兵刃" },
  { id: "armor", name: "护甲" },
  { id: "token", name: "随身物" },
]);

const HERO_GROUPS = Object.freeze([
  { id: "all", name: "全部" },
  { id: "gang", name: "刚猛" },
  { id: "ling", name: "灵巧" },
  { id: "tao", name: "韬略" },
  { id: "shou", name: "守御" },
]);

const SLOT_NAMES = Object.freeze({
  weapon: "兵刃",
  armor: "护甲",
  token: "随身物",
});

const SLOT_ICONS = Object.freeze({
  weapon: "swords",
  armor: "shield",
  token: "star",
});

export function buildRosterModel(context) {
  const {
    state,
    selectedCodexHero,
    rosterPathFilter,
    rosterPage,
    modal,
  } = context;
  const selectedId = state.recruited.includes(selectedCodexHero)
    ? selectedCodexHero
    : state.recruited[0];
  const filtered = state.recruited.filter(
    (heroId) =>
      rosterPathFilter === "all" ||
      HEROES[heroId]?.path === rosterPathFilter,
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 6));
  const currentPage = Math.min(Math.max(0, rosterPage || 0), pages - 1);
  const visible = filtered.slice(currentPage * 6, currentPage * 6 + 6);
  const stats = selectedId ? deriveHeroStats(state, selectedId) : {};
  const doctrine = selectedId ? heroDoctrine(state, selectedId) : null;
  return baseModel("roster", state, "roster", {
    hero: {
      ...heroBannerFromHero(state, selectedId, "聚义簿"),
      subtitle: `${PATHS[HEROES[selectedId]?.path]?.name || "未知"} · ${
        Object.entries(stats)
          .slice(0, 2)
          .map(([key, value]) => `${STAT_LABELS[key] || key} ${value}`)
          .join(" · ")
      }`,
    },
    actions: [
      action("formation", "三阵编成", "nav-formation", {}, {
        tone: "primary",
        icon: "roster",
      }),
      action("auto", "军师荐阵", "auto-team", {}, {
        tone: "secondary",
        icon: "star",
      }),
      action("equipment", "整理装备", "equipment-hero", { hero: selectedId }, {
        tone: "ghost",
        icon: "star",
      }),
      action("chronicle", "人物生平", "open-hero-chronicle", { hero: selectedId }, {
        tone: "ghost",
        icon: "scroll",
      }),
      ...(currentPage > 0
        ? [
            action("prev", "上一页", "roster-page", { direction: -1 }, {
              tone: "ghost",
              icon: "back",
            }),
          ]
        : []),
      ...(currentPage < pages - 1
        ? [
            action("next", "下一页", "roster-page", { direction: 1 }, {
              tone: "ghost",
              icon: "chevron",
            }),
          ]
        : []),
    ],
    tabs: HERO_GROUPS.map((group) => ({
      id: group.id,
      label:
        group.id === "all"
          ? `全部 ${state.recruited.length}`
          : `${group.name} ${
              state.recruited.filter(
                (heroId) => HEROES[heroId]?.path === group.id,
              ).length
            }`,
      action: "filter-roster-path",
      data: { path: group.id },
      active: rosterPathFilter === group.id,
    })),
    cards: visible.map((heroId) => {
      const hero = HEROES[heroId];
      const entry = state.roster[heroId];
      const row = state.team.indexOf(heroId);
      return {
        id: heroId,
        title: hero.name,
        meta: `${hero.nickname} · Lv.${entry.level}`,
        body: `${PATHS[hero.path]?.name || ""} · ${row >= 0 ? ROWS[row].name : "后备"}`,
        image: hero.cutout || hero.portrait,
        badge: row >= 0 ? "上阵" : "后备",
        action: "open-hero",
        data: { hero: heroId },
        tone: heroId === selectedId ? "primary" : "ghost",
      };
    }),
    columns: 3,
    modal: modalModel(modal),
    detail: {
      doctrine: doctrine?.name || null,
      page: currentPage + 1,
      pages,
      total: filtered.length,
      totalHeroes: state.recruited.length,
    },
  });
}

export function buildFormationModel(context) {
  const {
    state,
    selectedFormationRow,
    modal,
  } = context;
  const activeBonds = activeHeroBonds(state);
  const activePaths = [
    ...new Set(
      state.team
        .filter(Boolean)
        .map((heroId) => HEROES[heroId]?.path)
        .filter(Boolean),
    ),
  ];
  const chain = Object.values(CHAIN_FORMATIONS).find(
    (formation) =>
      formation.paths.length === activePaths.length &&
      formation.paths.every((path) => activePaths.includes(path)),
  ) || null;
  const recommendations = recommendTeams(state, 2).map((option, index) => ({
    id: `recommend-${index}`,
    title: option.name,
    meta: `${option.pathCount}/3 路 · ${option.bonds.length} 契`,
    body: option.reason,
    icon: "star",
    badge: "采用",
    action: "apply-team-recommendation",
    data: { index },
    tone: index === 0 ? "primary" : "ghost",
  }));
  const slots = [0, 1, 2].map((row) => {
    const heroId = state.team[row];
    const hero = HEROES[heroId];
    return {
      id: `row-${row}`,
      title: `${ROWS[row].name} · ${hero?.name || "空阵位"}`,
      meta:
        row === 0
          ? "受击 145%"
          : row === 2
            ? "受击 70%"
            : "均衡站位",
      body: hero
        ? `${PATHS[hero.path]?.name || ""} · Lv.${state.roster[heroId]?.level || 1}`
        : "点击后从下方选择好汉",
      image: hero?.cutout || hero?.portrait,
      badge: row === selectedFormationRow ? "当前阵位" : "选择",
      action: "select-formation-row",
      data: { row },
      tone: row === selectedFormationRow ? "primary" : "ghost",
    };
  });
  const bench = state.recruited
    .filter((heroId) => !state.team.includes(heroId))
    .slice(0, 4)
    .map((heroId) => {
      const hero = HEROES[heroId];
      return {
        id: `bench-${heroId}`,
        title: hero.name,
        meta: `${hero.star} · ${PATHS[hero.path]?.name || ""}`,
        body: `编入${ROWS[selectedFormationRow].name}`,
        image: hero.cutout || hero.portrait,
        badge: "入阵",
        action: "assign-formation",
        data: { hero: heroId },
      };
    });
  return baseModel("formation", state, "roster", {
    breadcrumb: "编成",
    hero: {
      image: HEROES[state.team[selectedFormationRow]]?.cutout,
      eyebrow: "三阵之势",
      title: "点将编成",
      subtitle: activeBonds.length
        ? `当前羁绊：${activeBonds.map((bond) => bond.name).join("、")}${chain ? ` · ${chain.name}` : ""}`
        : `当前选择 ${ROWS[selectedFormationRow].name}，点击后备好汉即可换入。`,
    },
    actions: [
      action("auto", "军师荐阵", "auto-team", {}, {
        tone: "primary",
        icon: "star",
      }),
      action(
        state.team[selectedFormationRow] ? "clear" : "roster",
        state.team[selectedFormationRow] ? "清空阵位" : "好汉名册",
        state.team[selectedFormationRow]
          ? "clear-formation-row"
          : "nav-roster",
        state.team[selectedFormationRow] ? { row: selectedFormationRow } : {},
        {
          tone: "ghost",
          icon: "roster",
        },
      ),
      action("map", "编成完毕", "go-map", {}, {
        tone: "secondary",
        icon: "map",
      }),
    ],
    cards: [...recommendations, ...slots, ...bench],
    columns: 2,
    detail: {
      activeBondIds: activeBonds.map((bond) => bond.id),
      activeBondNames: activeBonds.map((bond) => bond.name),
      bondIds: Object.keys(HERO_BONDS),
      paths: activePaths,
      chain: chain
        ? {
            id: chain.id,
            name: chain.name,
            desc: chain.desc,
          }
        : null,
    },
    modal: modalModel(modal),
  });
}

export function buildEquipmentModel(context) {
  const {
    state,
    selectedEquipmentHero,
    equipmentCategory,
    equipmentPage,
    equipmentPathFilter,
    modal,
  } = context;
  const heroId = state.recruited.includes(selectedEquipmentHero)
    ? selectedEquipmentHero
    : state.recruited[0];
  const hero = HEROES[heroId];
  const entry = state.roster[heroId];
  const stats = deriveHeroStats(state, heroId);
  const recommendation = recommendEquipment(state, heroId);
  const currentEquipment = Object.fromEntries(
    ["weapon", "armor", "token"].map((slot) => [
      slot,
      EQUIPMENT[entry?.equipment?.[slot]]?.slot === slot
        ? entry.equipment[slot]
        : null,
    ]),
  );
  const recommendedIds = new Set(
    Object.values(recommendation.equipment || {}).filter(Boolean),
  );
  const visible = inventoryItems(state).filter(({ item }) => {
    const heroPath = HEROES[heroId]?.path;
    return (
      equipmentMatchesCategory(item.id, equipmentCategory) &&
      (equipmentPathFilter === "all" || heroPath === equipmentPathFilter)
    );
  });
  const pages = Math.max(1, Math.ceil(visible.length / 3));
  const currentPage = Math.min(Math.max(0, equipmentPage || 0), pages - 1);
  const inventory = visible.slice(currentPage * 3, currentPage * 3 + 3);
  const equippedCards = ["weapon", "armor", "token"].map((slot) => {
    const item = EQUIPMENT[entry?.equipment?.[slot]];
    return {
      id: `equipped-${slot}`,
      title: item?.name || `未装备${SLOT_NAMES[slot]}`,
      meta: `${SLOT_NAMES[slot]} · ${item?.rarity || "空置"}`,
      body: item
        ? Object.entries(item.stats)
            .map(([key, value]) => `${STAT_LABELS[key] || key} +${value}`)
            .join(" · ")
        : "从下方行囊选择武备",
      icon: SLOT_ICONS[slot],
      slot,
      badge: item ? "卸下" : "",
      action: item ? "unequip" : null,
      data: { slot, hero: heroId },
      tone: item ? "primary" : "ghost",
    };
  });
  const inventoryCards = inventory.map(({ item, amount }) => {
    const nextScore = scoreEquipmentSet(hero, {
      ...currentEquipment,
      [item.slot]: item.id,
    });
    return {
      id: item.id,
      title: item.name,
      meta: `${SLOT_NAMES[item.slot]} · ${item.rarity} ×${amount}`,
      body: Object.entries(item.stats)
        .map(([key, value]) => `${STAT_LABELS[key] || key} +${value}`)
        .join(" · "),
      icon: SLOT_ICONS[item.slot] || "star",
      slot: item.slot,
      badge: recommendedIds.has(item.id) ? "荐装" : "装备",
      action: "equip-item",
      data: { item: item.id },
      tone: recommendedIds.has(item.id) ? "primary" : "ghost",
      comparison: {
        current: recommendation.currentScore,
        next: nextScore,
        delta:
          Math.round(
            (nextScore - recommendation.currentScore) * 10,
          ) / 10,
      },
    };
  });
  return baseModel("equipment", state, "roster", {
    hero: {
      ...heroBannerFromHero(state, heroId, "甲兵武备"),
      subtitle: Object.entries(stats)
        .map(([key, value]) => `${STAT_LABELS[key] || key} ${value}`)
        .join(" · "),
    },
    actions: [
      action(
        "recommend",
        recommendation.changes?.length
          ? `军师荐装 · ${recommendation.changes.length}`
          : "当前已优",
        "recommend-equipment",
        {},
        {
          tone: "primary",
          icon: "star",
          disabled: !recommendation.changes?.length,
        },
      ),
      action("roster", "返回名册", "nav-roster", {}, {
        tone: "ghost",
        icon: "back",
      }),
      ...(currentPage > 0
        ? [
            action("prev", "上一页", "equipment-page", { direction: -1 }, {
              tone: "ghost",
              icon: "back",
            }),
          ]
        : []),
      ...(currentPage < pages - 1
        ? [
            action("next", "下一页", "equipment-page", { direction: 1 }, {
              tone: "ghost",
              icon: "chevron",
            }),
          ]
        : []),
    ],
    tabs: EQUIPMENT_CATEGORIES.map((category) => ({
      id: `category-${category.id}`,
      label: category.id === "all" ? "全类" : category.name,
      action: "filter-equipment-item",
      data: { slot: category.id },
      active: equipmentCategory === category.id,
    })).concat(
      HERO_GROUPS.map((group) => ({
        id: `path-${group.id}`,
        label: group.id === "all" ? "全路" : group.name,
        action: "filter-equipment-path",
        data: { path: group.id },
        active: equipmentPathFilter === group.id,
      })),
    ),
    cards: [...equippedCards, ...inventoryCards],
    columns: 3,
    detail: {
      heroId,
      heroPath: hero.path,
      category: equipmentCategory,
      pathFilter: equipmentPathFilter,
      page: currentPage + 1,
      pages,
      total: visible.length,
      armory: {
        equippedCount: equippedCards.filter((card) => card.action).length,
        totalSlots: equippedCards.length,
        itemCount: visible.length,
        recommendationCount: recommendation.changes?.length || 0,
        changeCount: recommendation.changes?.length || 0,
        score: recommendation.score,
        improvement: recommendation.improvement,
        style: recommendation.style,
        stats: Object.entries(stats).map(([key, value]) => ({
          id: key,
          label: STAT_LABELS[key] || key,
          value,
        })),
      },
    },
    modal: modalModel(modal),
  });
}
