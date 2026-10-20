import {
  AUTO_BATTLE_TACTICS,
} from "../../data.js";
import {
  action,
  baseModel,
  modalModel,
} from "./common.js";

const UI_SCALES = Object.freeze([
  { id: "normal", label: "标准" },
  { id: "large", label: "较大" },
  { id: "largest", label: "最大" },
]);

const TEXT_SPEEDS = Object.freeze([
  { id: "slow", label: "缓读" },
  { id: "normal", label: "标准" },
  { id: "fast", label: "快读" },
]);

const VOLUME_CONTROLS = Object.freeze([
  {
    id: "musicVolume",
    label: "配乐音量",
    shortLabel: "配乐",
    icon: "music",
  },
  {
    id: "sfxVolume",
    label: "音效音量",
    shortLabel: "音效",
    icon: "volume-2",
  },
]);

function choiceCard(id, label, active, actionName, data, options = {}) {
  return {
    id,
    title: label,
    meta: options.meta || (active ? "当前选择" : "可切换"),
    body: options.body || "",
    icon: options.icon || "settings",
    tone: active ? "primary" : "ghost",
    badge: active ? "已选" : "选择",
    action: actionName,
    data,
    pressed: active,
  };
}

function toggleCard(id, title, active, actionName, body) {
  return {
    id,
    title,
    meta: active ? "已开启" : "已关闭",
    body,
    icon: "settings",
    badge: active ? "关闭" : "开启",
    action: actionName,
    data: {},
    tone: active ? "primary" : "ghost",
    pressed: active,
  };
}

export function buildSettingsModel(context) {
  const {
    state,
    modal,
    settingsOrigin,
  } = context;
  const backAction =
    settingsOrigin === "title"
      ? "back-from-settings"
      : settingsOrigin === "ending"
        ? "back-from-settings"
        : "nav-map";
  const volumeControls = VOLUME_CONTROLS.map((control) => ({
    ...control,
    value: state.settings[control.id],
    output: `${state.settings[control.id]}%`,
  }));
  const forms = [
    ...volumeControls.map((control) => ({
      id: `volume-${control.id}`,
      type: "range",
      label: control.label,
      value: control.value,
      min: 0,
      max: 100,
      step: 1,
      output: control.output,
      data: { volumeSetting: control.id },
    })),
    {
      id: "save-import",
      type: "file",
      label: "导入存档",
      accept: ".json,application/json",
      data: { saveImport: "" },
    },
  ];
  const cards = [
    toggleCard(
      "sound",
      "声音",
      state.settings.sound,
      "toggle-sound",
      "配乐与战斗音效",
    ),
    toggleCard(
      "motion",
      "减少动态",
      state.settings.reducedMotion,
      "toggle-motion",
      "减少位移、闪烁和环境粒子",
    ),
    toggleCard(
      "contrast",
      "高对比",
      state.settings.highContrast,
      "toggle-contrast",
      "提高文字与边界辨识度",
    ),
    toggleCard(
      "auto-battle",
      "自动战斗",
      state.settings.autoBattle,
      "toggle-auto-battle",
      "由战阵自动选择招式与目标",
    ),
    toggleCard(
      "auto-arena",
      "演武续阵",
      state.settings.autoArena,
      "toggle-arena-auto",
      "阵后采纳建议并继续下一阵",
    ),
    ...volumeControls.map((control) =>
      choiceCard(
        `volume-${control.id}`,
        `${control.shortLabel} ${control.value}%`,
        false,
        "focus-settings-control",
        { control: `volume-${control.id}` },
        {
          meta: "精调音量",
          body: "聚焦后可拖动原生滑杆，也可用方向键微调。",
          icon: control.icon,
        },
      ),
    ),
    ...UI_SCALES.map((scale) =>
      choiceCard(
        `ui-scale-${scale.id}`,
        `界面字号 · ${scale.label}`,
        state.settings.uiScale === scale.id,
        "ui-scale",
        { scale: scale.id },
        {
          meta: state.settings.uiScale === scale.id
            ? "当前字号"
            : "调整界面文字",
          icon: "text",
        },
      ),
    ),
    {
      id: "speed",
      title: `战斗速度 ${state.settings.battleSpeed}x`,
      meta: state.settings.battleSpeed === 4 ? "极速" : "节奏",
      body: "影响结算、敌方行动与自动出招",
      icon: "gauge",
      badge: "切换",
      action: "battle-speed",
      data: {
        speed:
          state.settings.battleSpeed === 1
            ? 2
            : state.settings.battleSpeed === 2
              ? 4
              : 1,
      },
      tone: "primary",
    },
    ...TEXT_SPEEDS.map((speed) =>
      choiceCard(
        `text-speed-${speed.id}`,
        `文字节奏 · ${speed.label}`,
        state.settings.textSpeed === speed.id,
        "text-speed",
        { speed: speed.id },
        {
          meta: state.settings.textSpeed === speed.id
            ? "当前节奏"
            : "调整剧情文字",
          icon: "text",
        },
      ),
    ),
  ];
  const tactics = Object.values(AUTO_BATTLE_TACTICS).map((tactic) => ({
    ...tactic,
    active: state.settings.autoTactic === tactic.id,
  }));
  return baseModel("settings", state, "settings", {
    header: {
      title: "卷宗与偏好",
      stats: [
        { label: "存档", value: state.lastSavedAt ? "已写" : "未存" },
        { label: "完成", value: `${state.stats.battlesWon || 0} 胜` },
      ],
    },
    hero: {
      image: null,
      eyebrow: "卷宗与偏好",
      title: "游戏设置",
      subtitle: "只保留会影响游玩节奏的选项，修改后自动保存。",
      body: "精确数值由原生控件承载，键盘、手柄与触屏均可操作。",
    },
    actions: [
      action("save", "立即保存", "manual-save", {}, {
        tone: "primary",
        icon: "star",
      }),
      action("export", "导出存档", "export-save", {}, {
        tone: "secondary",
        icon: "scroll",
      }),
      action("import", "导入存档", "trigger-save-import", {}, {
        tone: "secondary",
        icon: "scroll",
      }),
      action("back", "返回游戏", backAction, {}, {
        tone: "ghost",
        icon: "back",
      }),
      action("delete", "删除存档", "ask-delete-save", {}, {
        tone: "danger",
        icon: "back",
      }),
    ],
    tabs: tactics.map((tactic) => ({
      id: tactic.id,
      label: tactic.name,
      action: "auto-tactic",
      data: { tactic: tactic.id },
      active: tactic.active,
      pressed: tactic.active,
    })),
    cards,
    columns: 3,
    forms,
    modal: modalModel(modal),
    detail: {
      settings: { ...state.settings },
      cards,
      cardCount: cards.length,
      forms,
      volumeControls,
      uiScales: UI_SCALES.map((scale) => ({
        ...scale,
        active: state.settings.uiScale === scale.id,
      })),
      textSpeeds: TEXT_SPEEDS.map((speed) => ({
        ...speed,
        active: state.settings.textSpeed === speed.id,
      })),
      autoTactics: tactics,
      selectedAutoTactic:
        tactics.find((tactic) => tactic.active)?.id || null,
      save: {
        lastSavedAt: state.lastSavedAt || null,
        canImport: true,
        canExport: true,
      },
      platform: {
        desktop: Boolean(context.desktopStatus?.desktop),
      },
    },
  });
}
