import { createGameStage } from "./game-stage.js";

const HOST_ID = "game-stage-host";
const CANVAS_ID = "game-stage-canvas";

function actionElement(data = {}) {
  const dataset = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value !== undefined && value !== null) {
      dataset[key] = String(value);
    }
  }
  return { dataset };
}

export class PageStage {
  constructor(options = {}) {
    this.canvas = null;
    this.host = null;
    this.stage = null;
    this.starting = null;
    this.visible = true;
    this.pendingModel = null;
    this.onAction = options.onAction || (() => {});
    this.onError = options.onError || (() => {});
    this.onReady = options.onReady || (() => {});
  }

  ensureHost() {
    if (this.host?.isConnected && this.canvas?.isConnected) {
      return this.host;
    }
    let host = document.querySelector(`#${HOST_ID}`);
    if (!host) {
      host = document.createElement("div");
      host.id = HOST_ID;
      host.setAttribute("aria-hidden", "true");
      document.body.append(host);
    }
    let canvas = host.querySelector(`#${CANVAS_ID}`);
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = CANVAS_ID;
      canvas.tabIndex = -1;
      host.append(canvas);
    }
    this.host = host;
    this.canvas = canvas;
    return host;
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    const host = this.ensureHost();
    document.body.classList.toggle("is-page-stage-visible", this.visible);
    host.classList.toggle("is-visible", this.visible);
    if (this.stage?.scene) {
      if (this.visible) this.stage.scene.scene.resume();
      else this.stage.scene.scene.pause();
    }
  }

  async sync(model) {
    this.pendingModel = model;
    if (!model) return;
    this.ensureHost();
    const canvas = this.canvas;
    this.setVisible(true);
    if (this.stage) {
      this.stage.setModel(model);
      globalThis.__shuihuPageEngine =
        this.stage.mode === "phaser" ? "phaser" : "loading";
      return;
    }
    if (this.starting) return this.starting;
    this.starting = this.startStage(canvas);
    return this.starting;
  }

  async startStage(canvas) {
    try {
      this.stage = createGameStage(canvas, {
        callbacks: {
          onAction: (action, data, item) => {
            this.onAction(action, actionElement(data), item);
          },
          onReady: () => {
            globalThis.__shuihuPageEngine = "phaser";
            this.stage?.setModel(this.pendingModel);
            this.stage?.refreshViewport?.();
            this.onReady(this.stage);
          },
        },
      });
      globalThis.__shuihuPageStage = this.stage;
      globalThis.__shuihuPageEngine = "loading";
      this.stage.setModel(this.pendingModel);
      await this.stage.start();
      this.stage.refreshViewport();
      globalThis.__shuihuPageEngine = "phaser";
      return this.stage;
    } catch (error) {
      globalThis.__shuihuPageEngine = "failed";
      this.onError(error);
      return null;
    } finally {
      this.starting = null;
    }
  }

  hide() {
    this.setVisible(false);
  }

  showToast(message, tone = "default", duration = 2800) {
    this.stage?.showToast?.(message, tone, duration);
  }

  refresh() {
    this.stage?.refreshViewport?.();
  }
}

export function createPageStage(options) {
  return new PageStage(options);
}
