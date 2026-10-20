import {
  CHAPTERS,
  HEROES,
  HERO_ORDER,
} from "../../data.js";
import {
  activeHeroes,
  completionPercent,
  currentChapter,
  totalPower,
} from "../../state.js";

export const NAV_ITEMS = Object.freeze([
  { id: "map", label: "江湖", icon: "map", action: "nav-map" },
  { id: "camp", label: "营寨", icon: "camp", action: "nav-camp" },
  { id: "arena", label: "演武", icon: "arena", action: "nav-arena" },
  { id: "roster", label: "好汉", icon: "roster", action: "nav-roster" },
  { id: "quests", label: "异闻", icon: "quests", action: "nav-quests" },
  { id: "codex", label: "星图", icon: "codex", action: "nav-codex" },
  { id: "settings", label: "设置", icon: "settings", action: "nav-settings" },
]);

export function navFor(active, back = null) {
  return NAV_ITEMS.map((item) => ({
    ...item,
    active: item.id === active,
  })).concat(
    back
      ? [
          {
            id: "back",
            label: back.label || "返回",
            icon: "back",
            action: back.action,
            active: false,
          },
        ]
      : [],
  );
}

export function action(
  id,
  label,
  actionName,
  data = {},
  options = {},
) {
  return {
    id,
    label,
    action: actionName,
    data,
    tone: options.tone || "ghost",
    icon: options.icon || "chevron",
    disabled: Boolean(options.disabled),
    pressed:
      options.pressed === undefined
        ? undefined
        : Boolean(options.pressed),
    active: Boolean(options.active),
  };
}

export function titleCase(value) {
  return String(value || "");
}

export function plainText(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function headerFor(stateValue, active, options = {}) {
  const chapter = options.chapter || currentChapter(stateValue);
  return {
    title: options.title || chapter?.title || "星命水浒",
    back: options.back || null,
    stats: [
      { label: "铜钱", value: stateValue?.inventory?.copper || 0 },
      {
        label: "战力",
        value: Math.round(totalPower(stateValue || {})),
      },
      {
        label: "好汉",
        value: `${stateValue?.recruited?.length || 0}/${HERO_ORDER.length}`,
      },
      {
        label: "进度",
        value: `${completionPercent(stateValue || {})}%`,
      },
    ],
  };
}

export function baseModel(screen, stateValue, active, options = {}) {
  return {
    screen,
    layout: options.layout || "dashboard",
    brand: "星命水浒",
    background: options.background || currentChapter(stateValue)?.bg || CHAPTERS[0]?.bg,
    header: {
      ...headerFor(stateValue, active, options),
      ...(options.header || {}),
    },
    nav: options.hideNav ? [] : navFor(active, options.back),
    hero: options.hero || null,
    actions: options.actions || [],
    tabs: options.tabs || [],
    cards: options.cards || [],
    columns: options.columns || 2,
    forms: options.forms || [],
    modal: options.modal || null,
    detail: options.detail || null,
  };
}

export function heroBannerFromHero(stateValue, heroId, eyebrow) {
  const hero = HEROES[heroId];
  const entry = stateValue?.roster?.[heroId];
  if (!hero) return null;
  return {
    image: hero.cutout || hero.portrait || hero.keyart,
    eyebrow: eyebrow || `${hero.star} · ${hero.nickname}`,
    title: hero.name,
    subtitle: `Lv.${entry?.level || 1} · ${hero.role}`,
  };
}

export function teamPowerLabel(stateValue) {
  return `${Math.round(totalPower(stateValue))}`;
}

export function teamCards(stateValue) {
  return activeHeroes(stateValue).map(({ heroId, entry, row }) => ({
    id: `team-${heroId}`,
    title: HEROES[heroId]?.name || heroId,
    meta: `${["前阵", "中军", "后阵"][row] || "战阵"} · Lv.${entry?.level || 1}`,
    image: HEROES[heroId]?.cutout || HEROES[heroId]?.portrait,
    action: "equipment-hero",
    data: { hero: heroId },
    icon: "users",
    tone: "primary",
  }));
}

export function modalModel(modalValue) {
  if (!modalValue) return null;
  const actions = (modalValue.actions || []).map((item, index) => {
    const data = {};
    for (const [key, value] of Object.entries(item)) {
      if (!["label", "action", "tone", "icon", "disabled"].includes(key)) {
        if (value !== undefined && value !== null) data[key] = value;
      }
    }
    return action(
      `modal-${index}`,
      item.label,
      item.action,
      data,
      {
        tone: item.tone,
        icon: item.icon || "chevron",
        disabled: item.disabled,
      },
    );
  });
  return {
    title: modalValue.title || "",
    body: plainText(modalValue.body),
    actions,
    onDismiss: action(
      "modal-dismiss",
      "关闭",
      "close-modal",
      {},
      { tone: "ghost", icon: "back" },
    ),
  };
}
