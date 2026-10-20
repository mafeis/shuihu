import {
  CAMP_BUILDINGS,
  CAMP_PRODUCTS,
  CHAPTERS,
  HEROES,
} from "../../data.js";
import {
  chapterStatus,
  currentChapter,
} from "../../state.js";
import { buildRoutePlan } from "../../route-guide.js";
import {
  action,
  baseModel,
  modalModel,
  teamCards,
} from "./common.js";

export function buildMapModel(context) {
  const { state, focusedChapterId, modal } = context;
  const chapter =
    CHAPTERS.find((item) => item.id === focusedChapterId) ||
    currentChapter(state) ||
    CHAPTERS[0];
  const status = chapterStatus(state, chapter);
  const unlocked = CHAPTERS.filter(
    (item) => chapterStatus(state, item) !== "locked",
  );
  const visibleChapters = [
    chapter,
    ...unlocked.filter((item) => item.id !== chapter.id),
    ...CHAPTERS.filter(
      (item) =>
        item.id !== chapter.id &&
        chapterStatus(state, item) === "locked",
    ),
  ].slice(0, 6);
  const routeLead = buildRoutePlan(state, { limit: 1 })[0];
  return baseModel("map", state, "map", {
    background: chapter.bg,
    hero: {
      image: chapter.bg,
      eyebrow: `${chapter.label} · ${chapter.location}`,
      title: chapter.title,
      subtitle: chapter.objective,
    },
    actions: [
      action(
        "enter",
        status === "completed"
          ? "重游旧战"
          : status === "locked"
            ? "尚未解锁"
            : "启程",
        "enter-chapter",
        {},
        {
          tone: "primary",
          icon: status === "completed" ? "star" : "play",
          disabled: status === "locked",
        },
      ),
      action("camp", "营寨整备", "nav-camp", {}, {
        tone: "secondary",
        icon: "camp",
      }),
      action("roster", "三阵编成", "nav-formation", {}, {
        tone: "ghost",
        icon: "roster",
      }),
      ...(routeLead
        ? [
            action(
              `route-${routeLead.action || "goal"}`,
              routeLead.title,
              routeLead.action || "nav-quests",
              {
                ...(routeLead.chapterId
                  ? { chapter: routeLead.chapterId }
                  : {}),
                ...(routeLead.heroId ? { hero: routeLead.heroId } : {}),
              },
              {
                tone: "ghost",
                icon: "star",
              },
            ),
          ]
        : []),
    ],
    cards: visibleChapters.map((item) => {
      const itemStatus = chapterStatus(state, item);
      return {
        id: item.id,
        title: item.title,
        meta: `${item.label} · ${item.location}`,
        body:
          itemStatus === "completed"
            ? "战卷已录，可重游"
            : itemStatus === "locked"
              ? "完成前回后开启"
              : item.objective,
        image: item.bg,
        badge:
          itemStatus === "completed"
            ? "已胜"
            : itemStatus === "locked"
              ? "未开"
              : "可战",
        action: "select-chapter",
        data: { chapter: item.id },
        disabled: itemStatus === "locked",
        tone: item.id === chapter.id ? "primary" : "ghost",
      };
    }),
    tabs: [
      {
        id: "team",
        label: `出战 ${state.team.filter(Boolean).length}/3`,
        action: "nav-roster",
        active: true,
      },
      {
        id: "heroes",
        label: `${state.recruited.length} 位好汉`,
        action: "nav-roster",
        active: false,
      },
    ],
    columns: 3,
    modal: modalModel(modal),
    teamCards: teamCards(state),
  });
}

export function buildCampModel(context) {
  const { state, modal } = context;
  const chapter = currentChapter(state) || CHAPTERS[0];
  const buildings = Object.values(CAMP_BUILDINGS);
  const stock = Object.entries(state.camp?.stock || {})
    .filter(([id, amount]) => CAMP_PRODUCTS[id] && amount > 0)
    .slice(0, 2)
    .map(([id, amount]) => `${CAMP_PRODUCTS[id].name} ${amount}`)
    .join(" · ");
  const visibleBuildings = [...buildings]
    .sort((left, right) => {
      const rank = { built: 0, available: 1, locked: 2 };
      return (
        rank[context.campStatus(left.id)] -
        rank[context.campStatus(right.id)]
      );
    })
    .slice(0, 8);
  return baseModel("camp", state, "camp", {
    background: chapter.bg,
    hero: {
      image: chapter.bg,
      eyebrow: `水泊营寨 · ${context.campLevel || 1} 期`,
      title: "梁山营寨",
      subtitle: stock ? `库存：${stock}` : "建造农田、矿场、林地与作坊，保障再战。",
    },
    actions: [
      action(
        "rest",
        `休整 · ${context.restCost || 0} 贯`,
        "camp-rest",
        {},
        {
          tone: "primary",
          icon: "star",
          disabled: state.inventory.copper < (context.restCost || 0),
        },
      ),
      action("map", "行军图", "go-map", {}, {
        tone: "secondary",
        icon: "map",
      }),
      action("roster", "调整三阵", "nav-roster", {}, {
        tone: "ghost",
        icon: "roster",
      }),
      action(
        "expand",
        context.nextAreaWins === null
          ? "营区全开"
          : `扩建 · ${context.nextAreaWins} 胜`,
        "expand-camp-area",
        {},
        {
          tone: "ghost",
          icon: "camp",
          disabled:
            context.nextAreaWins === null ||
            state.stats.battlesWon < context.nextAreaWins,
        },
      ),
    ],
    cards: visibleBuildings.map((building) => {
      const status = context.campStatus(building.id);
      const level = state.facilities?.[building.id] || 1;
      const output =
        status === "built" && building.resource
          ? `${CAMP_PRODUCTS[building.resource]?.name || "原料"} ${state.camp.stock?.[building.resource] || 0}`
          : status === "built"
            ? "设施可用"
            : status === "available"
              ? `建造 ${building.cost} 贯`
              : `累计 ${building.unlockVictories} 胜`;
      return {
        id: building.id,
        title: building.name,
        meta:
          status === "built"
            ? `Lv.${level} · ${output}`
            : output,
        body: building.desc,
        icon: building.icon,
        badge:
          status === "built"
            ? "已建"
            : status === "available"
              ? "可建"
              : "未开",
        layout: {
          column: building.col,
          row: building.row,
          columns: building.size[0],
          rows: building.size[1],
        },
        action: "select-camp-building",
        data: { building: building.id },
        disabled: status === "locked",
        tone:
          status === "built"
            ? "primary"
            : status === "available"
              ? "secondary"
              : "ghost",
      };
    }),
    columns: 2,
    modal: modalModel(modal),
  });
}

export function campModalActions(context) {
  const { state, modal } = context;
  const buildingId = modal?.buildingId;
  const building = CAMP_BUILDINGS[buildingId];
  if (!building) return modalModel(modal);
  const status = context.campStatus(buildingId);
  const actions = [];
  if (status === "available") {
    actions.push(
      action("build", `建造 · ${building.cost} 贯`, "build-camp-building", {
        building: buildingId,
      }, {
        tone: "primary",
        icon: "camp",
        disabled: state.inventory.copper < building.cost,
      }),
    );
  }
  if (status === "built" && building.resource) {
    actions.push(
      action(
        "collect",
        `收获 · ${CAMP_PRODUCTS[building.resource]?.name || "原料"}`,
        "collect-camp-resource",
        { building: buildingId },
        { tone: "primary", icon: "star" },
      ),
    );
  }
  actions.push(
    action("close", "返回营图", "close-modal", {}, {
      tone: "ghost",
      icon: "back",
    }),
  );
  return {
    title: building.name,
    body: `${building.desc}\n${status === "built" ? `当前等级 ${state.facilities?.[buildingId] || 1}` : status === "available" ? `建造需要 ${building.cost} 贯` : `累计胜利 ${building.unlockVictories} 场后开放`}`,
    actions,
    onDismiss: action("modal-dismiss", "关闭", "close-modal", {}, {
      tone: "ghost",
      icon: "back",
    }),
  };
}
