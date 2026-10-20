const COLORS = Object.freeze({
  ink: 0x050807,
  panel: 0x0a100f,
  panelRaised: 0x151d1a,
  line: 0x3a443b,
  paper: 0xf2ead8,
  paperMuted: 0xa79c84,
  muted: 0x9c927d,
  faint: 0x687067,
  bronze: 0xd8b970,
  bronzeDim: 0x80683c,
  teal: 0x73aaa1,
  tealDim: 0x315653,
  cinnabar: 0xb95845,
  blue: 0x89a9bd,
});

const TONE_COLORS = Object.freeze({
  primary: COLORS.tealDim,
  secondary: COLORS.bronzeDim,
  danger: COLORS.cinnabar,
  ghost: COLORS.panelRaised,
});

const UI_ASSETS = Object.freeze({
  pattern: "/assets/ui/ornaments/song_cloud_pattern.webp",
  corner: "/assets/ui/ornaments/bronze_cloud_corner.png",
});

const TEXT_STYLE = Object.freeze({
  sans: '"PingFang SC", "Microsoft YaHei", sans-serif',
  serif: '"Songti SC", STSong, serif',
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hashSeed(value) {
  const text = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function assetKey(url) {
  return `game-ui-asset-${hashSeed(url).toString(16)}`;
}

function overlaps(a, b, padding = 1) {
  return (
    Math.min(a.x + a.width, b.x + b.width) >
      Math.max(a.x, b.x) + padding &&
    Math.min(a.y + a.height, b.y + b.height) >
      Math.max(a.y, b.y) + padding
  );
}

function rectWithin(rect, width, height) {
  return (
    rect.x >= -1 &&
    rect.y >= -1 &&
    rect.x + rect.width <= width + 1 &&
    rect.y + rect.height <= height + 1
  );
}

export class GameStage {
  constructor(canvas, options = {}) {
    if (!canvas) throw new TypeError("Game stage requires a canvas");
    this.canvas = canvas;
    this.callbacks = options.callbacks || {};
    this.mode = "pending";
    this.phaserReady = false;
    this.destroyed = false;
    this.width = 1;
    this.height = 1;
    this.model = null;
    this.scene = null;
    this.game = null;
    this.uiLayer = null;
    this.graphics = null;
    this.backgroundImage = null;
    this.hitAreas = new Map();
    this.textRects = [];
    this.imageRects = [];
    this.glyphRects = [];
    this.assetUrls = new Map();
    this.renderQueued = false;
    this.toast = null;
    this.toastTimer = null;
    this.cardPage = 0;
    this.cardPageKey = "";
    this.refreshViewport();
  }

  async start() {
    if (this.game || this.destroyed) return this.game;
    this.mode = "loading";
    const module = await import("phaser");
    if (this.destroyed) return null;
    const Phaser =
      module.default?.Game
        ? module.default
        : module.Phaser?.Game
          ? module.Phaser
          : module.Game
            ? module
            : module.default || module;
    if (!Phaser?.Game) throw new TypeError("Phaser did not expose Game");
    this.engine = Phaser;
    const supportsWebGl = Boolean(
      Phaser.Device?.Features?.webGL ?? Phaser.Device?.Features?.webgl,
    );
    const stage = this;
    this.game = new Phaser.Game({
      type: supportsWebGl ? Phaser.WEBGL : Phaser.CANVAS,
      canvas: this.canvas,
      parent: this.canvas.parentElement,
      width: Math.max(1, Math.round(this.width)),
      height: Math.max(1, Math.round(this.height)),
      transparent: true,
      antialias: true,
      render: {
        antialias: true,
        pixelArt: false,
        roundPixels: false,
      },
      scale: {
        mode: Phaser.Scale.NONE,
        autoCenter: Phaser.Scale.NO_CENTER,
        width: Math.max(1, Math.round(this.width)),
        height: Math.max(1, Math.round(this.height)),
      },
      scene: {
        key: "shuihu-game-shell",
        create() {
          stage.createScene(this);
        },
        update(time, delta) {
          stage.updateScene(time, delta);
        },
      },
    });
    await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const wait = () => {
        if (stage.phaserReady) resolve();
        else if (stage.destroyed) resolve();
        else if (performance.now() - startedAt > 8000) {
          reject(new Error("Phaser scene start timed out"));
        } else {
          requestAnimationFrame(wait);
        }
      };
      requestAnimationFrame(wait);
    });
    return this.game;
  }

  createScene(scene) {
    this.scene = scene;
    this.mode = "phaser";
    this.phaserReady = true;
    this.backgroundImage = scene.add.image(0, 0, "__DEFAULT").setVisible(false);
    this.shadeGraphics = scene.add.graphics().setDepth(-90);
    this.hoverGraphics = scene.add.graphics().setDepth(95);
    this.uiLayer = scene.add.container(0, 0).setDepth(100);
    this.graphics = scene.add.graphics().setDepth(0);
    this.resizeHandler = (gameSize) =>
      this.resizeTo(gameSize.width, gameSize.height);
    scene.scale.on("resize", this.resizeHandler);
    this.refreshViewport();
    this.queueModelAssets();
    this.render();
    this.callbacks.onReady?.();
  }

  updateScene() {
    if (!this.phaserReady || this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
    });
  }

  refreshViewport() {
    const rect = this.canvas.getBoundingClientRect?.();
    this.resizeTo(
      Number(rect?.width) || Number(this.canvas.width) || 1,
      Number(rect?.height) || Number(this.canvas.height) || 1,
    );
  }

  resizeTo(width, height) {
    const nextWidth = Math.max(1, Number(width) || 1);
    const nextHeight = Math.max(1, Number(height) || 1);
    if (
      Math.abs(nextWidth - this.width) < 0.5 &&
      Math.abs(nextHeight - this.height) < 0.5
    ) {
      return;
    }
    this.width = nextWidth;
    this.height = nextHeight;
    if (this.game?.scale) {
      this.game.scale.resize(
        Math.max(1, Math.round(this.width)),
        Math.max(1, Math.round(this.height)),
      );
    }
    this.render();
  }

  setModel(model) {
    const nextPageKey = `${model?.screen || ""}:${model?.layout || ""}`;
    if (nextPageKey !== this.cardPageKey) {
      this.cardPage = 0;
      this.cardPageKey = nextPageKey;
    }
    this.model = model || null;
    this.queueModelAssets();
    this.render();
  }

  queueModelAssets() {
    if (!this.scene?.load || !this.model) return;
    const urls = [
      ...Object.values(UI_ASSETS),
      this.model.background,
      this.model.hero?.image,
      ...(this.model.cards || []).map((card) => card.image),
      ...(this.model.actions || []).map((action) => action.image),
    ].filter(Boolean);
    let queued = false;
    for (const url of [...new Set(urls)]) {
      const key = assetKey(url);
      this.assetUrls.set(key, url);
      if (this.scene.textures.exists(key)) continue;
      this.scene.load.image(key, url);
      queued = true;
    }
    if (!queued || this.assetLoading) return;
    this.assetLoading = true;
    this.scene.load.once("complete", () => {
      this.assetLoading = false;
      this.render();
    });
    this.scene.load.once("loaderror", () => {
      this.assetLoading = false;
    });
    this.scene.load.start();
  }

  clearUi() {
    this.hitAreas.clear();
    this.textRects = [];
    this.imageRects = [];
    this.glyphRects = [];
    this.uiLayer?.removeAll?.(true);
    this.graphics?.clear?.();
    this.shadeGraphics?.clear?.();
    this.hoverGraphics?.clear?.();
    this.backgroundImage?.setVisible(false);
  }

  render() {
    if (!this.phaserReady || !this.scene || !this.model) return;
    this.clearUi();
    const model = this.model;
    this.drawBackground(model.background, model);
    this.drawScreenTexture(model);
    if (model.layout === "title") this.drawTitle(model);
    else if (model.layout === "story") this.drawStory(model);
    else if (model.screen === "final-choice") this.drawFinalChoice(model);
    else if (model.layout === "choice") this.drawChoice(model);
    else if (model.screen === "map") this.drawMap(model);
    else if (model.screen === "equipment") this.drawEquipment(model);
    else if (model.screen === "quests") this.drawQuestBoard(model);
    else if (model.screen === "codex") this.drawCodex(model);
    else if (model.screen === "arena") this.drawArena(model);
    else if (model.screen === "arena-reward") this.drawArenaReward(model);
    else if (["roster", "formation"].includes(model.screen)) {
      this.drawHeroWorkspace(model);
    } else if (model.screen === "camp") this.drawCamp(model);
    else if (model.screen === "reward") this.drawVictory(model);
    else if (model.screen === "ending") this.drawEnding(model);
    else if (model.screen === "settings") this.drawSettings(model);
    else this.drawDashboard(model);
    if (model.modal) this.drawModal(model.modal);
    if (this.toast && ["title", "story"].includes(model.layout)) {
      this.drawFloatingToast(this.toast);
    }
    this.audit = this.auditLayout();
  }

  drawBackground(url, model = null) {
    if (!url) {
      this.graphics.fillStyle(COLORS.ink, 1);
      this.graphics.fillRect(0, 0, this.width, this.height);
      this.graphics.fillStyle(0x0c2020, 0.95);
      this.graphics.fillRect(0, this.height * 0.52, this.width, this.height * 0.48);
      return;
    }
    const key = assetKey(url);
    if (!this.scene.textures.exists(key)) {
      this.graphics.fillStyle(COLORS.ink, 1);
      this.graphics.fillRect(0, 0, this.width, this.height);
      return;
    }
    this.backgroundImage
      .setTexture(key)
      .setVisible(true)
      .setPosition(this.width / 2, this.height / 2);
    const source = this.backgroundImage.texture?.getSourceImage?.();
    const sourceWidth = Number(source?.width) || Number(this.backgroundImage.width) || 1;
    const sourceHeight = Number(source?.height) || Number(this.backgroundImage.height) || 1;
    const scale = Math.max(
      this.width / Math.max(1, sourceWidth),
      this.height / Math.max(1, sourceHeight),
    );
    this.backgroundImage.setDisplaySize(sourceWidth * scale, sourceHeight * scale);
    const screen = model?.screen || "";
    const compact = this.width < 900;
    if (model?.layout === "title") {
      const focusWidth = compact ? this.width : this.width * 0.58;
      this.shadeGraphics.fillStyle(0x020505, 0.08);
      this.shadeGraphics.fillRect(0, 0, this.width, this.height);
      for (let index = 0; index < 8; index += 1) {
        const bandWidth = focusWidth / 8;
        this.shadeGraphics.fillStyle(0x020505, 0.1 + index * 0.055);
        this.shadeGraphics.fillRect(index * bandWidth, 0, bandWidth + 1, this.height);
      }
      this.shadeGraphics.fillStyle(0x020505, 0.36);
      this.shadeGraphics.fillRect(0, 0, this.width, compact ? 90 : 72);
      this.shadeGraphics.fillStyle(0x020505, 0.44);
      this.shadeGraphics.fillRect(0, this.height * 0.78, this.width, this.height * 0.22);
      return;
    }
    if (screen === "map") {
      this.shadeGraphics.fillStyle(0x020505, 0.2);
      this.shadeGraphics.fillRect(0, 0, this.width, this.height);
      this.shadeGraphics.fillStyle(0x020505, 0.52);
      this.shadeGraphics.fillRect(0, this.height * 0.7, this.width, this.height * 0.3);
      return;
    }
    if (["roster", "formation", "equipment"].includes(screen)) {
      this.shadeGraphics.fillStyle(0x020505, 0.28);
      this.shadeGraphics.fillRect(0, 0, this.width, this.height);
      const scrimWidth = compact ? this.width : this.width * 0.46;
      for (let index = 0; index < 6; index += 1) {
        this.shadeGraphics.fillStyle(0x020505, 0.08 + index * 0.035);
        this.shadeGraphics.fillRect(
          (index * scrimWidth) / 6,
          0,
          scrimWidth / 6 + 1,
          this.height,
        );
      }
      return;
    }
    this.shadeGraphics.fillStyle(0x020707, 0.36);
    this.shadeGraphics.fillRect(0, 0, this.width, this.height);
    this.shadeGraphics.fillStyle(0x020707, 0.64);
    this.shadeGraphics.fillRect(0, this.height * 0.6, this.width, this.height * 0.4);
  }

  getFrame() {
    const compact = this.width < 900;
    const hasNavigation = Boolean(this.model?.nav?.length);
    const headerHeight = compact ? 66 : 76;
    const outerMargin = compact ? 10 : 22;
    const navWidth = compact || !hasNavigation ? 0 : 82;
    const navHeight = compact && hasNavigation ? 58 : 0;
    const availableWidth = Math.max(
      120,
      this.width - navWidth - outerMargin * 2,
    );
    const contentWidth = Math.min(
      availableWidth,
      compact ? availableWidth : 1216,
    );
    const contentX =
      navWidth +
      outerMargin +
      Math.max(0, (availableWidth - contentWidth) / 2);
    const contentY = headerHeight + (compact ? 8 : 14);
    const contentBottom = navHeight + (compact ? 10 : 18);
    return {
      compact,
      headerHeight,
      navWidth,
      navHeight,
      content: {
        x: contentX,
        y: contentY,
        width: contentWidth,
        height: Math.max(
          120,
          this.height - contentY - contentBottom,
        ),
      },
    };
  }

  drawActionGrid(actions, x, y, width, columns, compact) {
    const items = (actions || []).filter(Boolean);
    if (!items.length) return 0;
    const columnCount = clamp(columns || items.length, 1, items.length);
    const rows = Math.ceil(items.length / columnCount);
    const gap = compact ? 7 : 9;
    const height = compact ? 40 : 44;
    items.forEach((item, index) => {
      const row = Math.floor(index / columnCount);
      const column = index % columnCount;
      const rowStart = row * columnCount;
      const rowCount = Math.min(columnCount, items.length - rowStart);
      const buttonWidth = (width - gap * (rowCount - 1)) / rowCount;
      this.drawButton(
        x + column * (buttonWidth + gap),
        y + row * (height + gap),
        buttonWidth,
        height,
        item,
        compact,
      );
    });
    return rows * height + (rows - 1) * gap;
  }

  drawSectionHeading(x, y, eyebrow, title, body, width, compact) {
    const g = this.graphics;
    g.fillStyle(COLORS.bronze, 0.78);
    g.fillTriangle(x, y + 5, x + 4, y + 1, x + 8, y + 5);
    g.fillTriangle(x, y + 5, x + 4, y + 9, x + 8, y + 5);
    this.addText(x + 13, y, eyebrow || "", {
      fontSize: compact ? "9px" : "10px",
      letterSpacing: 1.1,
      color: "#d8b970",
      wordWrap: { width: width - 13, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(x, y + (compact ? 14 : 17), title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: compact ? "24px" : "32px",
      fontStyle: "bold",
      color: "#f2ead8",
      wordWrap: { width, useAdvancedWrap: true },
      maxLines: 1,
    });
    if (body) {
      this.addText(x, y + (compact ? 54 : 72), body, {
        fontSize: compact ? "10px" : "12px",
        color: "#ddd0b9",
        lineSpacing: compact ? 5 : 6,
        wordWrap: { width, useAdvancedWrap: true },
        maxLines: 2,
      });
    }
  }

  drawScreenTexture(model) {
    if (!model) return;
    this.addTiledImage(0, 0, this.width, this.height, UI_ASSETS.pattern, {
      alpha: model.layout === "title" ? 0.035 : 0.065,
      blendMode: "SCREEN",
      decorative: true,
      tileScale: 0.58,
    });
  }

  drawPanelOrnaments(x, y, width, height, options = {}) {
    if (width < 220 || height < 150) return;
    const size = clamp(
      Number(options.size) || Math.min(width, height) * 0.22,
      76,
      116,
    );
    const alpha = options.alpha ?? 0.24;
    const inset = options.inset ?? -3;
    const half = size / 2;
    const points = [
      [x + inset + half, y + inset + half, 0],
      [x + width - inset - half, y + inset + half, Math.PI / 2],
      [x + width - inset - half, y + height - inset - half, Math.PI],
      [x + inset + half, y + height - inset - half, -Math.PI / 2],
    ];
    const corners = Number(options.corners) || points.length;
    points.slice(0, clamp(corners, 1, points.length)).forEach(
      ([centerX, centerY, rotation]) => {
        this.addImage(centerX, centerY, UI_ASSETS.corner, size, size, {
          alpha,
          blendMode: "SCREEN",
          decorative: true,
          rotation,
        });
      },
    );
  }

  drawCornerBrackets(x, y, width, height, tone, alpha = 0.52) {
    const graphics = this.graphics;
    const length = clamp(Math.min(width, height) * 0.1, 7, 14);
    graphics.lineStyle(1, tone, alpha);
    graphics.lineBetween(x, y + length, x, y);
    graphics.lineBetween(x, y, x + length, y);
    graphics.lineBetween(x + width - length, y, x + width, y);
    graphics.lineBetween(x + width, y, x + width, y + length);
    graphics.lineBetween(x, y + height - length, x, y + height);
    graphics.lineBetween(x, y + height, x + length, y + height);
    graphics.lineBetween(x + width - length, y + height, x + width, y + height);
    graphics.lineBetween(x + width, y + height - length, x + width, y + height);
  }

  drawMap(model) {
    const frame = this.getFrame();
    this.drawHeader(model, frame);
    this.drawNavigation(model, frame);
    const content = frame.content;
    const compact = frame.compact || this.width < 980;
    const cards = model.cards || [];
    const actions = model.actions || [];
    if (compact) {
      const headingWidth = content.width;
      this.drawSectionHeading(
        content.x,
        content.y,
        model.hero?.eyebrow,
        model.hero?.title,
        model.hero?.subtitle,
        headingWidth,
        true,
      );
      let y = content.y + 88;
      const actionHeight = this.drawActionGrid(
        actions,
        content.x,
        y,
        content.width,
        this.width < 540 ? 2 : 4,
        true,
      );
      y += actionHeight + 10;
      this.drawChapterRouteCards(
        cards,
        { x: content.x, y, width: content.width, height: content.y + content.height - y },
        model,
        true,
      );
      return;
    }

    const leftWidth = clamp(content.width * 0.31, 320, 410);
    const routeX = content.x + leftWidth + 18;
    const routeWidth = content.width - leftWidth - 18;
    const g = this.graphics;
    g.fillStyle(COLORS.ink, 0.42);
    g.fillRect(content.x, content.y, leftWidth, content.height);
    g.fillStyle(COLORS.bronze, 0.85);
    g.fillRect(content.x, content.y, 3, Math.min(180, content.height));
    g.lineStyle(1, COLORS.line, 0.5);
    g.lineBetween(content.x + leftWidth, content.y + 1, content.x + leftWidth, content.y + content.height - 1);
    this.drawPanelOrnaments(
      content.x,
      content.y,
      leftWidth,
      content.height,
      { alpha: 0.18, corners: 2 },
    );

    const textX = content.x + 24;
    const textWidth = leftWidth - 48;
    this.addText(textX, content.y + 22, model.hero?.eyebrow || "", {
      fontSize: "10px",
      letterSpacing: 1.3,
      color: "#d8b970",
      wordWrap: { width: textWidth, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(textX, content.y + 44, model.hero?.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "36px",
      fontStyle: "bold",
      color: "#f2ead8",
      stroke: "#050807",
      strokeThickness: 2,
      wordWrap: { width: textWidth, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(textX, content.y + 96, model.hero?.subtitle || "", {
      fontSize: "12px",
      color: "#d5c5a9",
      lineSpacing: 6,
      wordWrap: { width: textWidth, useAdvancedWrap: true },
      maxLines: 3,
    });
    g.lineStyle(1, COLORS.bronzeDim, 0.58);
    g.lineBetween(textX, content.y + 158, textX + textWidth, content.y + 158);
    this.addText(textX, content.y + 174, "行军决断", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "14px",
      color: "#f2ead8",
    });
    const actionY = content.y + 202;
    const actionHeight = this.drawActionGrid(
      actions,
      textX,
      actionY,
      textWidth,
      2,
      false,
    );
    const noteY = Math.min(
      content.y + content.height - 56,
      actionY + actionHeight + 28,
    );
    this.addText(textX, noteY, "择地而行，整备三阵，再赴风雪。", {
      fontSize: "11px",
      color: "#aaa08a",
      wordWrap: { width: textWidth, useAdvancedWrap: true },
      maxLines: 2,
    });
    this.drawChapterRouteCards(
      cards,
      {
        x: routeX,
        y: content.y + 10,
        width: routeWidth,
        height: content.height - 20,
      },
      model,
      false,
    );
  }

  drawChapterRouteCards(cards, area, model, compact) {
    if (!cards.length) return;
    const gap = compact ? 7 : 10;
    const columns = compact ? (area.width < 420 ? 2 : 2) : 2;
    const pagerHeight = 30;
    const minCardHeight = compact ? 52 : 120;
    const rowsAvailable = compact
      ? clamp(
          Math.floor((area.height + gap) / (minCardHeight + gap)),
          1,
          3,
        )
      : 3;
    const rows = Math.min(rowsAvailable, Math.ceil(cards.length / columns));
    const cardHeight = compact
      ? clamp((area.height - gap * (rows - 1)) / Math.max(1, rows), 52, 94)
      : clamp((area.height - gap * (rows - 1)) / Math.max(1, rows), 120, 210);
    const visible = cards.slice(0, columns * rows);
    const cardWidth = (area.width - gap * (columns - 1)) / columns;
    visible.forEach((card, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = area.x + column * (cardWidth + gap);
      const y = area.y + row * (cardHeight + gap);
      if (compact) {
        this.drawCompactRouteCard(x, y, cardWidth, Math.min(cardHeight, 82), card);
      } else {
        this.drawCinematicRouteCard(x, y, cardWidth, cardHeight, card);
      }
    });
    if (cards.length > visible.length) {
      this.addText(
        area.x,
        area.y + area.height - 18,
        `另有 ${cards.length - visible.length} 回待展`,
        {
          fontSize: "9px",
          color: "#8f856f",
        },
      );
    }
  }

  drawCinematicRouteCard(x, y, width, height, card) {
    const g = this.graphics;
    const disabled = Boolean(card.disabled);
    const selected = card.tone === "primary";
    const image = card.image
      ? this.addImage(x + width / 2, y + height / 2, card.image, width - 2, height - 2, {
          decorative: true,
          alpha: disabled ? 0.24 : 0.74,
        })
      : null;
    if (disabled) image?.setTint?.(0x777b73);
    g.fillStyle(COLORS.ink, disabled ? 0.56 : 0.34);
    g.fillRect(x, y, width, height);
    g.fillStyle(COLORS.ink, 0.72);
    g.fillRect(x, y + height * 0.55, width, height * 0.45);
    g.lineStyle(selected ? 2 : 1, selected ? COLORS.bronze : COLORS.line, selected ? 0.94 : 0.62);
    g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    if (selected) {
      g.fillStyle(COLORS.cinnabar, 0.95);
      g.fillRect(x, y, 4, height);
      g.fillStyle(COLORS.bronze, 0.9);
      g.fillRect(x + 11, y + 10, 28, 2);
    }
    const badge = card.badge || "";
    if (badge) {
      const badgeWidth = clamp(26 + badge.length * 9, 42, 70);
      g.fillStyle(disabled ? COLORS.panelRaised : COLORS.cinnabar, disabled ? 0.72 : 0.88);
      g.fillRect(x + width - badgeWidth - 10, y + 10, badgeWidth, 21);
      this.addCenteredText(
        x + width - badgeWidth / 2 - 10,
        y + 20.5,
        badge,
        {
          fontSize: "9px",
          color: disabled ? "#858a80" : "#f8edda",
        },
        badgeWidth - 6,
      );
    }
    this.addText(x + 16, y + height - 62, card.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "18px",
      fontStyle: "bold",
      color: disabled ? "#8a8f86" : "#f2ead8",
      wordWrap: { width: width - 32, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(x + 16, y + height - 36, card.meta || "", {
      fontSize: "11px",
      color: disabled ? "#7f857b" : "#d8c9ad",
      wordWrap: { width: width - 32, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(x + 16, y + height - 19, card.body || "", {
      fontSize: "11px",
      color: disabled ? "#72786f" : "#b9ab91",
      wordWrap: { width: width - 32, useAdvancedWrap: true },
      maxLines: 1,
    });
    if (card.action && !disabled) {
      this.addHitArea(`card:${card.id || card.title}`, x, y, width, height, card);
    }
  }

  drawCompactRouteCard(x, y, width, height, card) {
    const g = this.graphics;
    const disabled = Boolean(card.disabled);
    const selected = card.tone === "primary";
    g.fillStyle(COLORS.panel, disabled ? 0.72 : 0.92);
    g.fillRect(x, y, width, height);
    g.lineStyle(1, selected ? COLORS.bronze : COLORS.line, selected ? 0.9 : 0.55);
    g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    g.fillStyle(selected ? COLORS.cinnabar : COLORS.bronzeDim, selected ? 0.9 : 0.45);
    g.fillRect(x, y, 3, height);
    if (card.image) {
      this.addImage(x + 34, y + height / 2, card.image, 52, Math.max(44, height - 12), {
        decorative: true,
        alpha: disabled ? 0.35 : 0.72,
      });
    }
    const textX = card.image ? x + 66 : x + 14;
    this.addText(textX, y + 10, card.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "13px",
      fontStyle: "bold",
      color: disabled ? "#858a80" : "#f2ead8",
      wordWrap: { width: width - (textX - x) - 10, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(textX, y + 31, card.meta || "", {
      fontSize: "9px",
      color: disabled ? "#7f857b" : "#c8b99e",
      wordWrap: { width: width - (textX - x) - 10, useAdvancedWrap: true },
      maxLines: 1,
    });
    if (height >= 70) {
      this.addText(textX, y + 47, card.body || "", {
        fontSize: "9px",
        color: disabled ? "#72786f" : "#aaa08a",
        wordWrap: { width: width - (textX - x) - 10, useAdvancedWrap: true },
        maxLines: 1,
      });
    }
    if (card.action && !disabled) {
      this.addHitArea(`card:${card.id || card.title}`, x, y, width, height, card);
    }
  }

  drawHeroWorkspace(model) {
    const frame = this.getFrame();
    this.drawHeader(model, frame);
    this.drawNavigation(model, frame);
    const content = frame.content;
    const compact = frame.compact || this.width < 1080;
    const cards = model.cards || [];
    const actions = model.actions || [];
    const tabs = model.tabs || [];
    if (compact) {
      const heroHeight = this.width < 540 ? 116 : 142;
      this.drawCompactHeroProfile(
        model.hero,
        content.x,
        content.y,
        content.width,
        heroHeight,
      );
      let y = content.y + heroHeight + 9;
      const actionHeight = this.drawActionGrid(
        actions,
        content.x,
        y,
        content.width,
        this.width < 540 ? 2 : 3,
        true,
      );
      y += actionHeight + 8;
      const tabHeight = this.drawWrappedTabs(tabs, content.x, y, content.width, true);
      if (tabHeight) y += tabHeight + 8;
      this.drawCompactHeroGrid(
        cards,
        { x: content.x, y, width: content.width, height: content.y + content.height - y },
        model,
      );
      return;
    }

    const profileWidth = clamp(content.width * 0.39, 410, 510);
    const g = this.graphics;
    g.fillStyle(COLORS.ink, 0.74);
    g.fillRect(content.x, content.y, profileWidth, content.height);
    g.lineStyle(1, COLORS.bronzeDim, 0.5);
    g.strokeRect(content.x + 0.5, content.y + 0.5, profileWidth - 1, content.height - 1);
    g.fillStyle(COLORS.bronze, 0.82);
    g.fillRect(content.x, content.y, 3, 150);
    this.drawPanelOrnaments(
      content.x,
      content.y,
      profileWidth,
      content.height,
      { alpha: 0.2, corners: 2 },
    );
    this.drawDesktopHeroProfile(model.hero, content.x, content.y, profileWidth, content);
    let y = content.y + 322;
    const actionHeight = this.drawActionGrid(
      actions,
      content.x + 24,
      y,
      profileWidth - 48,
      2,
      false,
    );
    y += actionHeight + 14;
    const tabHeight = this.drawWrappedTabs(
      tabs,
      content.x + 24,
      y,
      profileWidth - 48,
      false,
    );
    const gridX = content.x + profileWidth + 16;
    const gridWidth = content.width - profileWidth - 16;
    this.drawPortraitCardGrid(
      cards,
      { x: gridX, y: content.y, width: gridWidth, height: content.height - tabHeight - 4 },
      model,
    );
  }

  drawDesktopHeroProfile(hero, x, y, width, content) {
    if (!hero) return;
    const textX = x + Math.min(214, width * 0.46);
    const textWidth = width - (textX - x) - 28;
    const imageWidth = Math.min(230, width * 0.48);
    if (hero.image) {
      this.graphics.fillStyle(COLORS.panelRaised, 0.3);
      this.graphics.fillCircle(
        x + imageWidth * 0.48,
        y + 170,
        Math.min(124, imageWidth * 0.55),
      );
      this.addImage(
        x + imageWidth * 0.48,
        y + 171,
        hero.image,
        imageWidth - 14,
        Math.min(282, content.height * 0.46),
        { decorative: true, alpha: 0.98 },
      );
    }
    this.addText(textX, y + 30, hero.eyebrow || "", {
      fontSize: "10px",
      letterSpacing: 1.4,
      color: "#d8b970",
      wordWrap: { width: textWidth, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(textX, y + 53, hero.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "34px",
      fontStyle: "bold",
      color: "#f2ead8",
      wordWrap: { width: textWidth, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(textX, y + 102, hero.subtitle || "", {
      fontSize: "11px",
      color: "#c8b99e",
      lineSpacing: 5,
      wordWrap: { width: textWidth, useAdvancedWrap: true },
      maxLines: 4,
    });
    this.graphics.lineStyle(1, COLORS.bronzeDim, 0.58);
    this.graphics.lineBetween(textX, y + 192, x + width - 24, y + 192);
    this.addText(textX, y + 207, hero.body || "点选右侧好汉，查看命途与武备。", {
      fontSize: "10px",
      color: "#aaa08a",
      lineSpacing: 5,
      wordWrap: { width: textWidth, useAdvancedWrap: true },
      maxLines: 3,
    });
  }

  drawCompactHeroProfile(hero, x, y, width, height) {
    const g = this.graphics;
    g.fillStyle(COLORS.ink, 0.72);
    g.fillRect(x, y, width, height);
    g.fillStyle(COLORS.bronze, 0.8);
    g.fillRect(x, y, 3, height);
    g.lineStyle(1, COLORS.line, 0.55);
    g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    const portraitWidth = this.width < 540 ? 82 : 112;
    if (hero?.image) {
      this.addImage(
        x + portraitWidth / 2,
        y + height / 2,
        hero.image,
        portraitWidth - 12,
        height - 14,
        { decorative: true, alpha: 0.96 },
      );
    }
    const textX = x + portraitWidth + 10;
    const textWidth = width - portraitWidth - 22;
    this.addText(textX, y + 12, hero?.eyebrow || "", {
      fontSize: "8px",
      color: "#d8b970",
      wordWrap: { width: textWidth, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(textX, y + 28, hero?.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: this.width < 540 ? "20px" : "25px",
      fontStyle: "bold",
      color: "#f2ead8",
      wordWrap: { width: textWidth, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(textX, y + (this.width < 540 ? 55 : 62), hero?.subtitle || "", {
      fontSize: "9px",
      color: "#c8b99e",
      wordWrap: { width: textWidth, useAdvancedWrap: true },
      maxLines: 2,
    });
  }

  drawWrappedTabs(tabs, x, y, width, compact) {
    if (!tabs.length) return 0;
    const gap = compact ? 5 : 6;
    const height = compact ? 28 : 30;
    let cursorX = x;
    let cursorY = y;
    let rowHeight = 0;
    tabs.forEach((tab) => {
      const tabWidth = clamp(22 + String(tab.label || "").length * (compact ? 8 : 9), 50, 116);
      if (cursorX + tabWidth > x + width && cursorX > x) {
        cursorX = x;
        cursorY += height + gap;
      }
      this.drawTab(cursorX, cursorY, tabWidth, height, tab, compact);
      cursorX += tabWidth + gap;
      rowHeight = height;
    });
    return cursorY - y + rowHeight;
  }

  drawPortraitCardGrid(cards, area, model) {
    if (!cards.length) return;
    const gap = 10;
    const pagerHeight = 32;
    const columns = 2;
    const minHeight = 128;
    const available = Math.max(minHeight, area.height);
    let rows = Math.max(
      1,
      Math.floor((available + gap) / (minHeight + gap)),
    );
    let capacity = rows * columns;
    let pageCount = Math.ceil(cards.length / capacity);
    if (pageCount > 1) {
      rows = Math.max(
        1,
        Math.floor((available - pagerHeight - gap + gap) / (minHeight + gap)),
      );
      capacity = rows * columns;
      pageCount = Math.ceil(cards.length / capacity);
    }
    const page = clamp(this.cardPage, 0, Math.max(0, pageCount - 1));
    this.cardPage = page;
    const visible = cards.slice(page * capacity, page * capacity + capacity);
    const visibleRows = Math.max(1, Math.ceil(visible.length / columns));
    const gridHeight = available - (pageCount > 1 ? pagerHeight + gap : 0);
    const cardHeight = clamp(
      (gridHeight - gap * (visibleRows - 1)) / visibleRows,
      minHeight,
      Math.max(minHeight, gridHeight),
    );
    const cardWidth = (area.width - gap * (columns - 1)) / columns;
    visible.forEach((card, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      this.drawPortraitCard(
        area.x + column * (cardWidth + gap),
        area.y + row * (cardHeight + gap),
        cardWidth,
        cardHeight,
        card,
      );
    });
    if (pageCount > 1) {
      this.drawCardPager(
        area.x,
        area.y + area.height - pagerHeight,
        area.width,
        pagerHeight,
        page,
        pageCount,
        false,
      );
    }
  }

  drawPortraitCard(x, y, width, height, card) {
    const g = this.graphics;
    const selected = card.tone === "primary";
    const disabled = Boolean(card.disabled);
    const image = card.image
      ? this.addImage(x + width / 2, y + height / 2, card.image, width - 2, height - 2, {
          decorative: true,
          alpha: disabled ? 0.3 : 0.82,
        })
      : null;
    if (disabled) image?.setTint?.(0x6d746d);
    g.fillStyle(COLORS.ink, 0.24);
    g.fillRect(x, y, width, height);
    g.fillStyle(COLORS.ink, 0.82);
    g.fillRect(x, y + height * 0.62, width, height * 0.38);
    g.lineStyle(selected ? 2 : 1, selected ? COLORS.bronze : COLORS.line, selected ? 0.96 : 0.62);
    g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    if (selected) {
      g.fillStyle(COLORS.cinnabar, 0.95);
      g.fillRect(x, y, 4, height);
    }
    if (!card.image) {
      this.drawGlyph(g, card.icon || "users", x + width / 2, y + height * 0.38, 34, COLORS.bronze);
    }
    this.addText(x + 14, y + height - 49, card.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "17px",
      fontStyle: "bold",
      color: disabled ? "#858a80" : "#f2ead8",
      wordWrap: { width: width - 28, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(x + 14, y + height - 25, card.meta || card.body || "", {
      fontSize: "10px",
      color: disabled ? "#7f857b" : "#d8c9ad",
      wordWrap: { width: width - 28, useAdvancedWrap: true },
      maxLines: 1,
    });
    if (card.badge) {
      const badgeWidth = clamp(26 + String(card.badge).length * 8, 38, 64);
      g.fillStyle(selected ? COLORS.cinnabar : COLORS.panelRaised, selected ? 0.9 : 0.82);
      g.fillRect(x + width - badgeWidth - 10, y + 10, badgeWidth, 20);
      this.addCenteredText(
        x + width - badgeWidth / 2 - 10,
        y + 20,
        card.badge,
        {
          fontSize: "9px",
          color: selected ? "#fff1db" : "#a79c84",
        },
        badgeWidth - 6,
      );
    }
    if (card.action && !disabled) {
      this.addHitArea(`card:${card.id || card.title}`, x, y, width, height, card);
    }
  }

  drawCompactHeroGrid(cards, area, model) {
    if (!cards.length) return;
    const columns = area.width < 420 ? 2 : 3;
    const gap = 7;
    const pagerHeight = 30;
    const minHeight = 112;
    const available = Math.max(minHeight, area.height);
    let rows = clamp(
      Math.floor((available + gap) / (minHeight + gap)),
      1,
      3,
    );
    let capacity = rows * columns;
    let pageCount = Math.ceil(cards.length / capacity);
    if (pageCount > 1) {
      rows = clamp(
        Math.floor(
          (available - pagerHeight - gap + gap) / (minHeight + gap),
        ),
        1,
        3,
      );
      capacity = rows * columns;
      pageCount = Math.ceil(cards.length / capacity);
    }
    const page = clamp(this.cardPage, 0, Math.max(0, pageCount - 1));
    this.cardPage = page;
    const visible = cards.slice(page * capacity, page * capacity + capacity);
    const visibleRows = Math.max(1, Math.ceil(visible.length / columns));
    const gridHeight = available - (pageCount > 1 ? pagerHeight + gap : 0);
    const cardHeight = clamp(
      (gridHeight - gap * (visibleRows - 1)) / visibleRows,
      minHeight,
      198,
    );
    const cardWidth = (area.width - gap * (columns - 1)) / columns;
    visible.forEach((card, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      this.drawPortraitCard(
        area.x + column * (cardWidth + gap),
        area.y + row * (cardHeight + gap),
        cardWidth,
        cardHeight,
        card,
      );
    });
    if (pageCount > 1) {
      this.drawCardPager(
        area.x,
        area.y + area.height - pagerHeight,
        area.width,
        pagerHeight,
        page,
        pageCount,
        true,
      );
    }
  }

  drawCamp(model) {
    const frame = this.getFrame();
    this.drawHeader(model, frame);
    this.drawNavigation(model, frame);
    const content = frame.content;
    const compact = frame.compact;
    const headingWidth = compact ? content.width : clamp(content.width * 0.52, 430, 640);
    this.drawSectionHeading(
      content.x,
      content.y,
      model.hero?.eyebrow,
      model.hero?.title,
      model.hero?.subtitle,
      headingWidth,
      compact,
    );
    let buildingsY = content.y + (compact ? 108 : 132);
    if (compact) {
      const actionHeight = this.drawActionGrid(
        model.actions || [],
        content.x,
        buildingsY,
        content.width,
        this.width < 540 ? 2 : 4,
        true,
      );
      buildingsY += actionHeight + 12;
    } else {
      const actionWidth = Math.min(560, content.width * 0.46);
      this.drawActionGrid(
        model.actions || [],
        content.x + content.width - actionWidth,
        content.y + 10,
        actionWidth,
        4,
        false,
      );
    }
    const cards = model.cards || [];
    if (!cards.length) return;
    if (!compact && cards.every((card) => card.layout)) {
      const mapColumns = 6;
      const mapRows = 5;
      const mapHeight = content.y + content.height - buildingsY;
      const cellWidth = content.width / mapColumns;
      const cellHeight = mapHeight / mapRows;
      const gap = 7;
      const g = this.graphics;
      g.lineStyle(1, COLORS.bronzeDim, 0.12);
      for (let column = 1; column < mapColumns; column += 1) {
        g.lineBetween(
          content.x + column * cellWidth,
          buildingsY,
          content.x + column * cellWidth,
          buildingsY + mapHeight,
        );
      }
      for (let row = 1; row < mapRows; row += 1) {
        g.lineBetween(
          content.x,
          buildingsY + row * cellHeight,
          content.x + content.width,
          buildingsY + row * cellHeight,
        );
      }
      g.lineStyle(1, COLORS.bronze, 0.18);
      g.lineBetween(
        content.x,
        buildingsY + mapHeight,
        content.x + content.width,
        buildingsY + mapHeight,
      );
      cards.forEach((card) => {
        const layout = card.layout;
        this.drawCampBuildingTile(
          content.x + (layout.column - 1) * cellWidth + gap / 2,
          buildingsY + (layout.row - 1) * cellHeight + gap / 2,
          layout.columns * cellWidth - gap,
          layout.rows * cellHeight - gap,
          card,
          false,
        );
      });
      return;
    }
    const columns = compact ? 2 : 4;
    const gap = compact ? 7 : 10;
    const rows = Math.ceil(cards.length / columns);
    const available = content.y + content.height - buildingsY;
    const cardHeight = clamp(
      (available - gap * (rows - 1)) / Math.max(1, rows),
      compact ? 50 : 112,
      compact ? 132 : 176,
    );
    const cardWidth = (content.width - gap * (columns - 1)) / columns;
    cards.forEach((card, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      this.drawCampBuildingTile(
        content.x + column * (cardWidth + gap),
        buildingsY + row * (cardHeight + gap),
        cardWidth,
        cardHeight,
        card,
        compact,
      );
    });
  }

  drawCampBuildingTile(x, y, width, height, card, compact) {
    const g = this.graphics;
    const disabled = Boolean(card.disabled);
    const built = card.badge === "已建";
    const available = card.badge === "可建";
    const tone = built ? COLORS.teal : available ? COLORS.bronze : COLORS.line;
    g.fillStyle(COLORS.panel, disabled ? 0.58 : built ? 0.9 : 0.8);
    g.fillRect(x, y, width, height);
    g.lineStyle(1, tone, disabled ? 0.35 : 0.7);
    g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    g.fillStyle(tone, disabled ? 0.18 : 0.7);
    g.fillRect(x, y, 3, height);
    if (built) {
      this.addTiledImage(x + 1, y + 1, width - 2, height - 2, UI_ASSETS.pattern, {
        alpha: 0.16,
        blendMode: "SCREEN",
        decorative: true,
        tileScale: 0.32,
      });
    } else if (!available) {
      g.lineStyle(1, COLORS.line, 0.14);
      for (let hatch = -height; hatch < width; hatch += 18) {
        g.lineBetween(x + hatch, y + height, x + hatch + height, y);
      }
    }
    this.drawCornerBrackets(x, y, width, height, tone, disabled ? 0.22 : 0.46);
    const compactTight = compact && height < 76;
    const iconX = x + (compactTight ? 21 : compact ? 25 : 31);
    const iconY = y + (compactTight ? 22 : compact ? 25 : 31);
    g.fillStyle(tone, disabled ? 0.1 : 0.16);
    g.fillCircle(iconX, iconY, compactTight ? 13 : compact ? 16 : 20);
    this.drawGlyph(
      g,
      card.icon || "camp",
      iconX,
      iconY,
      compactTight ? 15 : compact ? 18 : 23,
      disabled ? COLORS.faint : tone,
    );
    const textX = x + (compactTight ? 40 : compact ? 48 : 58);
    this.addText(textX, y + (compactTight ? 8 : compact ? 13 : 16), card.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: compactTight ? "10px" : compact ? "12px" : "15px",
      fontStyle: "bold",
      color: disabled ? "#858a80" : "#f2ead8",
      wordWrap: { width: width - (textX - x) - 12, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(textX, y + (compactTight ? 24 : compact ? 31 : 39), card.meta || "", {
      fontSize: compactTight ? "8px" : compact ? "9px" : "10px",
      color: disabled ? "#7f857b" : built ? "#a9d0c8" : "#d8c9ad",
      wordWrap: { width: width - (textX - x) - 12, useAdvancedWrap: true },
      maxLines: 1,
    });
    if (height >= (compact ? 100 : 124)) {
      this.addText(x + 12, y + (compact ? 58 : 76), card.body || "", {
        fontSize: compact ? "9px" : "11px",
        color: disabled ? "#72786f" : "#c0b39b",
        lineSpacing: compact ? 3 : 5,
        wordWrap: { width: width - 24, useAdvancedWrap: true },
        maxLines: 3,
      });
    }
    if (card.badge) {
      g.fillStyle(tone, disabled ? 0.12 : 0.2);
      const badgeWidth = clamp(26 + card.badge.length * 8, 42, 64);
      const badgeY = compactTight ? y + 6 : y + height - 25;
      g.fillRect(x + width - badgeWidth - 9, badgeY, badgeWidth, 17);
      this.addCenteredText(
        x + width - badgeWidth / 2 - 9,
        badgeY + 8.5,
        card.badge,
        {
          fontSize: "9px",
          color: disabled ? "#737970" : tone === COLORS.teal ? "#9ac2ba" : "#d8b970",
        },
        badgeWidth - 4,
      );
    }
    if (card.action && !disabled) {
      this.addHitArea(`card:${card.id || card.title}`, x, y, width, height, card);
    }
  }

  drawEquipment(model) {
    const frame = this.getFrame();
    this.drawHeader(model, frame);
    this.drawNavigation(model, frame);
    const content = frame.content;
    const compact = frame.compact || this.width < 1080;
    const cards = model.cards || [];
    const equipped = cards.filter((card) => String(card.id).startsWith("equipped-"));
    const inventory = cards.filter(
      (card) => !String(card.id).startsWith("equipped-"),
    );
    const actions = model.actions || [];
    const armory = model.detail?.armory || {};
    const primaryActions = actions.filter((item) =>
      ["recommend", "roster"].includes(item.id),
    );
    const pageActions = actions.filter((item) =>
      ["prev", "next"].includes(item.id),
    );
    const page = model.detail?.page || 1;
    const pages = model.detail?.pages || 1;

    if (compact) {
      this.drawCompactHeroProfile(
        model.hero,
        content.x,
        content.y,
        content.width,
        126,
      );
      const actionHeight = this.drawActionGrid(
        actions,
        content.x,
        content.y + 136,
        content.width,
        3,
        true,
      );
      let y = content.y + 144 + actionHeight;
      const tabHeight = this.drawWrappedTabs(
        model.tabs,
        content.x,
        y,
        content.width,
        true,
      );
      y += tabHeight + 8;
      this.drawCardGrid(cards, content, y, model, {
        compact: true,
        columns: 2,
        minHeight: 74,
        maxHeight: 94,
      });
      return;
    }

    const leftWidth = clamp(content.width * 0.34, 350, 430);
    const rightX = content.x + leftWidth + 16;
    const rightWidth = content.width - leftWidth - 16;
    const g = this.graphics;

    g.fillStyle(COLORS.ink, 0.46);
    g.fillRect(content.x, content.y, leftWidth, content.height);
    g.lineStyle(1, COLORS.bronzeDim, 0.54);
    g.strokeRect(content.x + 0.5, content.y + 0.5, leftWidth - 1, content.height - 1);
    g.fillStyle(COLORS.cinnabar, 0.88);
    g.fillRect(content.x, content.y, 3, 150);
    this.drawPanelOrnaments(
      content.x,
      content.y,
      leftWidth,
      content.height,
      { alpha: 0.2, corners: 2 },
    );

    const portraitWidth = Math.min(224, leftWidth * 0.56);
    if (model.hero?.image) {
      this.addImage(
        content.x + leftWidth - portraitWidth * 0.47,
        content.y + 235,
        model.hero.image,
        portraitWidth,
        Math.min(430, content.height * 0.56),
        { decorative: true, alpha: 0.92 },
      );
      g.fillStyle(COLORS.ink, 0.28);
      g.fillRect(content.x, content.y + 90, leftWidth, 330);
    }
    this.addText(content.x + 24, content.y + 24, model.hero?.eyebrow || "甲兵武备", {
      fontSize: "9px",
      letterSpacing: 1.3,
      color: "#d8b970",
      wordWrap: { width: leftWidth * 0.52, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(content.x + 24, content.y + 48, model.hero?.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "36px",
      fontStyle: "bold",
      color: "#f2ead8",
      stroke: "#050807",
      strokeThickness: 2,
      wordWrap: { width: leftWidth * 0.55, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(content.x + 24, content.y + 102, model.hero?.subtitle || "", {
      fontSize: "11px",
      color: "#d2c2a4",
      lineSpacing: 6,
      wordWrap: { width: Math.max(150, leftWidth - 190), useAdvancedWrap: true },
      maxLines: 5,
    });
    g.lineStyle(1, COLORS.bronzeDim, 0.6);
    g.lineBetween(
      content.x + 24,
      content.y + 446,
      content.x + leftWidth - 24,
      content.y + 446,
    );
    this.addText(content.x + 24, content.y + 462, "整备决断", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "15px",
      color: "#f2ead8",
    });
    const actionY = content.y + 492;
    const actionHeight = this.drawActionGrid(
      primaryActions,
      content.x + 24,
      actionY,
      leftWidth - 48,
      primaryActions.length > 1 ? 2 : 1,
      false,
    );
    this.addText(
      content.x + 24,
      Math.min(
        content.y + content.height - 58,
        actionY + actionHeight + 14,
      ),
      "武器、护甲与随身令牌共同构成好汉战备。金色边框表示当前荐装。",
      {
        fontSize: "10px",
        color: "#aaa08a",
        lineSpacing: 5,
        wordWrap: { width: leftWidth - 48, useAdvancedWrap: true },
        maxLines: 3,
      },
    );

    this.addText(rightX, content.y + 9, "随身战备", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "22px",
      fontStyle: "bold",
      color: "#f2ead8",
    });
    this.addText(rightX + rightWidth - 210, content.y + 16, "点选装备格可卸下武备", {
      fontSize: "10px",
      color: "#b7aa92",
      wordWrap: { width: 210, useAdvancedWrap: true },
      maxLines: 1,
    });
    const slotGap = 9;
    const slotY = content.y + 46;
    const slotHeight = 102;
    const slotWidth = (rightWidth - slotGap * 2) / 3;
    equipped.forEach((card, index) => {
      this.drawArmorySlot(
        rightX + index * (slotWidth + slotGap),
        slotY,
        slotWidth,
        slotHeight,
        card,
        index,
      );
    });

    const filterY = slotY + slotHeight + 18;
    const tabHeight = this.drawWrappedTabs(
      model.tabs || [],
      rightX,
      filterY,
      rightWidth,
      false,
    );
    const inventoryHeadingY = filterY + tabHeight + 14;
    const inventoryY = inventoryHeadingY + 30;
    const pagerHeight = 34;
    const inventoryBottom =
      content.y + content.height - pagerHeight - 10;
    const availableHeight = inventoryBottom - inventoryY;
    const overviewHeight = clamp(availableHeight * 0.25, 88, 132);
    const overviewGap = 12;
    const inventoryTileHeight = clamp(
      availableHeight - overviewHeight - overviewGap,
      188,
      350,
    );
    const overviewY = inventoryY + inventoryTileHeight + overviewGap;
    const resolvedOverviewHeight = Math.max(
      72,
      inventoryBottom - overviewY,
    );
    this.addText(rightX, inventoryHeadingY, "军械行囊", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "18px",
      color: "#f2ead8",
    });
    this.addText(rightX + rightWidth - 178, inventoryHeadingY + 4, `共 ${model.detail?.total || inventory.length} 件 · 第 ${page}/${pages} 页`, {
      fontSize: "10px",
      color: "#b9ac94",
      wordWrap: { width: 160, useAdvancedWrap: true },
      maxLines: 1,
    });
    const inventoryGap = 10;
    const inventoryWidth =
      (rightWidth - inventoryGap * Math.max(0, inventory.length - 1)) /
      Math.max(1, inventory.length);
    inventory.forEach((card, index) => {
      this.drawInventoryTile(
        rightX + index * (inventoryWidth + inventoryGap),
        inventoryY,
        inventoryWidth,
        inventoryTileHeight,
        card,
        model.hero?.title || "",
      );
    });
    this.drawArmoryOverview(
      rightX,
      overviewY,
      rightWidth,
      resolvedOverviewHeight,
      armory,
    );
    const pagerY = content.y + content.height - pagerHeight;
    g.fillStyle(COLORS.ink, 0.5);
    g.fillRect(rightX, pagerY, rightWidth, pagerHeight);
    this.addCenteredText(
      rightX + rightWidth / 2,
      pagerY + pagerHeight / 2,
      `${page} / ${pages}`,
      { fontSize: "10px", color: "#b9ac94" },
      80,
    );
    const pageButtons = pageActions.length
      ? pageActions
      : [
          {
            id: "prev-disabled",
            label: "上一页",
            icon: "back",
            tone: "ghost",
            disabled: true,
          },
          {
            id: "next-disabled",
            label: "下一页",
            icon: "chevron",
            tone: "ghost",
            disabled: true,
          },
        ];
    if (pages > 1) {
      this.drawButton(
        rightX + 6,
        pagerY + 4,
        112,
        pagerHeight - 8,
        pageButtons.find((item) => item.id === "prev") || pageButtons[0],
        false,
      );
      this.drawButton(
        rightX + rightWidth - 118,
        pagerY + 4,
        112,
        pagerHeight - 8,
        pageButtons.find((item) => item.id === "next") || pageButtons.at(-1),
        false,
      );
    }
  }

  drawArmorySlot(x, y, width, height, card, index) {
    const g = this.graphics;
    const empty = !card.action;
    const tone = empty ? COLORS.line : COLORS.bronze;
    g.fillStyle(COLORS.panel, empty ? 0.72 : 0.9);
    g.fillRect(x, y, width, height);
    g.lineStyle(1, tone, empty ? 0.38 : 0.74);
    g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    g.fillStyle(tone, empty ? 0.14 : 0.7);
    g.fillRect(x, y, 3, height);
    this.drawGlyph(
      g,
      card.icon || ["swords", "shield", "star"][index] || "star",
      x + 29,
      y + 32,
      22,
      empty ? COLORS.faint : COLORS.bronze,
    );
    this.addText(x + 52, y + 12, card.meta || "", {
      fontSize: "9px",
      color: empty ? "#7f857b" : "#b3a68e",
      wordWrap: { width: width - 62, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(x + 12, y + 50, card.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "15px",
      fontStyle: "bold",
      color: empty ? "#858a80" : "#f2ead8",
      wordWrap: { width: width - 24, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(x + 12, y + 74, card.body || "", {
      fontSize: "9px",
      color: empty ? "#737970" : "#c8b99e",
      wordWrap: { width: width - 24, useAdvancedWrap: true },
      maxLines: 1,
    });
    if (card.action && !card.disabled) {
      this.addHitArea(`equipment-slot:${card.id}`, x, y, width, height, card);
    }
  }

  drawInventoryTile(x, y, width, height, card, ownerName) {
    const g = this.graphics;
    const recommended = card.tone === "primary" || card.badge === "荐装";
    const tone = recommended ? COLORS.bronze : COLORS.line;
    const compact = height < 280;
    g.fillStyle(COLORS.panel, 0.9);
    g.fillRect(x, y, width, height);
    g.lineStyle(recommended ? 2 : 1, tone, recommended ? 0.9 : 0.58);
    g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    g.fillStyle(recommended ? COLORS.bronze : COLORS.tealDim, recommended ? 0.82 : 0.34);
    g.fillRect(x, y, width, 3);
    this.addTiledImage(x + 2, y + 3, width - 4, height - 5, UI_ASSETS.pattern, {
      alpha: recommended ? 0.12 : 0.06,
      blendMode: "SCREEN",
      decorative: true,
      tileScale: 0.42,
    });
    this.drawCornerBrackets(
      x,
      y,
      width,
      height,
      tone,
      recommended ? 0.52 : 0.28,
    );
    const iconY = y + (compact ? 38 : 58);
    const iconRadius = Math.min(compact ? 23 : 34, width * 0.2);
    g.fillStyle(COLORS.ink, 0.48);
    g.fillCircle(x + width / 2, iconY, iconRadius);
    g.lineStyle(1, tone, recommended ? 0.45 : 0.2);
    g.strokeCircle(
      x + width / 2,
      iconY,
      Math.min(compact ? 31 : 50, width * 0.26),
    );
    this.drawGlyph(
      g,
      card.icon || "star",
      x + width / 2,
      iconY,
      Math.min(compact ? 24 : 34, width * 0.17),
      recommended ? COLORS.bronze : COLORS.paperMuted,
    );
    const titleY = y + (compact ? 72 : 104);
    const metaY = y + (compact ? 95 : 130);
    const dividerY = y + (compact ? 116 : 154);
    const statStartY = y + (compact ? 127 : 168);
    const ctaY = y + height - (compact ? 34 : 38);
    this.addText(x + 14, titleY, card.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: compact ? "16px" : "18px",
      fontStyle: "bold",
      color: "#f2ead8",
      wordWrap: { width: width - 28, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(x + 14, metaY, card.meta || "", {
      fontSize: "10px",
      color: recommended ? "#efd49a" : "#c6b99e",
      wordWrap: { width: width - 28, useAdvancedWrap: true },
      maxLines: 1,
    });
    g.lineStyle(1, COLORS.line, 0.48);
    g.lineBetween(x + 14, dividerY, x + width - 14, dividerY);
    const statLines = String(card.body || "").split(" · ").filter(Boolean);
    const statHeight = compact ? 23 : 28;
    const statGap = compact ? 4 : 5;
    const statCapacity = Math.max(
      0,
      Math.floor(
        (ctaY - 8 - statStartY + statGap) /
          (statHeight + statGap),
      ),
    );
    statLines.slice(0, Math.min(4, statCapacity)).forEach((line, index) => {
      const statY =
        statStartY + index * (statHeight + statGap);
      g.fillStyle(COLORS.panelRaised, 0.72);
      g.fillRect(x + 14, statY, width - 28, statHeight);
      g.fillStyle(recommended ? COLORS.bronze : COLORS.tealDim, 0.62);
      g.fillRect(x + 14, statY, 2, statHeight);
      this.addText(
        x + 25,
        statY + (compact ? 5 : 7),
        line,
        {
        fontSize: compact ? "10px" : "11px",
        color: recommended ? "#f0d69c" : "#e0d2b8",
        wordWrap: { width: width - 50, useAdvancedWrap: true },
        maxLines: 1,
        },
      );
    });
    const lastStatBottom =
      statStartY +
      Math.max(1, Math.min(statLines.length, statCapacity)) *
        (statHeight + statGap) -
      statGap;
    const comparison = card.comparison;
    const comparisonY = Math.max(
      lastStatBottom + 10,
      ctaY - 50,
    );
    if (comparison && comparisonY + 38 <= ctaY - 8) {
      const delta = Number(comparison.delta) || 0;
      const comparisonTone =
        delta > 0
          ? COLORS.teal
          : delta < 0
            ? COLORS.cinnabar
            : COLORS.bronzeDim;
      g.fillStyle(COLORS.panelRaised, 0.58);
      g.fillRect(x + 14, comparisonY, width - 28, 34);
      g.fillStyle(comparisonTone, 0.66);
      g.fillRect(x + 14, comparisonY, 2, 34);
      this.addText(x + 24, comparisonY + 6, "换装推演", {
        fontSize: "9px",
        color: "#b9ad95",
        wordWrap: { width: 72, useAdvancedWrap: true },
        maxLines: 1,
      });
      this.addText(
        x + 24,
        comparisonY + 20,
        `${Number(comparison.current).toFixed(1)} → ${Number(
          comparison.next,
        ).toFixed(1)}`,
        {
          fontSize: "9px",
          color: "#d8c9ad",
          wordWrap: { width: width - 120, useAdvancedWrap: true },
          maxLines: 1,
        },
      );
      this.addCenteredText(
        x + width - 62,
        comparisonY + 17,
        `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`,
        {
          fontFamily: TEXT_STYLE.serif,
          fontSize: "15px",
          color:
            delta > 0
              ? "#a9d0c8"
              : delta < 0
                ? "#e0a08f"
                : "#d8b970",
        },
        76,
      );
    }
    if (!statLines.length && statCapacity > 0) {
      this.addText(x + 14, statStartY + 7, "暂无属性加成", {
        fontSize: "11px",
        color: "#c2b59c",
        wordWrap: { width: width - 28, useAdvancedWrap: true },
        maxLines: 1,
      });
    }
    if (card.badge) {
      const badgeWidth = clamp(20 + String(card.badge).length * 9, 44, 70);
      g.fillStyle(recommended ? COLORS.bronze : COLORS.panelRaised, recommended ? 0.84 : 0.9);
      g.fillRect(x + width - badgeWidth - 10, y + 10, badgeWidth, 22);
      this.addCenteredText(
        x + width - badgeWidth / 2 - 10,
        y + 21,
        card.badge,
        {
          fontSize: "9px",
          color: recommended ? "#14201d" : "#b9ac94",
        },
        badgeWidth - 6,
      );
    }
    if (card.action && !card.disabled) {
      g.lineStyle(1, recommended ? COLORS.bronze : COLORS.tealDim, 0.5);
      g.lineBetween(x + 14, ctaY - 9, x + width - 14, ctaY - 9);
      this.addCenteredText(
        x + width / 2,
        ctaY + 7,
        ownerName ? `装备给 ${ownerName}` : "装备此物",
        {
          fontFamily: TEXT_STYLE.serif,
          fontSize: "11px",
          color: recommended ? "#f4d49b" : "#d0c2a8",
        },
        width - 32,
      );
    }
    if (card.action && !card.disabled) {
      this.addHitArea(`inventory:${card.id}`, x, y, width, height, card);
    }
  }

  drawArmoryOverview(x, y, width, height, armory) {
    if (width < 220 || height < 64) return;
    const g = this.graphics;
    const compact = height < 108;
    const stats = armory.stats || [];
    const styleLabels = {
      offense: "攻伐",
      guard: "守御",
      mobility: "机动",
      balanced: "均衡",
    };
    const equippedCount = Number(armory.equippedCount) || 0;
    const totalSlots = Number(armory.totalSlots) || 3;
    const recommendationCount = Number(armory.recommendationCount) || 0;
    const score = Number(armory.score) || 0;
    const improvement = Number(armory.improvement) || 0;
    g.fillStyle(COLORS.ink, 0.78);
    g.fillRect(x, y, width, height);
    g.lineStyle(1, COLORS.bronzeDim, 0.48);
    g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    this.addTiledImage(x + 1, y + 1, width - 2, height - 2, UI_ASSETS.pattern, {
      alpha: 0.055,
      blendMode: "SCREEN",
      decorative: true,
      tileScale: 0.46,
    });
    this.drawCornerBrackets(x, y, width, height, COLORS.bronzeDim, 0.3);

    const leftWidth = clamp(width * 0.25, 166, 204);
    const rightWidth = clamp(width * 0.22, 154, 182);
    const statsX = x + leftWidth + 12;
    const statsWidth =
      width - leftWidth - rightWidth - 26;
    g.lineStyle(1, COLORS.line, 0.42);
    g.lineBetween(
      x + leftWidth,
      y + 12,
      x + leftWidth,
      y + height - 12,
    );
    g.lineBetween(
      x + width - rightWidth,
      y + 12,
      x + width - rightWidth,
      y + height - 12,
    );
    g.fillStyle(COLORS.bronze, 0.14);
    g.fillCircle(x + 29, y + height / 2, 18);
    g.lineStyle(1, COLORS.bronze, 0.4);
    g.strokeCircle(x + 29, y + height / 2, 18);
    this.drawGlyph(
      g,
      equippedCount >= totalSlots ? "check" : "shield",
      x + 29,
      y + height / 2,
      18,
      COLORS.bronze,
    );
    this.addText(x + 54, y + (compact ? 12 : 17), "战备总览", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: compact ? "14px" : "16px",
      fontStyle: "bold",
      color: "#f2ead8",
      wordWrap: { width: leftWidth - 64, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(
      x + 54,
      y + (compact ? 34 : 42),
      `整备 ${equippedCount}/${totalSlots} · ${
        styleLabels[armory.style] || "均衡"
      }`,
      {
        fontSize: "10px",
        color: "#d0c2a8",
        wordWrap: { width: leftWidth - 64, useAdvancedWrap: true },
        maxLines: 1,
      },
    );
    if (!compact) {
      this.addText(
        x + 20,
        y + height - 28,
        `行囊 ${armory.itemCount ?? ""}`,
        {
          fontSize: "9px",
          color: "#aaa08a",
          wordWrap: { width: leftWidth - 40, useAdvancedWrap: true },
          maxLines: 1,
        },
      );
      if (height >= 118) {
        this.addCenteredText(
          statsX + statsWidth / 2,
          y + height - 13,
          "甲械相合 · 临阵不乱",
          {
            fontFamily: TEXT_STYLE.serif,
            fontSize: "9px",
            color: "#8f978b",
          },
          statsWidth,
        );
      }
    }

    const statGap = 6;
    const statWidth =
      (statsWidth - statGap * Math.max(0, stats.length - 1)) /
      Math.max(1, stats.length);
    const statTop = y + (compact ? 8 : 12);
    const statPanelHeight = compact ? 58 : 72;
    stats.forEach((stat, index) => {
      const statX = statsX + index * (statWidth + statGap);
      g.fillStyle(COLORS.panelRaised, 0.72);
      g.fillRect(statX, statTop, statWidth, statPanelHeight);
      g.fillStyle(index % 2 ? COLORS.tealDim : COLORS.bronzeDim, 0.62);
      g.fillRect(statX, statTop, statWidth, 2);
      this.addText(statX + 9, statTop + 9, stat.label, {
        fontSize: "9px",
        color: "#b9ad95",
        wordWrap: { width: statWidth - 18, useAdvancedWrap: true },
        maxLines: 1,
      });
      this.addText(
        statX + 9,
        statTop + (compact ? 25 : 28),
        String(stat.value),
        {
          fontFamily: TEXT_STYLE.serif,
          fontSize: compact ? "17px" : "20px",
          color: index % 2 ? "#a9d0c8" : "#e2c581",
          wordWrap: { width: statWidth - 18, useAdvancedWrap: true },
          maxLines: 1,
        },
      );
    });

    const reviewX = x + width - rightWidth + 14;
    this.addText(reviewX, y + (compact ? 10 : 14), "军师评议", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "12px",
      color: "#f2ead8",
      wordWrap: { width: rightWidth - 28, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(
      reviewX,
      y + (compact ? 31 : 37),
      recommendationCount
        ? `荐装 ${recommendationCount} 件待换`
        : "当前整备已优",
      {
        fontSize: "10px",
        color: recommendationCount ? "#efd49a" : "#a9d0c8",
        wordWrap: { width: rightWidth - 28, useAdvancedWrap: true },
        maxLines: 1,
      },
    );
    this.addText(
      reviewX,
      y + (compact ? 49 : 59),
      `战备评分 ${score.toFixed(1)}${
        improvement > 0 ? ` · +${improvement.toFixed(1)}` : ""
      }`,
      {
        fontSize: "9px",
        color: "#c2b59c",
        wordWrap: { width: rightWidth - 28, useAdvancedWrap: true },
        maxLines: 1,
      },
    );
  }

  drawQuestBoard(model) {
    const frame = this.getFrame();
    this.drawHeader(model, frame);
    this.drawNavigation(model, frame);
    const content = frame.content;
    const compact = frame.compact || this.width < 1120;
    if (compact) {
      this.drawCompactHeroProfile(
        model.hero,
        content.x,
        content.y,
        content.width,
        122,
      );
      const actionHeight = this.drawActionGrid(
        model.actions || [],
        content.x,
        content.y + 132,
        content.width,
        3,
        true,
      );
      const tabHeight = this.drawWrappedTabs(
        model.tabs || [],
        content.x,
        content.y + 142 + actionHeight,
        content.width,
        true,
      );
      this.drawCardGrid(
        model.cards || [],
        content,
        content.y + 150 + actionHeight + tabHeight,
        model,
        { compact: true, columns: 2, minHeight: 68, maxHeight: 92 },
      );
      return;
    }

    const detail = model.detail || {};
    const quests = detail.quests || [];
    const heroes = detail.heroCards || [];
    const recruitments = detail.recruitments || [];
    const legend = detail.legend;
    const leftWidth = clamp(content.width * 0.25, 275, 320);
    const rightWidth = clamp(content.width * 0.31, 350, 400);
    const centerX = content.x + leftWidth + 16;
    const centerWidth = content.width - leftWidth - rightWidth - 32;
    const rightX = content.x + content.width - rightWidth;
    const g = this.graphics;

    g.fillStyle(COLORS.ink, 0.7);
    g.fillRect(content.x, content.y, leftWidth, content.height);
    g.lineStyle(1, COLORS.bronzeDim, 0.52);
    g.strokeRect(content.x + 0.5, content.y + 0.5, leftWidth - 1, content.height - 1);
    g.fillStyle(COLORS.cinnabar, 0.9);
    g.fillRect(content.x, content.y, 3, 128);
    this.drawPanelOrnaments(
      content.x,
      content.y,
      leftWidth,
      content.height,
      { alpha: 0.2, corners: 2 },
    );
    if (model.hero?.image) {
      this.addImage(
        content.x + leftWidth / 2,
        content.y + 220,
        model.hero.image,
        leftWidth - 20,
        Math.min(410, content.height * 0.52),
        { decorative: true, alpha: 0.94 },
      );
      g.fillStyle(COLORS.ink, 0.32);
      g.fillRect(content.x + 1, content.y + 1, leftWidth - 2, 380);
      g.fillStyle(COLORS.ink, 0.84);
      g.fillRect(content.x + 1, content.y + 345, leftWidth - 2, 196);
    }
    this.addText(content.x + 22, content.y + 20, model.hero?.eyebrow || "江湖异闻", {
      fontSize: "9px",
      letterSpacing: 1.3,
      color: "#d8b970",
      wordWrap: { width: leftWidth - 44, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(content.x + 22, content.y + 44, model.hero?.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "39px",
      fontStyle: "bold",
      color: "#f2ead8",
      stroke: "#050807",
      strokeThickness: 2,
      wordWrap: { width: leftWidth - 44, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(content.x + 22, content.y + 362, model.hero?.subtitle || "", {
      fontSize: "10px",
      color: "#e2d4bc",
      lineSpacing: 5,
      wordWrap: { width: leftWidth - 44, useAdvancedWrap: true },
      maxLines: 3,
    });
    const shortDesktop = content.height < 680;
    const progressHeadingY = content.y + (shortDesktop ? 408 : 431);
    const progressBodyY = content.y + (shortDesktop ? 432 : 459);
    const progressTrackY = content.y + (shortDesktop ? 466 : 493);
    const actionY = content.y + (shortDesktop ? 508 : 526);
    this.addText(content.x + 22, progressHeadingY, "异闻卷进度", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "16px",
      color: "#f2ead8",
    });
    this.addText(
      content.x + 22,
      progressBodyY,
      `已录 ${detail.claimed || 0}/3 段 · 全属性 +${((Number(detail.masteryScale) || 1) * 100 - 100).toFixed(1)}%`,
      {
        fontSize: "11px",
        color: "#d0c0a4",
        wordWrap: { width: leftWidth - 44, useAdvancedWrap: true },
        maxLines: 2,
      },
    );
    this.drawProgressTrack(
      content.x + 22,
      progressTrackY,
      leftWidth - 44,
      5,
      (detail.claimed || 0) / 3,
      COLORS.cinnabar,
    );
    this.addText(
      content.x + 22,
      actionY - 21,
      `全卷已录 ${detail.totalClaimed || 0}/${detail.totalQuests || 0} 段异闻`,
      {
        fontSize: "10px",
        color: "#aaa08a",
        wordWrap: { width: leftWidth - 44, useAdvancedWrap: true },
        maxLines: 1,
      },
    );
    this.drawActionGrid(
      model.actions || [],
      content.x + 22,
      actionY,
      leftWidth - 44,
      2,
      false,
    );

    this.drawSectionHeading(
      centerX,
      content.y + 4,
      "当前好汉 · 三段命途",
      "异闻卷",
      "每段异闻对应一场专属战事。完成后回卷领取星命历练。",
      centerWidth,
      false,
    );
    const questGap = 12;
    const questY = content.y + 108;
    const questHeight = (content.height - 118 - questGap * 2) / 3;
    quests.forEach((quest, index) => {
      this.drawQuestStageCard(
        centerX,
        questY + index * (questHeight + questGap),
        centerWidth,
        questHeight,
        quest,
        index,
      );
    });

    g.fillStyle(COLORS.ink, 0.76);
    g.fillRect(rightX, content.y, rightWidth, content.height);
    g.lineStyle(1, COLORS.line, 0.5);
    g.strokeRect(rightX + 0.5, content.y + 0.5, rightWidth - 1, content.height - 1);
    this.drawPanelOrnaments(
      rightX,
      content.y,
      rightWidth,
      content.height,
      { alpha: 0.17, corners: 2 },
    );
    this.addText(rightX + 20, content.y + 18, "群英列传", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "21px",
      fontStyle: "bold",
      color: "#f2ead8",
    });
    this.addText(rightX + 20, content.y + 47, "列传与聚义帖会随好汉选择切换。", {
      fontSize: "10px",
      color: "#aaa08a",
      wordWrap: { width: rightWidth - 40, useAdvancedWrap: true },
      maxLines: 1,
    });
    if (legend) {
      this.drawQuestArchiveCard(
        rightX + 16,
        content.y + 72,
        rightWidth - 32,
        108,
        legend,
        true,
      );
    }
    const indexY = content.y + 194;
    const combined = [...heroes, ...recruitments];
    const columns = 2;
    const gap = 8;
    const pagerHeight = 30;
    const rows = 3;
    const capacity = rows * columns;
    const pageCount = Math.max(1, Math.ceil(combined.length / capacity));
    const page = clamp(this.cardPage, 0, pageCount - 1);
    this.cardPage = page;
    const visible = combined.slice(page * capacity, page * capacity + capacity);
    const tileHeight = 92;
    const tileWidth = (rightWidth - 32 - gap) / columns;
    visible.forEach((card, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      this.drawQuestHeroIndex(
        rightX + 16 + column * (tileWidth + gap),
        indexY + row * (tileHeight + gap),
        tileWidth,
        tileHeight,
        card,
      );
    });
    if (pageCount > 1) {
      this.drawCardPager(
        rightX + 16,
        content.y + content.height - pagerHeight - 8,
        rightWidth - 32,
        pagerHeight,
        page,
        pageCount,
        false,
      );
    }
  }

  drawQuestStageCard(x, y, width, height, card, index) {
    const g = this.graphics;
    const active = card.tone === "primary";
    const complete = Number(card.progress) >= 1;
    const tone = active ? COLORS.cinnabar : complete ? COLORS.teal : COLORS.bronzeDim;
    g.fillStyle(COLORS.panel, active ? 0.96 : 0.92);
    g.fillRect(x, y, width, height);
    g.lineStyle(active ? 2 : 1, tone, active ? 0.9 : 0.56);
    g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    g.fillStyle(tone, active ? 0.9 : 0.62);
    g.fillRect(x, y, 4, height);
    if (active || complete) {
      this.addTiledImage(x + 2, y + 2, width - 4, height - 4, UI_ASSETS.pattern, {
        alpha: active ? 0.13 : 0.09,
        blendMode: "SCREEN",
        decorative: true,
        tileScale: 0.3,
      });
    }
    this.drawCornerBrackets(x, y, width, height, tone, active ? 0.58 : 0.34);
    g.fillCircle(x + 31, y + 34, 15);
    this.addCenteredText(
      x + 31,
      y + 34,
      `0${index + 1}`,
      {
        fontFamily: TEXT_STYLE.serif,
        fontSize: "11px",
        color: active ? "#fff1db" : "#d8b970",
      },
      26,
    );
    this.addText(x + 58, y + 13, card.meta || "", {
      fontSize: "10px",
      color: active ? "#efd19e" : "#c0b39b",
      wordWrap: { width: width - 72, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(x + 58, y + 34, card.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "20px",
      fontStyle: "bold",
      color: "#f2ead8",
      wordWrap: { width: width - 120, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(x + 22, y + 78, card.body || "", {
      fontSize: "11px",
      color: "#d8c9ad",
      lineSpacing: 5,
      wordWrap: { width: width - 44, useAdvancedWrap: true },
      maxLines: 2,
    });
    this.drawProgressTrack(
      x + 22,
      y + height - 24,
      width - 44,
      5,
      card.progress ?? 0,
      tone,
    );
    if (card.badge) {
      this.addText(x + width - 86, y + 15, String(card.badge), {
        fontSize: "10px",
        color: complete ? "#91b7af" : "#d8b970",
        align: "right",
        wordWrap: { width: 70, useAdvancedWrap: true },
        maxLines: 1,
      });
    }
    if (card.action && !card.disabled) {
      this.addHitArea(`quest-stage:${card.id}`, x, y, width, height, card);
    }
  }

  drawQuestArchiveCard(x, y, width, height, card, featured) {
    const g = this.graphics;
    const disabled = Boolean(card.disabled);
    const tone = featured ? COLORS.bronze : COLORS.line;
    if (card.image) {
      this.addImage(x + width / 2, y + height / 2, card.image, width, height, {
        decorative: true,
        alpha: disabled ? 0.24 : 0.46,
      });
    }
    g.fillStyle(COLORS.ink, disabled ? 0.8 : 0.68);
    g.fillRect(x, y, width, height);
    g.fillStyle(COLORS.ink, 0.82);
    g.fillRect(x, y + height * 0.48, width, height * 0.52);
    g.lineStyle(1, tone, disabled ? 0.3 : 0.7);
    g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    this.addText(x + 14, y + 12, card.meta || "", {
      fontSize: "9px",
      color: disabled ? "#81877d" : "#e2c581",
      wordWrap: { width: width - 72, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(x + 14, y + 34, card.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "16px",
      fontStyle: "bold",
      color: disabled ? "#8a8f86" : "#f2ead8",
      wordWrap: { width: width - 88, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(x + 14, y + 62, card.body || "", {
      fontSize: "10px",
      color: disabled ? "#777d73" : "#c8b99e",
      wordWrap: { width: width - 28, useAdvancedWrap: true },
      maxLines: 2,
    });
    if (card.badge) {
      this.addText(x + width - 66, y + 13, card.badge, {
        fontSize: "9px",
        color: disabled ? "#858b81" : "#e2c581",
        align: "right",
        wordWrap: { width: 52, useAdvancedWrap: true },
        maxLines: 1,
      });
    }
    if (card.action && !disabled) {
      this.addHitArea(`quest-archive:${card.id}`, x, y, width, height, card);
    }
  }

  drawQuestHeroIndex(x, y, width, height, card) {
    const g = this.graphics;
    const selected = card.tone === "primary";
    const disabled = Boolean(card.disabled);
    g.fillStyle(COLORS.panel, disabled ? 0.66 : 0.92);
    g.fillRect(x, y, width, height);
    g.lineStyle(1, selected ? COLORS.cinnabar : COLORS.line, selected ? 0.86 : 0.48);
    g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    if (card.image) {
      this.addImage(x + 32, y + height / 2, card.image, 54, height - 8, {
        decorative: true,
        alpha: disabled ? 0.34 : 0.8,
      });
      g.fillStyle(COLORS.ink, 0.2);
      g.fillRect(x + 4, y + 4, 56, height - 8);
    } else {
      this.drawGlyph(
        g,
        "lock",
        x + 31,
        y + height / 2,
        18,
        COLORS.faint,
      );
    }
    const textX = x + 66;
    this.addText(textX, y + 13, card.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "13px",
      fontStyle: "bold",
      color: disabled ? "#858a80" : "#f2ead8",
      wordWrap: { width: width - 76, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(textX, y + 36, card.meta || "", {
      fontSize: "9px",
      color: disabled ? "#777d73" : "#c0b39b",
      wordWrap: { width: width - 76, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(textX, y + 56, card.body || "", {
      fontSize: "9px",
      color: disabled ? "#72786f" : "#d8c9ad",
      wordWrap: { width: width - 76, useAdvancedWrap: true },
      maxLines: 1,
    });
    if (card.action && !disabled) {
      this.addHitArea(`quest-hero:${card.id}`, x, y, width, height, card);
    }
  }

  drawProgressTrack(x, y, width, height, progress, color) {
    this.graphics.fillStyle(COLORS.line, 0.66);
    this.graphics.fillRect(x, y, width, height);
    this.graphics.fillStyle(color, 0.92);
    this.graphics.fillRect(x, y, width * clamp(progress, 0, 1), height);
  }

  drawArena(model) {
    const frame = this.getFrame();
    this.drawHeader(model, frame);
    this.drawNavigation(model, frame);
    const content = frame.content;
    const compact = frame.compact || this.width < 1040;
    const detail = model.detail || {};
    const actions = model.actions || [];
    if (compact) {
      this.drawSectionHeading(
        content.x,
        content.y,
        model.hero?.eyebrow,
        model.hero?.title,
        model.hero?.subtitle,
        content.width,
        true,
      );
      const tabHeight = this.drawWrappedTabs(
        model.tabs || [],
        content.x,
        content.y + 92,
        content.width,
        true,
      );
      const actionHeight = this.drawActionGrid(
        actions,
        content.x,
        content.y + 100 + tabHeight,
        content.width,
        2,
        true,
      );
      this.drawCardGrid(
        model.cards || [],
        content,
        content.y + 110 + tabHeight + actionHeight,
        model,
        { compact: true, columns: 2, minHeight: 66, maxHeight: 88 },
      );
      return;
    }

    const commandWidth = clamp(content.width * 0.28, 300, 340);
    const stageWidth = content.width - commandWidth - 16;
    const commandX = content.x + stageWidth + 16;
    const stageHeight = 222;
    const teamLabelY = content.y + 210;
    const teamY = content.y + 244;
    const teamHeight = 50;
    const trialsY = content.y + 300;
    const g = this.graphics;

    g.fillStyle(COLORS.ink, 0.38);
    g.fillRect(content.x, content.y, stageWidth, stageHeight);
    g.lineStyle(1, COLORS.bronzeDim, 0.58);
    g.strokeRect(
      content.x + 0.5,
      content.y + 0.5,
      stageWidth - 1,
      stageHeight - 1,
    );
    g.fillStyle(COLORS.cinnabar, 0.9);
    g.fillRect(content.x, content.y, 4, 176);
    this.drawPanelOrnaments(
      content.x,
      content.y,
      stageWidth,
      stageHeight,
      { alpha: 0.18, corners: 2 },
    );
    this.addText(content.x + 24, content.y + 20, model.hero?.eyebrow || "", {
      fontSize: "10px",
      letterSpacing: 1.4,
      color: "#d8b970",
      wordWrap: { width: stageWidth * 0.56, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(content.x + 24, content.y + 44, model.hero?.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "38px",
      fontStyle: "bold",
      color: "#f2ead8",
      stroke: "#050807",
      strokeThickness: 2,
      wordWrap: { width: stageWidth * 0.58, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(content.x + 24, content.y + 98, model.hero?.subtitle || "", {
      fontSize: "11px",
      color: "#d4c4a8",
      wordWrap: { width: stageWidth * 0.58, useAdvancedWrap: true },
      maxLines: 2,
    });
    const metrics = [
      { label: "最高波次", value: detail.record?.bestWave || 0 },
      { label: "最高军功", value: detail.record?.bestScore || 0 },
      { label: "累计悬赏", value: detail.record?.totalBounties || 0 },
      { label: "出阵次数", value: detail.record?.totalRuns || 0 },
    ];
    const metricWidth = (stageWidth * 0.55 - 30) / 4;
    metrics.forEach((metric, index) => {
      const x = content.x + 24 + index * (metricWidth + 6);
      g.fillStyle(COLORS.panel, 0.78);
      g.fillRect(x, content.y + 150, metricWidth, 58);
      g.lineStyle(1, COLORS.line, 0.45);
      g.strokeRect(x + 0.5, content.y + 150.5, metricWidth - 1, 57);
      this.addText(x + 9, content.y + 159, metric.label, {
        fontSize: "9px",
        color: "#aaa08a",
        wordWrap: { width: metricWidth - 18, useAdvancedWrap: true },
        maxLines: 1,
      });
      this.addText(x + 9, content.y + 177, String(metric.value), {
        fontFamily: TEXT_STYLE.serif,
        fontSize: "19px",
        color: "#d8b970",
        wordWrap: { width: metricWidth - 18, useAdvancedWrap: true },
        maxLines: 1,
      });
    });
    const encounter = detail.encounterPreview;
    const encounterX = content.x + stageWidth * 0.6;
    const encounterWidth = stageWidth * 0.4 - 24;
    g.fillStyle(COLORS.ink, 0.72);
    g.fillRect(encounterX, content.y + 20, encounterWidth, 190);
    g.lineStyle(1, COLORS.line, 0.52);
    g.strokeRect(
      encounterX + 0.5,
      content.y + 20.5,
      encounterWidth - 1,
      189,
    );
    this.drawGlyph(
      g,
      encounter?.icon || "swords",
      encounterX + 31,
      content.y + 51,
      24,
      COLORS.cinnabar,
    );
    this.addText(encounterX + 56, content.y + 36, encounter?.label || "本阵军势", {
      fontSize: "9px",
      color: "#b9ac94",
      wordWrap: { width: encounterWidth - 72, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(encounterX + 20, content.y + 77, encounter?.name || "军势未明", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "21px",
      fontStyle: "bold",
      color: "#f2ead8",
      wordWrap: { width: encounterWidth - 40, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(encounterX + 20, content.y + 108, encounter?.tactic || "敌方战法未明", {
      fontSize: "10px",
      color: "#e2c581",
      wordWrap: { width: encounterWidth - 40, useAdvancedWrap: true },
      maxLines: 2,
    });
    this.addText(encounterX + 20, content.y + 140, encounter?.description || "", {
      fontSize: "10px",
      color: "#d0c0a4",
      lineSpacing: 5,
      wordWrap: { width: encounterWidth - 40, useAdvancedWrap: true },
      maxLines: 3,
    });
    if (encounter?.scoreBonus) {
      this.addText(
        encounterX + 20,
        content.y + 188,
        `破阵军功 +${encounter.scoreBonus}%`,
        {
          fontSize: "10px",
          color: "#91b7af",
          wordWrap: { width: encounterWidth - 40, useAdvancedWrap: true },
          maxLines: 1,
        },
      );
    }

    const team = detail.team || [];
    const rosterAction = actions.find(
      (item) => item.action === "nav-roster",
    );
    this.addText(content.x, teamLabelY, "出阵三阵", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "15px",
      color: "#f2ead8",
    });
    const teamX = content.x + 86;
    const teamGap = 8;
    const teamWidth = (stageWidth - 86 - teamGap * 2) / 3;
    const teamSlots = [0, 1, 2].map((row) => ({
      row,
      member: team.find((member) => Number(member.row) === row) || null,
    }));
    teamSlots.forEach(({ row, member }, index) => {
      const x = teamX + index * (teamWidth + teamGap);
      const tone = member ? COLORS.teal : COLORS.line;
      g.fillStyle(COLORS.panel, member ? 0.88 : 0.56);
      g.fillRect(x, teamY, teamWidth, teamHeight);
      g.lineStyle(1, tone, member ? 0.62 : 0.3);
      g.strokeRect(x + 0.5, teamY + 0.5, teamWidth - 1, teamHeight - 1);
      g.fillStyle(tone, member ? 0.68 : 0.22);
      g.fillRect(x, teamY, 3, teamHeight);
      this.drawCornerBrackets(
        x,
        teamY,
        teamWidth,
        teamHeight,
        tone,
        member ? 0.34 : 0.16,
      );
      const rowLabel = ["前", "中", "后"][row] || "阵";
      g.fillStyle(tone, member ? 0.14 : 0.07);
      g.fillRect(x + 9, teamY + 8, 24, teamHeight - 16);
      this.addCenteredText(
        x + 21,
        teamY + teamHeight / 2,
        rowLabel,
        {
          fontFamily: TEXT_STYLE.serif,
          fontSize: "13px",
          color: member ? "#d8c9ad" : "#9a9e91",
        },
        20,
      );
      if (member?.image) {
        this.addImage(x + 57, teamY + teamHeight / 2, member.image, 36, 42, {
          decorative: true,
          alpha: 0.86,
        });
      }
      if (member) {
        this.addText(x + 80, teamY + 7, member.name, {
          fontFamily: TEXT_STYLE.serif,
          fontSize: "12px",
          fontStyle: "bold",
          color: "#f0e8d7",
          wordWrap: {
            width: Math.max(42, teamWidth - 130),
            useAdvancedWrap: true,
          },
          maxLines: 1,
        });
        this.addCenteredText(
          x + teamWidth - 32,
          teamY + 13,
          `Lv.${member.level || 1}`,
          {
            fontSize: "9px",
            color: "#b9ac94",
          },
          48,
        );
        this.addText(
          x + 80,
          teamY + 27,
          (member.stats || [])
            .map((stat) => `${stat.label} ${stat.value}`)
            .join(" · "),
          {
            fontSize: "9px",
            color: "#a9d0c8",
            wordWrap: {
              width: Math.max(42, teamWidth - 92),
              useAdvancedWrap: true,
            },
            maxLines: 1,
          },
        );
      } else {
        this.drawGlyph(
          g,
          "plus",
          x + 57,
          teamY + teamHeight / 2,
          16,
          COLORS.faint,
        );
        this.addText(x + 76, teamY + 9, "虚位待编", {
          fontFamily: TEXT_STYLE.serif,
          fontSize: "12px",
          color: "#b9b09d",
          wordWrap: { width: teamWidth - 88, useAdvancedWrap: true },
          maxLines: 1,
        });
        this.addText(x + 76, teamY + 28, "点此调整三阵", {
          fontSize: "9px",
          color: "#a0a797",
          wordWrap: { width: teamWidth - 88, useAdvancedWrap: true },
          maxLines: 1,
        });
      }
      if (rosterAction) {
        this.addHitArea(
          `arena-team:${row}`,
          x,
          teamY,
          teamWidth,
          teamHeight,
          rosterAction,
        );
      }
    });

    this.addText(content.x, trialsY, "星劫军令", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "23px",
      fontStyle: "bold",
      color: "#f2ead8",
    });
    this.addText(content.x, trialsY + 31, `已携 ${detail.trials?.selectedCount || 0}/${detail.trials?.limit || 0} 道 · 风险越高，军功越重。`, {
      fontSize: "10px",
      color: "#b9ac94",
      wordWrap: { width: stageWidth, useAdvancedWrap: true },
      maxLines: 1,
    });
    const trialCards = detail.trials?.cards || [];
    const trialGap = 9;
    const trialColumns = 3;
    const trialY = trialsY + 58;
    const trialRows = Math.max(1, Math.ceil(trialCards.length / trialColumns));
    const trialAvailable =
      content.y + content.height - trialY;
    const shortArena = content.height < 700;
    const forecastReserve = shortArena ? 52 : 96;
    const trialCardHeight = clamp(
      (trialAvailable -
        forecastReserve -
        trialGap * (trialRows - 1) -
        10) /
        trialRows,
      shortArena ? 92 : 132,
      shortArena ? 104 : 166,
    );
    const trialCardWidth =
      (stageWidth - trialGap * (trialColumns - 1)) / trialColumns;
    trialCards.forEach((card, index) => {
      const column = index % trialColumns;
      const row = Math.floor(index / trialColumns);
      this.drawArenaTrialCard(
        content.x + column * (trialCardWidth + trialGap),
        trialY + row * (trialCardHeight + trialGap),
        trialCardWidth,
        trialCardHeight,
        card,
      );
    });
    const forecastY =
      trialY +
      trialRows * trialCardHeight +
      trialGap * (trialRows - 1) +
      10;
    const forecastHeight = content.y + content.height - forecastY;
    if (forecastHeight >= 44) {
      this.drawArenaTrialForecast(
        content.x,
        forecastY,
        stageWidth,
        forecastHeight,
        detail.trials || {},
        team.length,
      );
    }
    if (!trialCards.length) {
      this.addText(content.x, trialY, "暂无可用星劫。", {
        fontSize: "11px",
        color: "#8f856f",
      });
    }

    g.fillStyle(COLORS.ink, 0.76);
    g.fillRect(commandX, content.y, commandWidth, content.height);
    g.lineStyle(1, COLORS.bronzeDim, 0.52);
    g.strokeRect(
      commandX + 0.5,
      content.y + 0.5,
      commandWidth - 1,
      content.height - 1,
    );
    g.fillStyle(COLORS.bronze, 0.84);
    g.fillRect(commandX, content.y, 3, 142);
    this.drawPanelOrnaments(
      commandX,
      content.y,
      commandWidth,
      content.height,
      { alpha: 0.2, corners: 2 },
    );
    this.addText(commandX + 18, content.y + 17, "演武号令", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "20px",
      fontStyle: "bold",
      color: "#f2ead8",
    });
    this.addText(commandX + 18, content.y + 45, detail.active ? "本轮战况与军令构筑" : "择模式、定星劫、立令出阵", {
      fontSize: "10px",
      color: "#aaa08a",
      wordWrap: { width: commandWidth - 36, useAdvancedWrap: true },
      maxLines: 1,
    });
    const modeTabWidth = (commandWidth - 36 - 6) / 2;
    (model.tabs || []).forEach((tab, index) => {
      this.drawTab(
        commandX + 18 + index * (modeTabWidth + 6),
        content.y + 68,
        modeTabWidth,
        30,
        tab,
        false,
      );
    });
    const intelY = content.y + 112;
    g.fillStyle(COLORS.panel, 0.72);
    g.fillRect(commandX + 18, intelY, commandWidth - 36, 98);
    g.lineStyle(1, COLORS.line, 0.5);
    g.strokeRect(commandX + 18.5, intelY + 0.5, commandWidth - 37, 97);
    if (detail.mode === "weekly") {
      this.addText(commandX + 29, intelY + 11, detail.week?.rule?.name || "本周军令", {
        fontFamily: TEXT_STYLE.serif,
        fontSize: "14px",
        color: "#f2ead8",
        wordWrap: { width: commandWidth - 58, useAdvancedWrap: true },
        maxLines: 1,
      });
      this.addText(commandX + 29, intelY + 34, detail.week?.rule?.description || "", {
        fontSize: "9px",
        color: "#d0c0a4",
        lineSpacing: 4,
        wordWrap: { width: commandWidth - 58, useAdvancedWrap: true },
        maxLines: 3,
      });
      this.addText(commandX + 29, intelY + 75, `${detail.week?.range || ""} · 最佳 ${detail.week?.bestScore || 0} 军功`, {
        fontSize: "9px",
        color: "#e2c581",
        wordWrap: { width: commandWidth - 58, useAdvancedWrap: true },
        maxLines: 1,
      });
    } else {
      this.addText(commandX + 29, intelY + 11, detail.active ? "当前战阵" : "首阵推演", {
        fontFamily: TEXT_STYLE.serif,
        fontSize: "14px",
        color: "#f2ead8",
      });
      this.addText(
        commandX + 29,
        intelY + 35,
        detail.active
          ? `第 ${detail.wave || 1} 阵 · 军功 ${detail.record?.bestScore || 0}`
          : `${detail.encounterPreview?.name || "军势未明"} · ${detail.start?.label || "立令出阵"}`,
        {
          fontSize: "10px",
          color: "#d8c9ad",
          lineSpacing: 4,
          wordWrap: { width: commandWidth - 58, useAdvancedWrap: true },
          maxLines: 2,
        },
      );
      this.addText(commandX + 29, intelY + 72, `星劫加成 · 军功 +${detail.trials?.effects?.scoreBonus || 0}% · 铜钱 +${detail.trials?.effects?.copperBonus || 0}%`, {
        fontSize: "9px",
        color: "#91b7af",
        wordWrap: { width: commandWidth - 58, useAdvancedWrap: true },
        maxLines: 1,
      });
    }

    const loadoutY = intelY + 112;
    if (detail.active) {
      this.addText(commandX + 18, loadoutY, "本轮军令", {
        fontFamily: TEXT_STYLE.serif,
        fontSize: "15px",
        color: "#f2ead8",
      });
      const activeBoons = (model.cards || []).filter(
        (card) =>
          !["run", "roster", "locked"].includes(card.id) &&
          !String(card.id).startsWith("trial-"),
      );
      activeBoons.slice(0, 5).forEach((card, index) => {
        const y = loadoutY + 28 + index * 52;
        g.fillStyle(COLORS.panelRaised, 0.76);
        g.fillRect(commandX + 18, y, commandWidth - 36, 44);
        g.fillStyle(COLORS.teal, 0.7);
        g.fillRect(commandX + 18, y, 2, 44);
        this.drawGlyph(
          g,
          card.icon || "star",
          commandX + 39,
          y + 22,
          15,
          COLORS.bronze,
        );
        this.addText(commandX + 55, y + 7, card.title || "", {
          fontFamily: TEXT_STYLE.serif,
          fontSize: "11px",
          color: "#f0e8d7",
          wordWrap: { width: commandWidth - 80, useAdvancedWrap: true },
          maxLines: 1,
        });
        this.addText(commandX + 55, y + 25, card.meta || "", {
          fontSize: "9px",
          color: "#b3a68e",
          wordWrap: { width: commandWidth - 80, useAdvancedWrap: true },
          maxLines: 1,
        });
      });
      if (!activeBoons.length) {
        this.addText(commandX + 18, loadoutY + 31, "尚未取得军令。", {
          fontSize: "9px",
          color: "#8f856f",
        });
      }
    } else {
      this.addText(commandX + 18, loadoutY, "开阵军令", {
        fontFamily: TEXT_STYLE.serif,
        fontSize: "15px",
        color: "#f2ead8",
      });
      this.addText(commandX + 90, loadoutY + 4, "择一令作为本轮起手", {
        fontSize: "9px",
        color: "#aaa08a",
        wordWrap: { width: commandWidth - 108, useAdvancedWrap: true },
        maxLines: 1,
      });
      const opening = detail.openingBoons || [];
      const visibleOpening = opening.slice(0, 3);
      visibleOpening.forEach((card, index) => {
        this.drawArenaBoonOption(
          commandX + 18,
          loadoutY + 28 + index * 72,
          commandWidth - 36,
          64,
          card,
        );
      });
      const optionsBottom =
        loadoutY +
        28 +
        Math.max(0, visibleOpening.length - 1) * 72 +
        (visibleOpening.length ? 64 : 0);
      const briefY = optionsBottom + 12;
      const briefBottom = content.y + content.height - 114;
      const briefHeight = briefBottom - briefY;
      if (visibleOpening.length && briefHeight >= 92) {
        this.drawArenaIntelPanel(
          commandX + 18,
          briefY,
          commandWidth - 36,
          briefHeight,
          detail,
          visibleOpening,
        );
      }
      if (!opening.length && detail.recommendation) {
        this.addText(commandX + 18, loadoutY + 34, "军师已有荐令，立令后进入战阵。", {
          fontSize: "9px",
          color: "#8f856f",
          wordWrap: { width: commandWidth - 36, useAdvancedWrap: true },
          maxLines: 2,
        });
      }
    }
    const actionHeight = this.drawActionGrid(
      actions,
      commandX + 18,
      content.y + content.height - 102,
      commandWidth - 36,
      2,
      false,
    );
    if (!actions.length) {
      this.addText(commandX + 18, content.y + content.height - 62, "当前无可执行号令。", {
        fontSize: "9px",
        color: "#8f856f",
      });
    }
  }

  drawArenaIntelPanel(x, y, width, height, detail, opening) {
    if (width < 200 || height < 88) return;
    const g = this.graphics;
    const recommendation = detail.recommendation || null;
    const recommended = opening.find(
      (card) => card.id === recommendation?.boonId,
    );
    const nextFormation = detail.build?.nextFormation || null;
    const nextRelic = detail.relics?.next || null;
    const effects = detail.trials?.effects || {};
    const rows = [];
    if (recommended && recommendation?.reason) {
      rows.push({
        icon: "star",
        tone: COLORS.bronze,
        title: `军师荐令 · ${recommended.title}`,
        body: recommendation.reason,
      });
    }
    if (nextFormation) {
      rows.push({
        icon: nextFormation.icon || "users",
        tone: COLORS.teal,
        title: `下一阵 · ${nextFormation.name}`,
        body: `尚缺 ${nextFormation.missing || 0} 重军令即可成阵`,
      });
    }
    if (nextRelic) {
      rows.push({
        icon: nextRelic.icon || "landmark",
        tone: COLORS.bronzeDim,
        title: `阵中古物 · ${nextRelic.name}`,
        body: `第 ${nextRelic.wave || 1} 阵可寻得`,
      });
    }
    if (rows.length < 3) {
      rows.push({
        icon: "flame",
        tone: COLORS.cinnabar,
        title: `星劫余势 · 已携 ${detail.trials?.selectedCount || 0} 道`,
        body: `军功 +${effects.scoreBonus || 0}% · 铜钱 +${
          effects.copperBonus || 0
        }%`,
      });
    }
    g.fillStyle(COLORS.panel, 0.66);
    g.fillRect(x, y, width, height);
    g.lineStyle(1, COLORS.line, 0.46);
    g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    this.addTiledImage(x + 1, y + 1, width - 2, height - 2, UI_ASSETS.pattern, {
      alpha: 0.045,
      blendMode: "SCREEN",
      decorative: true,
      tileScale: 0.48,
    });
    this.drawCornerBrackets(x, y, width, height, COLORS.bronzeDim, 0.24);
    this.addText(x + 12, y + 9, "军机简报", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "13px",
      fontStyle: "bold",
      color: "#f2ead8",
      wordWrap: { width: width - 24, useAdvancedWrap: true },
      maxLines: 1,
    });
    const rowGap = 6;
    const availableRows = Math.max(
      1,
      Math.floor((height - 38 + rowGap) / 50),
    );
    const rowHeight = Math.min(
      44,
      (height - 38 - rowGap * (availableRows - 1)) / availableRows,
    );
    rows.slice(0, availableRows).forEach((row, index) => {
      const rowY = y + 32 + index * (rowHeight + rowGap);
      g.fillStyle(COLORS.panelRaised, 0.7);
      g.fillRect(x + 10, rowY, width - 20, rowHeight);
      g.fillStyle(row.tone, 0.68);
      g.fillRect(x + 10, rowY, 2, rowHeight);
      this.drawGlyph(
        g,
        row.icon,
        x + 27,
        rowY + rowHeight / 2,
        14,
        row.tone,
      );
      this.addText(x + 42, rowY + 5, row.title, {
        fontFamily: TEXT_STYLE.serif,
        fontSize: "10px",
        color: "#f0e8d7",
        wordWrap: { width: width - 56, useAdvancedWrap: true },
        maxLines: 1,
      });
      this.addText(x + 42, rowY + 23, row.body, {
        fontSize: "8px",
        color: "#bdb19a",
        wordWrap: { width: width - 56, useAdvancedWrap: true },
        maxLines: 1,
      });
    });
  }

  drawArenaTrialCard(x, y, width, height, card) {
    const g = this.graphics;
    const selected = Boolean(card.selected || card.pressed);
    const disabled = Boolean(card.disabled);
    const tone = selected ? COLORS.cinnabar : disabled ? COLORS.line : COLORS.bronzeDim;
    g.fillStyle(COLORS.panel, disabled ? 0.66 : selected ? 0.94 : 0.88);
    g.fillRect(x, y, width, height);
    g.lineStyle(selected ? 2 : 1, tone, disabled ? 0.3 : selected ? 0.9 : 0.56);
    g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    g.fillStyle(tone, disabled ? 0.12 : selected ? 0.84 : 0.34);
    g.fillRect(x, y, width, 3);
    if (selected) {
      this.addTiledImage(x + 2, y + 2, width - 4, height - 4, UI_ASSETS.pattern, {
        alpha: 0.14,
        blendMode: "SCREEN",
        decorative: true,
        tileScale: 0.28,
      });
    }
    this.drawCornerBrackets(x, y, width, height, tone, selected ? 0.62 : 0.32);
    const compact = height < 108;
    this.drawGlyph(
      g,
      card.icon || "star",
      x + 24,
      y + (compact ? 25 : 30),
      compact ? 16 : 18,
      disabled ? COLORS.faint : selected ? COLORS.cinnabar : COLORS.bronze,
    );
    const badgeLabel = card.badge || (selected ? "已启用" : "");
    const badgeWidth = badgeLabel
      ? clamp(24 + badgeLabel.length * 9, 48, 76)
      : 0;
    this.addText(x + 42, y + (compact ? 8 : 12), card.meta || "", {
      fontSize: "9px",
      color: disabled ? "#8a9086" : "#cdbfa4",
      wordWrap: {
        width: width - 54 - (badgeWidth ? badgeWidth + 10 : 0),
        useAdvancedWrap: true,
      },
      maxLines: 1,
    });
    this.addText(x + 14, y + (compact ? 34 : 43), card.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: compact ? "14px" : "15px",
      fontStyle: "bold",
      color: disabled ? "#858a80" : "#f2ead8",
      wordWrap: { width: width - 28, useAdvancedWrap: true },
      maxLines: 1,
    });
    const riskY = y + height - (compact ? 24 : 26);
    const descriptionY = y + (compact ? 56 : 68);
    const descriptionLineHeight = compact ? 12 : 14;
    const descriptionLines = Math.max(
      0,
      Math.floor(
        (riskY - 6 - descriptionY) / descriptionLineHeight,
      ),
    );
    if (descriptionLines > 0) {
      this.addText(x + 14, descriptionY, card.description || card.body || "", {
        fontSize: compact ? "9px" : "10px",
        color: disabled ? "#858b81" : "#d7c8ad",
        lineSpacing: compact ? 2 : 4,
        wordWrap: { width: width - 28, useAdvancedWrap: true },
        maxLines: descriptionLines,
      });
    }
    g.fillStyle(COLORS.panelRaised, disabled ? 0.38 : 0.72);
    g.fillRect(x + 10, riskY, width - 20, 18);
    g.fillStyle(
      selected ? COLORS.cinnabar : disabled ? COLORS.line : COLORS.bronzeDim,
      disabled ? 0.32 : 0.72,
    );
    g.fillRect(x + 10, riskY, 2, 18);
    this.addText(x + 18, riskY + 4, `险 · ${card.risk || "军势未明"}`, {
      fontSize: "9px",
      color: disabled ? "#8a9086" : "#e0c9ab",
      wordWrap: { width: width - 36, useAdvancedWrap: true },
      maxLines: 1,
    });
    if (badgeLabel) {
      g.fillStyle(
        selected ? COLORS.cinnabar : COLORS.panelRaised,
        selected ? 0.8 : 0.96,
      );
      g.fillRect(
        x + width - badgeWidth - 10,
        y + (compact ? 7 : 9),
        badgeWidth,
        compact ? 18 : 20,
      );
      this.addCenteredText(
        x + width - badgeWidth / 2 - 10,
        y + (compact ? 16 : 19),
        badgeLabel,
        {
          fontSize: "9px",
          color: selected
            ? "#f8ead2"
            : disabled
              ? "#858b81"
              : "#d8b970",
        },
        badgeWidth - 6,
      );
    }
    if (card.action && !disabled) {
      this.addHitArea(`arena-trial:${card.id}`, x, y, width, height, card);
    }
  }

  drawArenaTrialForecast(x, y, width, height, trials, teamCount) {
    if (width < 260 || height < 44) return;
    const g = this.graphics;
    const compact = height < 92;
    const limit = Math.max(1, Number(trials.limit) || 1);
    const selectedCount = Number(trials.selectedCount) || 0;
    const effects = trials.effects || {};
    const leftWidth = clamp(width * 0.34, 224, 286);
    g.fillStyle(COLORS.ink, 0.72);
    g.fillRect(x, y, width, height);
    g.lineStyle(1, COLORS.tealDim, 0.56);
    g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    g.fillStyle(COLORS.teal, 0.7);
    g.fillRect(x, y, 3, height);
    this.addTiledImage(x + 2, y + 1, width - 4, height - 2, UI_ASSETS.pattern, {
      alpha: 0.055,
      blendMode: "SCREEN",
      decorative: true,
      tileScale: 0.4,
    });
    this.drawCornerBrackets(x, y, width, height, COLORS.tealDim, 0.32);
    this.addText(
      x + 16,
      y + (compact ? 9 : 13),
      "星劫推演",
      {
        fontFamily: TEXT_STYLE.serif,
        fontSize: compact ? "13px" : "15px",
        fontStyle: "bold",
        color: "#f2ead8",
        wordWrap: { width: leftWidth - 32, useAdvancedWrap: true },
        maxLines: 1,
      },
    );
    this.addText(
      x + 16,
      y + (compact ? 28 : 36),
      `已携 ${selectedCount}/${limit} 道 · ${teamCount}/3 人出阵`,
      {
        fontSize: "9px",
        color: selectedCount ? "#efd49a" : "#b9ac94",
        wordWrap: { width: leftWidth - 32, useAdvancedWrap: true },
        maxLines: 1,
      },
    );
    if (!compact) {
      g.fillStyle(COLORS.line, 0.66);
      g.fillRect(x + 16, y + 58, leftWidth - 32, 4);
      g.fillStyle(COLORS.cinnabar, 0.9);
      g.fillRect(
        x + 16,
        y + 58,
        (leftWidth - 32) * clamp(selectedCount / limit, 0, 1),
        4,
      );
      this.addText(
        x + 16,
        y + 72,
        selectedCount
          ? "风险与军功同步抬升"
          : "未携星劫，首阵以稳为主",
        {
          fontSize: "9px",
          color: "#aaa08a",
          wordWrap: { width: leftWidth - 32, useAdvancedWrap: true },
          maxLines: 1,
        },
      );
    }
    g.lineStyle(1, COLORS.line, 0.42);
    g.lineBetween(
      x + leftWidth,
      y + 10,
      x + leftWidth,
      y + height - 10,
    );
    const chipGap = 7;
    const chipX = x + leftWidth + 12;
    const chipWidth =
      (width - leftWidth - 24 - chipGap * 2) / 3;
    const chipY = y + (compact ? 8 : 12);
    const chipHeight = compact ? 32 : 42;
    const chips = [
      {
        label: "军功",
        value: `+${Number(effects.scoreBonus) || 0}%`,
        tone: COLORS.cinnabar,
      },
      {
        label: "铜钱",
        value: `+${Number(effects.copperBonus) || 0}%`,
        tone: COLORS.bronze,
      },
      {
        label: "历练",
        value: `+${Number(effects.xpBonus) || 0}%`,
        tone: COLORS.teal,
      },
    ];
    chips.forEach((chip, index) => {
      const chipXPos = chipX + index * (chipWidth + chipGap);
      g.fillStyle(COLORS.panelRaised, 0.72);
      g.fillRect(chipXPos, chipY, chipWidth, chipHeight);
      g.fillStyle(chip.tone, 0.72);
      g.fillRect(chipXPos, chipY, 2, chipHeight);
      this.addText(chipXPos + 9, chipY + 6, chip.label, {
        fontSize: "9px",
        color: "#b9ad95",
        wordWrap: { width: chipWidth - 18, useAdvancedWrap: true },
        maxLines: 1,
      });
      this.addText(
        chipXPos + 9,
        chipY + (compact ? 18 : 20),
        chip.value,
        {
          fontFamily: TEXT_STYLE.serif,
          fontSize: compact ? "12px" : "15px",
          color:
            chip.tone === COLORS.cinnabar
              ? "#e6aa98"
              : chip.tone === COLORS.bronze
                ? "#e2c581"
                : "#a9d0c8",
          wordWrap: { width: chipWidth - 18, useAdvancedWrap: true },
          maxLines: 1,
        },
      );
    });
    if (!compact) {
      const routeY = y + height - 25;
      const routeStart = chipX;
      const routeEnd = x + width - 16;
      g.lineStyle(1, COLORS.line, 0.58);
      g.lineBetween(routeStart, routeY, routeEnd, routeY);
      ["择星劫", "立军令", "破首阵"].forEach((label, index) => {
        const nodeX =
          routeStart + ((routeEnd - routeStart) * index) / 2;
        g.fillStyle(
          selectedCount || index === 0 ? COLORS.teal : COLORS.line,
          0.9,
        );
        g.fillCircle(nodeX, routeY, 2.4);
        this.addCenteredText(
          nodeX,
          routeY - 10,
          label,
          {
            fontSize: "8px",
            color: index === 2 ? "#d8b970" : "#aaa08a",
          },
          64,
        );
      });
    }
  }

  drawArenaBoonOption(x, y, width, height, card) {
    const g = this.graphics;
    const recommended = Boolean(card.recommended);
    const selected = Boolean(card.selected || card.pressed);
    const disabled = Boolean(card.disabled);
    const tone = selected
      ? COLORS.cinnabar
      : recommended
        ? COLORS.bronze
        : COLORS.line;
    g.fillStyle(COLORS.panelRaised, disabled ? 0.56 : 0.9);
    g.fillRect(x, y, width, height);
    g.lineStyle(recommended || selected ? 2 : 1, tone, disabled ? 0.26 : 0.7);
    g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    g.fillStyle(tone, disabled ? 0.1 : recommended ? 0.72 : 0.3);
    g.fillRect(x, y, 3, height);
    this.drawGlyph(
      g,
      card.icon || "star",
      x + 24,
      y + height / 2,
      18,
      disabled ? COLORS.faint : recommended ? COLORS.bronze : COLORS.paperMuted,
    );
    this.addText(x + 43, y + 8, card.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "13px",
      fontStyle: "bold",
      color: disabled ? "#858a80" : "#f2ead8",
      wordWrap: { width: width - 90, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(x + 43, y + 28, card.meta || "", {
      fontSize: "9px",
      color: disabled ? "#777d73" : recommended ? "#e2c581" : "#b3a68e",
      wordWrap: { width: width - 58, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(x + 43, y + 45, card.body || "", {
      fontSize: "9px",
      color: disabled ? "#72786f" : "#c8b99e",
      wordWrap: { width: width - 58, useAdvancedWrap: true },
      maxLines: 1,
    });
    if (recommended && !disabled) {
      this.addText(x + width - 46, y + 9, "荐", {
        fontFamily: TEXT_STYLE.serif,
        fontSize: "10px",
        color: "#f2ead8",
        align: "right",
        wordWrap: { width: 30, useAdvancedWrap: true },
        maxLines: 1,
      });
    }
    if (card.action && !disabled) {
      this.addHitArea(`arena-boon:${card.id}`, x, y, width, height, card);
    }
  }

  drawArenaReward(model) {
    const frame = this.getFrame();
    this.drawHeader(model, frame);
    this.drawNavigation(model, frame);
    const content = frame.content;
    const compact = frame.compact || this.width < 1080;
    const detail = model.detail || {};
    if (compact) {
      this.drawCompactHeroProfile(
        model.hero,
        content.x,
        content.y,
        content.width,
        118,
      );
      const actionHeight = this.drawActionGrid(
        model.actions || [],
        content.x,
        content.y + 128,
        content.width,
        2,
        true,
      );
      this.drawCardGrid(
        model.cards || [],
        content,
        content.y + 138 + actionHeight,
        model,
        { compact: true, columns: 1, minHeight: 88, maxHeight: 112 },
      );
      return;
    }

    const leftWidth = 190;
    const rightWidth = 230;
    const gap = 14;
    const centerX = content.x + leftWidth + gap;
    const centerWidth = content.width - leftWidth - rightWidth - gap * 2;
    const rightX = content.x + content.width - rightWidth;
    const g = this.graphics;
    g.fillStyle(COLORS.ink, 0.68);
    g.fillRect(content.x, content.y, content.width, 96);
    g.fillStyle(COLORS.bronze, 0.68);
    g.fillRect(content.x, content.y, 2, 96);
    this.drawSectionHeading(
      content.x,
      content.y,
      model.hero?.eyebrow,
      model.hero?.title,
      model.hero?.subtitle,
      content.width,
      false,
    );
    const startY = content.y + 102;
    g.fillStyle(COLORS.ink, 0.68);
    g.fillRect(content.x, startY, leftWidth, content.height - 102);
    g.fillRect(rightX, startY, rightWidth, content.height - 102);
    g.lineStyle(1, COLORS.line, 0.48);
    g.strokeRect(content.x + 0.5, startY + 0.5, leftWidth - 1, content.height - 103);
    g.strokeRect(rightX + 0.5, startY + 0.5, rightWidth - 1, content.height - 103);

    this.addText(content.x + 16, startY + 16, "本阵战果", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "17px",
      color: "#f2ead8",
    });
    const summary = detail.summary || [];
    summary.forEach((item, index) => {
      const y = startY + 50 + index * 66;
      g.fillStyle(COLORS.panel, 0.78);
      g.fillRect(content.x + 14, y, leftWidth - 28, 56);
      g.fillStyle(index === 1 ? COLORS.cinnabar : COLORS.bronze, 0.7);
      g.fillRect(content.x + 14, y, 2, 56);
      this.addText(content.x + 25, y + 9, item.label, {
        fontSize: "9px",
        color: "#aaa08a",
        wordWrap: { width: leftWidth - 50, useAdvancedWrap: true },
        maxLines: 1,
      });
      this.addText(content.x + 25, y + 25, String(item.value), {
        fontFamily: TEXT_STYLE.serif,
        fontSize: "18px",
        color: "#d8b970",
        wordWrap: { width: leftWidth - 50, useAdvancedWrap: true },
        maxLines: 1,
      });
    });
    g.lineStyle(1, COLORS.bronzeDim, 0.5);
    g.lineBetween(content.x + 14, startY + 322, content.x + leftWidth - 14, startY + 322);
    this.addText(content.x + 16, startY + 338, "本阵入账", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "15px",
      color: "#f2ead8",
    });
    const reward = detail.reward || {};
    this.addText(
      content.x + 16,
      startY + 367,
      `铜钱 +${reward.copper || 0}\n历练 +${reward.xp || 0}\n军功 +${reward.score || 0}`,
      {
        fontSize: "10px",
        color: "#c8b99e",
        lineSpacing: 8,
        wordWrap: { width: leftWidth - 32, useAdvancedWrap: true },
        maxLines: 3,
      },
    );
    if (detail.bounty) {
      this.addText(content.x + 16, startY + 438, "阵前悬赏", {
        fontFamily: TEXT_STYLE.serif,
        fontSize: "14px",
        color: "#f2ead8",
      });
      this.addText(
        content.x + 16,
        startY + 463,
        `${detail.bounty.name} · ${detail.bounty.cleared ? "已达成" : "未达成"}\n${detail.bounty.description}`,
        {
          fontSize: "9px",
          color: detail.bounty.cleared ? "#a9d0c8" : "#b3a68e",
          lineSpacing: 5,
          wordWrap: { width: leftWidth - 32, useAdvancedWrap: true },
          maxLines: 4,
        },
      );
    }

    g.fillStyle(COLORS.ink, 0.72);
    g.fillRect(centerX, startY, centerWidth, 84);
    g.lineStyle(1, COLORS.line, 0.34);
    g.strokeRect(centerX + 0.5, startY + 0.5, centerWidth - 1, 83);
    this.addText(centerX + 14, startY + 12, detail.trials?.selectedCount ? "阵后择令 · 强化本轮构筑" : "阵后择令 · 三选其一", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "24px",
      fontStyle: "bold",
      color: "#f2ead8",
    });
    this.addText(
      centerX + 14,
      startY + 54,
      "军令会叠加层数并可能凝成阵眼。军师荐令以金色标记。",
      {
        fontSize: "10px",
        color: "#d0c0a4",
        wordWrap: { width: centerWidth - 28, useAdvancedWrap: true },
        maxLines: 1,
      },
    );
    const choices = model.cards || [];
    const choiceGap = 10;
    const choiceColumns = Math.max(1, Math.min(3, choices.length));
    const choiceWidth =
      (centerWidth - choiceGap * (choiceColumns - 1)) / choiceColumns;
    const rewardActions = model.actions || [];
    const rewardActionColumns = 2;
    const rewardActionRows = Math.ceil(
      rewardActions.length / rewardActionColumns,
    );
    const rewardActionHeight = rewardActionRows
      ? rewardActionRows * 44 + (rewardActionRows - 1) * 9
      : 0;
    const rewardTop = startY + 88;
    const rewardCardHeight = clamp(
      content.y +
        content.height -
        rewardTop -
        rewardActionHeight -
        16,
      220,
      338,
    );
    choices.forEach((card, index) => {
      this.drawArenaRewardChoice(
        centerX + index * (choiceWidth + choiceGap),
        rewardTop,
        choiceWidth,
        rewardCardHeight,
        card,
      );
    });
    const actionY = rewardTop + rewardCardHeight + 16;
    this.drawActionGrid(
      rewardActions,
      centerX,
      actionY,
      centerWidth,
      rewardActionColumns,
      false,
    );

    this.addText(rightX + 16, startY + 16, "下一阵推演", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "17px",
      color: "#f2ead8",
    });
    const next = detail.nextEncounter;
    g.fillStyle(COLORS.panel, 0.76);
    g.fillRect(rightX + 14, startY + 50, rightWidth - 28, 116);
    g.fillStyle(COLORS.cinnabar, 0.68);
    g.fillRect(rightX + 14, startY + 50, 2, 116);
    this.addText(rightX + 26, startY + 63, next?.name || "军势未明", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "16px",
      color: "#f2ead8",
      wordWrap: { width: rightWidth - 52, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(rightX + 26, startY + 90, next?.tactic || "", {
      fontSize: "10px",
      color: "#e2c581",
      wordWrap: { width: rightWidth - 52, useAdvancedWrap: true },
      maxLines: 2,
    });
    this.addText(rightX + 26, startY + 128, next?.description || "", {
      fontSize: "9px",
      color: "#b9ac94",
      lineSpacing: 4,
      wordWrap: { width: rightWidth - 52, useAdvancedWrap: true },
      maxLines: 3,
    });
    this.addText(rightX + 16, startY + 188, "当前构筑", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "15px",
      color: "#f2ead8",
    });
    const build = detail.build || {};
    this.addText(
      rightX + 16,
      startY + 217,
      `${build.boons?.length || 0} 重军令 · ${build.activeCount || 0} 项阵眼生效`,
      {
        fontSize: "10px",
        color: "#d8c9ad",
        wordWrap: { width: rightWidth - 32, useAdvancedWrap: true },
        maxLines: 2,
      },
    );
    (build.masteries || []).slice(0, 3).forEach((mastery, index) => {
      const y = startY + 254 + index * 48;
      this.drawGlyph(
        g,
        mastery.icon || "star",
        rightX + 27,
        y + 14,
        14,
        COLORS.bronze,
      );
      this.addText(rightX + 43, y + 2, mastery.name, {
        fontSize: "10px",
        color: "#f0e8d7",
        wordWrap: { width: rightWidth - 60, useAdvancedWrap: true },
        maxLines: 1,
      });
      this.addText(rightX + 43, y + 21, mastery.description || "", {
        fontSize: "9px",
        color: "#aaa08a",
        wordWrap: { width: rightWidth - 60, useAdvancedWrap: true },
        maxLines: 2,
      });
    });
    const nextFormation = build.nextFormation;
    if (nextFormation) {
      g.lineStyle(1, COLORS.tealDim, 0.48);
      g.lineBetween(rightX + 14, startY + 406, rightX + rightWidth - 14, startY + 406);
      this.addText(rightX + 16, startY + 421, "下一阵", {
        fontSize: "9px",
        color: "#a9d0c8",
      });
      this.addText(rightX + 16, startY + 440, nextFormation.name, {
        fontFamily: TEXT_STYLE.serif,
        fontSize: "14px",
        color: "#f2ead8",
        wordWrap: { width: rightWidth - 32, useAdvancedWrap: true },
        maxLines: 1,
      });
      this.addText(rightX + 16, startY + 463, `尚缺 ${nextFormation.missing} 重军令`, {
        fontSize: "9px",
        color: "#b9ac94",
        wordWrap: { width: rightWidth - 32, useAdvancedWrap: true },
        maxLines: 1,
      });
    }
    if (detail.relics?.length) {
      this.addText(rightX + 16, startY + 500, `新军器 · ${detail.relics[0].title}`, {
        fontFamily: TEXT_STYLE.serif,
        fontSize: "12px",
        color: "#d8b970",
        wordWrap: { width: rightWidth - 32, useAdvancedWrap: true },
        maxLines: 1,
      });
    }
  }

  drawArenaRewardChoice(x, y, width, height, card) {
    const g = this.graphics;
    const recommended = Boolean(card.recommended);
    const disabled = Boolean(card.disabled);
    const tone = recommended ? COLORS.bronze : COLORS.line;
    g.fillStyle(COLORS.panel, disabled ? 0.64 : 0.94);
    g.fillRect(x, y, width, height);
    g.lineStyle(recommended ? 2 : 1, tone, disabled ? 0.28 : recommended ? 0.94 : 0.56);
    g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    g.fillStyle(recommended ? COLORS.bronze : COLORS.tealDim, disabled ? 0.12 : recommended ? 0.86 : 0.54);
    g.fillRect(x, y, width, 4);
    g.fillStyle(COLORS.ink, 0.36);
    g.fillCircle(x + width / 2, y + 76, Math.min(48, width * 0.2));
    this.drawGlyph(
      g,
      card.icon || "star",
      x + width / 2,
      y + 76,
      Math.min(42, width * 0.18),
      disabled ? COLORS.faint : recommended ? COLORS.bronze : COLORS.paperMuted,
    );
    this.addText(x + 16, y + 130, card.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "18px",
      fontStyle: "bold",
      color: disabled ? "#858a80" : "#f2ead8",
      wordWrap: { width: width - 32, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(x + 16, y + 160, card.meta || "", {
      fontSize: "9px",
      color: recommended ? "#e2c581" : disabled ? "#777d73" : "#c0b39b",
      lineSpacing: 4,
      wordWrap: { width: width - 32, useAdvancedWrap: true },
      maxLines: 2,
    });
    g.lineStyle(1, COLORS.line, 0.46);
    g.lineBetween(x + 16, y + 192, x + width - 16, y + 192);
    this.addText(x + 16, y + 206, card.body || "", {
      fontSize: "11px",
      color: disabled ? "#777d73" : "#d8c9ad",
      lineSpacing: 6,
      wordWrap: { width: width - 32, useAdvancedWrap: true },
      maxLines: 5,
    });
    if (recommended) {
      g.fillStyle(COLORS.bronze, 0.9);
      g.fillRect(x + width - 68, y + 10, 52, 21);
      this.addCenteredText(
        x + width - 42,
        y + 20.5,
        "军师荐令",
        { fontSize: "9px", color: "#13201d" },
        46,
      );
    }
    this.addText(x + 16, y + height - 36, card.action ? "点选此令，收入构筑" : card.badge || "待整军", {
      fontSize: "10px",
      color: disabled ? "#777d73" : "#e2c581",
      wordWrap: { width: width - 32, useAdvancedWrap: true },
      maxLines: 1,
    });
    if (card.action && !disabled) {
      this.addHitArea(`arena-reward:${card.id}`, x, y, width, height, card);
    }
  }

  drawFinalChoice(model) {
    const compact = this.width < 960;
    const margin = compact ? 20 : 72;
    const contentWidth = this.width - margin * 2;
    const g = this.graphics;
    g.fillStyle(COLORS.ink, 0.5);
    g.fillRect(0, 0, this.width, this.height);
    g.fillStyle(COLORS.ink, 0.86);
    g.fillRect(0, 0, this.width, compact ? 138 : 164);
    g.fillRect(0, this.height - (compact ? 92 : 108), this.width, compact ? 92 : 108);
    g.fillStyle(COLORS.cinnabar, 0.9);
    g.fillRect(margin, compact ? 29 : 34, 3, compact ? 68 : 84);
    this.addText(margin + 18, compact ? 25 : 29, model.hero?.eyebrow || "终回 · 水泊聚义", {
      fontSize: compact ? "8px" : "10px",
      letterSpacing: compact ? 1.2 : 2,
      color: "#d8b970",
      wordWrap: { width: contentWidth * 0.56, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(margin + 18, compact ? 45 : 51, model.hero?.title || "梁山往何处去", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: compact ? "31px" : "43px",
      fontStyle: "bold",
      color: "#f2ead8",
      stroke: "#050807",
      strokeThickness: 2,
      wordWrap: { width: contentWidth * 0.58, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(
      margin + 18,
      compact ? 91 : 108,
      model.hero?.subtitle || "落笔之后，本篇终卷。",
      {
        fontSize: compact ? "9px" : "11px",
        color: "#d2c3a7",
        lineSpacing: 4,
        wordWrap: { width: contentWidth * 0.58, useAdvancedWrap: true },
        maxLines: 2,
      },
    );
    this.addText(
      this.width - margin - 260,
      compact ? 69 : 76,
      "命途落笔 · 不可反悔",
      {
        fontFamily: TEXT_STYLE.serif,
        fontSize: compact ? "12px" : "15px",
        color: "#d8b970",
        align: "right",
        wordWrap: { width: 250, useAdvancedWrap: true },
        maxLines: 1,
      },
    );

    const cards = model.cards || [];
    const top = compact ? 156 : 184;
    const bottom = this.height - (compact ? 112 : 138);
    const gap = compact ? 10 : 18;
    const laneWidth = (contentWidth - gap * (Math.max(1, cards.length) - 1)) / Math.max(1, cards.length);
    const colors = [COLORS.teal, COLORS.bronze, COLORS.blue];
    cards.forEach((card, index) => {
      const x = margin + index * (laneWidth + gap);
      const color = colors[index % colors.length];
      const active = card.tone === "primary";
      g.fillStyle(COLORS.panel, active ? 0.88 : 0.72);
      g.fillRect(x, top, laneWidth, bottom - top);
      g.lineStyle(active ? 2 : 1, active ? COLORS.cinnabar : color, active ? 0.94 : 0.56);
      g.strokeRect(x + 0.5, top + 0.5, laneWidth - 1, bottom - top - 1);
      g.fillStyle(color, active ? 0.9 : 0.62);
      g.fillRect(x, top, laneWidth, active ? 5 : 3);
      g.lineStyle(1, color, 0.18);
      for (let line = 0; line < 5; line += 1) {
        const lineY = top + 92 + line * 34;
        g.lineBetween(x + 20, lineY, x + laneWidth - 20, lineY);
      }
      g.fillStyle(COLORS.ink, 0.52);
      g.fillCircle(x + laneWidth / 2, top + 92, Math.min(48, laneWidth * 0.17));
      this.drawGlyph(
        g,
        card.icon || "star",
        x + laneWidth / 2,
        top + 92,
        Math.min(48, laneWidth * 0.17),
        color,
      );
      this.addCenteredText(
        x + laneWidth / 2,
        top + 164,
        `命途 ${String(index + 1).padStart(2, "0")}`,
        {
          fontSize: "8px",
          color: active ? "#f0c994" : "#9c927d",
        },
        laneWidth - 30,
      );
      this.addCenteredText(
        x + laneWidth / 2,
        top + 194,
        card.title || "",
        {
          fontFamily: TEXT_STYLE.serif,
          fontSize: compact ? "24px" : "31px",
          fontStyle: "bold",
          color: "#f2ead8",
        },
        laneWidth - 34,
      );
      this.addCenteredText(
        x + laneWidth / 2,
        top + 235,
        card.meta || "",
        {
          fontSize: compact ? "8px" : "9px",
          color: active ? "#d8b970" : "#b9ac94",
        },
        laneWidth - 34,
      );
      g.lineStyle(1, color, 0.48);
      g.lineBetween(x + 26, top + 262, x + laneWidth - 26, top + 262);
      this.addText(x + 26, top + 282, card.body || "", {
        fontSize: compact ? "9px" : "11px",
        color: "#d1c1a5",
        lineSpacing: 6,
        wordWrap: { width: laneWidth - 52, useAdvancedWrap: true },
        maxLines: compact ? 4 : 7,
      });
      const ctaY = bottom - 58;
      g.fillStyle(active ? COLORS.cinnabar : color, active ? 0.9 : 0.22);
      g.fillRect(x + 20, ctaY, laneWidth - 40, 38);
      g.lineStyle(1, active ? COLORS.bronze : color, active ? 0.86 : 0.5);
      g.strokeRect(x + 20.5, ctaY + 0.5, laneWidth - 41, 37);
      this.addCenteredText(
        x + laneWidth / 2,
        ctaY + 19,
        card.badge || "落定此卷",
        {
          fontFamily: TEXT_STYLE.serif,
          fontSize: "12px",
          color: "#f8edda",
        },
        laneWidth - 52,
      );
      if (card.action && !card.disabled) {
        this.addHitArea(`ending-route:${card.id}`, x, top, laneWidth, bottom - top, card);
      }
    });
    this.addCenteredText(
      this.width / 2,
      this.height - (compact ? 61 : 72),
      "选择会写入结局收录，并影响后日谈中的梁山归处。",
      {
        fontSize: compact ? "8px" : "10px",
        color: "#c8b99e",
      },
      contentWidth - 40,
    );
  }

  drawVictory(model) {
    const compact = this.width < 1000;
    const margin = compact ? 22 : 64;
    const contentWidth = this.width - margin * 2;
    const g = this.graphics;
    const top = compact ? 24 : 38;
    g.fillStyle(COLORS.ink, 0.3);
    g.fillRect(0, 0, this.width, this.height);
    g.fillStyle(COLORS.ink, 0.9);
    g.fillRect(0, 0, this.width, compact ? 220 : 286);
    g.fillStyle(COLORS.cinnabar, 0.9);
    g.fillRect(margin, top, 4, compact ? 150 : 206);
    const portraitWidth = compact ? 116 : 206;
    if (model.hero?.image) {
      this.addImage(
        margin + portraitWidth / 2 + 18,
        top + (compact ? 92 : 128),
        model.hero.image,
        portraitWidth,
        compact ? 174 : 238,
        { decorative: true, alpha: 0.9 },
      );
    }
    const textX = margin + portraitWidth + (compact ? 34 : 54);
    const action = (model.actions || [])[0];
    const actionWidth = compact ? 150 : 190;
    this.addText(textX, top + 4, model.hero?.eyebrow || "战卷已定", {
      fontSize: compact ? "8px" : "10px",
      letterSpacing: 1.5,
      color: "#d8b970",
      wordWrap: { width: contentWidth - (textX - margin) - actionWidth - 20, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(textX, top + (compact ? 24 : 33), model.hero?.title || "战事已定", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: compact ? "34px" : "47px",
      fontStyle: "bold",
      color: "#f2ead8",
      stroke: "#050807",
      strokeThickness: 2,
      wordWrap: { width: contentWidth - (textX - margin) - actionWidth - 30, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(
      textX,
      top + (compact ? 81 : 105),
      model.hero?.subtitle || "",
      {
        fontSize: compact ? "9px" : "12px",
        color: "#d2c3a7",
        lineSpacing: compact ? 4 : 6,
        wordWrap: { width: contentWidth - (textX - margin) - actionWidth - 30, useAdvancedWrap: true },
        maxLines: compact ? 3 : 4,
      },
    );
    const stampX = this.width - margin - actionWidth;
    g.fillStyle(COLORS.cinnabar, 0.62);
    g.fillRect(stampX, top + (compact ? 22 : 28), actionWidth, 28);
    this.addCenteredText(
      stampX + actionWidth / 2,
      top + (compact ? 36 : 42),
      "章回完成",
      {
        fontFamily: TEXT_STYLE.serif,
        fontSize: compact ? "10px" : "12px",
        color: "#fff1db",
      },
      actionWidth - 12,
    );
    if (action) {
      this.drawButton(
        stampX,
        top + (compact ? 58 : 72),
        actionWidth,
        compact ? 40 : 46,
        action,
        compact,
      );
    }

    const cards = model.cards || [];
    const coreCards = cards.slice(0, 3);
    const collectionCards = cards.slice(3);
    const coreY = compact ? 238 : 310;
    const coreHeight = compact ? 82 : 102;
    const coreGap = 10;
    const coreWidth = (contentWidth - coreGap * 2) / 3;
    coreCards.forEach((card, index) => {
      const x = margin + index * (coreWidth + coreGap);
      g.fillStyle(COLORS.panel, 0.88);
      g.fillRect(x, coreY, coreWidth, coreHeight);
      g.lineStyle(1, index === 0 ? COLORS.bronze : COLORS.line, index === 0 ? 0.78 : 0.52);
      g.strokeRect(x + 0.5, coreY + 0.5, coreWidth - 1, coreHeight - 1);
      g.fillStyle(index === 0 ? COLORS.bronze : COLORS.tealDim, index === 0 ? 0.76 : 0.46);
      g.fillRect(x, coreY, 3, coreHeight);
      this.drawGlyph(
        g,
        card.icon || "star",
        x + 28,
        coreY + coreHeight / 2,
        21,
        index === 0 ? COLORS.bronze : COLORS.paperMuted,
      );
      this.addText(x + 50, coreY + 12, card.meta || "", {
        fontSize: "9px",
        color: "#b9ac94",
        wordWrap: { width: coreWidth - 64, useAdvancedWrap: true },
        maxLines: 1,
      });
      this.addText(x + 50, coreY + 32, card.title || "", {
        fontFamily: TEXT_STYLE.serif,
        fontSize: compact ? "16px" : "21px",
        fontStyle: "bold",
        color: "#f2ead8",
        wordWrap: { width: coreWidth - 64, useAdvancedWrap: true },
        maxLines: 1,
      });
      this.addText(x + 14, coreY + coreHeight - 25, card.body || "", {
        fontSize: "10px",
        color: "#d0c0a4",
        wordWrap: { width: coreWidth - 28, useAdvancedWrap: true },
        maxLines: 1,
      });
    });

    const archiveY = coreY + coreHeight + 19;
    const footerHeight = 18;
    const pagerHeight = 30;
    const archiveBottom = this.height - margin - footerHeight;
    this.addText(margin, archiveY, "战卷收获", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: compact ? "18px" : "22px",
      fontStyle: "bold",
      color: "#f2ead8",
    });
    this.addText(margin + 110, archiveY + 5, "评鉴、战意与长期收集已录入卷宗。", {
      fontSize: "10px",
      color: "#b9ac94",
      wordWrap: { width: contentWidth - 110, useAdvancedWrap: true },
      maxLines: 1,
    });
    if (!collectionCards.length) {
      this.addText(margin, archiveY + 54, "本章无额外收集项。", {
        fontSize: "10px",
        color: "#8f856f",
      });
      return;
    }
    const gridY = archiveY + 38;
    const columns = 2;
    const rows = compact ? 2 : 2;
    const capacity = columns * rows;
    const pageCount = Math.max(1, Math.ceil(collectionCards.length / capacity));
    const page = clamp(this.cardPage, 0, pageCount - 1);
    this.cardPage = page;
    const visible = collectionCards.slice(page * capacity, page * capacity + capacity);
    const gridHeight = archiveBottom - gridY - (pageCount > 1 ? pagerHeight + 8 : 0);
    const gap = 8;
    const cardWidth = (contentWidth - gap * (columns - 1)) / columns;
    const cardHeight = (gridHeight - gap * (rows - 1)) / rows;
    visible.forEach((card, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      this.drawVictoryRelic(
        margin + column * (cardWidth + gap),
        gridY + row * (cardHeight + gap),
        cardWidth,
        cardHeight,
        card,
      );
    });
    if (pageCount > 1) {
      this.drawCardPager(
        margin,
        archiveBottom - pagerHeight,
        contentWidth,
        pagerHeight,
        page,
        pageCount,
        compact,
      );
    }
  }

  drawVictoryRelic(x, y, width, height, card) {
    const g = this.graphics;
    const primary = card.tone === "primary";
    const tone = primary ? COLORS.bronze : COLORS.tealDim;
    g.fillStyle(COLORS.panel, 0.9);
    g.fillRect(x, y, width, height);
    g.lineStyle(1, primary ? COLORS.bronzeDim : COLORS.line, primary ? 0.7 : 0.48);
    g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    g.fillStyle(primary ? COLORS.bronze : COLORS.tealDim, primary ? 0.72 : 0.34);
    g.fillRect(x, y, 3, height);
    this.addTiledImage(x + 2, y + 2, width - 4, height - 4, UI_ASSETS.pattern, {
      alpha: primary ? 0.1 : 0.05,
      blendMode: "SCREEN",
      decorative: true,
      tileScale: 0.44,
    });
    this.drawCornerBrackets(
      x,
      y,
      width,
      height,
      tone,
      primary ? 0.46 : 0.24,
    );
    const sealRadius = clamp(
      Math.min(34, width * 0.09),
      26,
      34,
    );
    const sealX = x + width - sealRadius - 22;
    const sealY = y + 52;
    g.fillStyle(COLORS.ink, 0.42);
    g.fillCircle(sealX, sealY, sealRadius);
    g.lineStyle(1, tone, primary ? 0.62 : 0.34);
    g.strokeCircle(sealX, sealY, sealRadius);
    g.strokeCircle(sealX, sealY, sealRadius - 5);
    this.drawGlyph(
      g,
      card.icon || "star",
      sealX,
      sealY,
      sealRadius * 0.76,
      primary ? COLORS.bronze : COLORS.paperMuted,
    );
    this.addText(x + 50, y + 10, card.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "16px",
      fontStyle: "bold",
      color: "#f2ead8",
      wordWrap: {
        width: width - 64 - sealRadius * 2 - 28,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    });
    this.addText(x + 50, y + 36, card.meta || "", {
      fontSize: "10px",
      color: primary ? "#e2c581" : "#b9ac94",
      wordWrap: {
        width: width - 64 - sealRadius * 2 - 28,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    });
    if (height >= 88) {
      g.lineStyle(1, primary ? COLORS.bronzeDim : COLORS.line, 0.42);
      g.lineBetween(
        x + 14,
        y + 58,
        x + width - sealRadius * 2 - 42,
        y + 58,
      );
      this.addText(x + 14, y + 68, card.body || "", {
        fontSize: "11px",
        color: "#d0c0a4",
        lineSpacing: 5,
        wordWrap: {
          width: width - sealRadius * 2 - 58,
          useAdvancedWrap: true,
        },
        maxLines: Math.max(1, Math.floor((height - 116) / 18)),
      });
    }
    const archiveLineY = y + height - 32;
    g.fillStyle(COLORS.panelRaised, 0.66);
    g.fillRect(x + 12, archiveLineY, width - 24, 22);
    g.fillStyle(tone, primary ? 0.68 : 0.36);
    g.fillRect(x + 12, archiveLineY, 2, 22);
    this.addText(
      x + 22,
      archiveLineY + 6,
      primary ? "本章新录 · 已收入战卷" : "长期收集 · 战卷已录",
      {
        fontSize: "9px",
        color: primary ? "#e2c581" : "#b9ac94",
        wordWrap: { width: width - 70, useAdvancedWrap: true },
        maxLines: 1,
      },
    );
    this.drawGlyph(
      g,
      "check",
      x + width - 28,
      archiveLineY + 11,
      12,
      tone,
    );
  }

  drawEnding(model) {
    const compact = this.width < 1000;
    const margin = compact ? 24 : 68;
    const contentWidth = this.width - margin * 2;
    const g = this.graphics;
    const detail = model.detail || {};
    g.fillStyle(COLORS.ink, 0.42);
    g.fillRect(0, 0, this.width, this.height);
    g.fillStyle(COLORS.ink, 0.82);
    g.fillRect(0, 0, compact ? this.width : this.width * 0.64, this.height);
    g.fillStyle(COLORS.cinnabar, 0.86);
    g.fillRect(margin, compact ? 30 : 48, 4, compact ? 178 : 238);
    const top = compact ? 28 : 44;
    this.addText(margin + 20, top, model.hero?.eyebrow || "全篇终", {
      fontSize: compact ? "8px" : "10px",
      letterSpacing: compact ? 1.3 : 2,
      color: "#d8b970",
      wordWrap: { width: contentWidth * 0.54, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(margin + 20, top + (compact ? 20 : 27), model.hero?.title || "终卷", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: compact ? "42px" : "58px",
      fontStyle: "bold",
      color: "#f2ead8",
      stroke: "#050807",
      strokeThickness: 3,
      wordWrap: { width: compact ? contentWidth - 28 : contentWidth * 0.54, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(
      margin + 20,
      top + (compact ? 83 : 111),
      model.hero?.subtitle || "",
      {
        fontSize: compact ? "10px" : "13px",
        color: "#d9cbb0",
        lineSpacing: compact ? 5 : 8,
        wordWrap: { width: compact ? contentWidth - 28 : contentWidth * 0.54, useAdvancedWrap: true },
        maxLines: compact ? 6 : 8,
      },
    );
    const dividerY = top + (compact ? 244 : 326);
    g.lineStyle(1, COLORS.bronzeDim, 0.58);
    g.lineBetween(margin + 20, dividerY, compact ? this.width - margin : this.width * 0.55, dividerY);
    this.addText(margin + 20, dividerY + 17, "后可追寻", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "17px",
      color: "#f2ead8",
    });
    const routeCards = detail.routeCards || [];
    const routeY = dividerY + 49;
    const routeGap = 8;
    const routeWidth =
      (Math.min(compact ? contentWidth : contentWidth * 0.55, 760) -
        margin -
        20 -
        routeGap * Math.max(0, routeCards.length - 1)) /
      Math.max(1, routeCards.length);
    routeCards.forEach((card, index) => {
      const x = margin + 20 + index * (routeWidth + routeGap);
      g.fillStyle(COLORS.panel, 0.82);
      g.fillRect(x, routeY, routeWidth, 92);
      g.lineStyle(1, COLORS.line, 0.5);
      g.strokeRect(x + 0.5, routeY + 0.5, routeWidth - 1, 91);
      this.drawGlyph(
        g,
        card.icon || "star",
        x + 24,
        routeY + 26,
        17,
        COLORS.bronze,
      );
      this.addText(x + 42, routeY + 13, card.title || "", {
        fontFamily: TEXT_STYLE.serif,
        fontSize: "14px",
        color: "#f2ead8",
        wordWrap: { width: routeWidth - 52, useAdvancedWrap: true },
        maxLines: 1,
      });
      this.addText(x + 12, routeY + 43, card.body || "", {
        fontSize: "10px",
        color: "#b9ac94",
        lineSpacing: 4,
        wordWrap: { width: routeWidth - 24, useAdvancedWrap: true },
        maxLines: 2,
      });
      this.drawProgressTrack(
        x + 12,
        routeY + 79,
        routeWidth - 24,
        4,
        card.progress ?? 0,
        card.tone === "primary" ? COLORS.bronze : COLORS.tealDim,
      );
      if (card.action && !card.disabled) {
        this.addHitArea(`ending-route-goal:${card.id}`, x, routeY, routeWidth, 92, card);
      }
    });

    const actions = model.actions || [];
    const actionY = this.height - (compact ? 86 : 94);
    this.drawActionGrid(
      actions,
      margin + 20,
      actionY,
      Math.min(compact ? contentWidth - 40 : contentWidth * 0.55, 740),
      3,
      compact,
    );

    const railWidth = compact ? contentWidth : clamp(contentWidth * 0.32, 360, 430);
    const railX = compact ? margin : this.width - margin - railWidth;
    const railY = compact
      ? Math.min(this.height - 360, routeY + 124)
      : 54;
    const railHeight = compact ? 280 : this.height - 108;
    g.fillStyle(COLORS.ink, 0.9);
    g.fillRect(railX, railY, railWidth, railHeight);
    g.lineStyle(1, COLORS.bronzeDim, 0.56);
    g.strokeRect(railX + 0.5, railY + 0.5, railWidth - 1, railHeight - 1);
    g.fillStyle(COLORS.bronze, 0.8);
    g.fillRect(railX, railY, 3, 128);
    this.addText(railX + 20, railY + 18, "终卷后日谈", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "23px",
      fontStyle: "bold",
      color: "#f2ead8",
    });
    this.addText(railX + 20, railY + 50, "本卷收录与长期命途", {
      fontSize: "10px",
      color: "#b9ac94",
      wordWrap: { width: railWidth - 40, useAdvancedWrap: true },
      maxLines: 1,
    });
    const rows = detail.collectionRows || [];
    rows.forEach((row, index) => {
      const y = railY + 82 + index * 52;
      const progress =
        Number(row.target) > 0
          ? Number(row.current) / Number(row.target)
          : 0;
      this.addText(railX + 20, y, row.label, {
        fontSize: "10px",
        color: "#d8c9ad",
        wordWrap: { width: railWidth - 120, useAdvancedWrap: true },
        maxLines: 1,
      });
      this.addText(railX + railWidth - 100, y, row.value, {
        fontSize: "10px",
        color: "#e2c581",
        align: "right",
        wordWrap: { width: 80, useAdvancedWrap: true },
        maxLines: 1,
      });
      this.drawProgressTrack(
        railX + 20,
        y + 21,
        railWidth - 40,
        4,
        progress,
        progress >= 1 ? COLORS.teal : COLORS.bronzeDim,
      );
    });
    const plus = detail.newGamePlus || 0;
    if (!compact) {
      g.lineStyle(1, COLORS.line, 0.5);
      g.lineBetween(
        railX + 20,
        railY + railHeight - 104,
        railX + railWidth - 20,
        railY + railHeight - 104,
      );
      this.addText(railX + 20, railY + railHeight - 85, plus ? `星图已历 ${plus} 周目` : "可携星图重开", {
        fontFamily: TEXT_STYLE.serif,
        fontSize: "15px",
        color: "#f2ead8",
        wordWrap: { width: railWidth - 40, useAdvancedWrap: true },
        maxLines: 1,
      });
      this.addText(railX + 20, railY + railHeight - 59, "新周目保留已收录命途，重置章回抉择。", {
        fontSize: "10px",
        color: "#aaa08a",
        lineSpacing: 4,
        wordWrap: { width: railWidth - 40, useAdvancedWrap: true },
        maxLines: 2,
      });
    }
  }

  drawCodex(model) {
    const frame = this.getFrame();
    this.drawHeader(model, frame);
    this.drawNavigation(model, frame);
    const content = frame.content;
    const compact = frame.compact || this.width < 1060;
    const detail = model.detail || {};
    const cards = model.cards || [];
    if (compact) {
      this.drawCompactHeroProfile(
        model.hero,
        content.x,
        content.y,
        content.width,
        116,
      );
      const actionHeight = this.drawActionGrid(
        model.actions || [],
        content.x,
        content.y + 126,
        content.width,
        2,
        true,
      );
      this.drawCardGrid(
        cards,
        content,
        content.y + 136 + actionHeight,
        model,
        { compact: true, columns: 2, minHeight: 68, maxHeight: 92 },
      );
      return;
    }

    const archiveWidth = clamp(content.width * 0.35, 370, 430);
    const chartWidth = content.width - archiveWidth - 16;
    const archiveX = content.x + content.width - archiveWidth;
    const heroCards = cards.filter((card) =>
      (card.action === "codex-hero" || card.action === "locked-hero") &&
      !String(card.id).startsWith("doctrine-"),
    );
    const selectedId = detail.selectedHeroId;
    const selectedCard =
      heroCards.find(
        (card) => card.data?.hero === selectedId || card.tone === "primary",
      ) || heroCards[0];
    const satelliteCards = heroCards.filter(
      (card) =>
        card.id !== selectedCard?.id &&
        !card.disabled,
    ).slice(0, 5);
    const g = this.graphics;

    g.fillStyle(COLORS.ink, 0.58);
    g.fillRect(content.x, content.y, chartWidth, content.height);
    g.lineStyle(1, COLORS.bronzeDim, 0.5);
    g.strokeRect(content.x + 0.5, content.y + 0.5, chartWidth - 1, content.height - 1);
    g.fillStyle(COLORS.bronze, 0.84);
    g.fillRect(content.x, content.y, 3, 164);
    this.drawPanelOrnaments(
      content.x,
      content.y,
      chartWidth,
      content.height,
      { alpha: 0.17, corners: 2 },
    );
    this.addText(content.x + 22, content.y + 18, "星命图谱 · 梁山群星", {
      fontSize: "10px",
      letterSpacing: 1.5,
      color: "#d8b970",
      wordWrap: { width: chartWidth - 44, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(content.x + 22, content.y + 42, "一百单八星 · 命途归位", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "29px",
      fontStyle: "bold",
      color: "#f2ead8",
      stroke: "#050807",
      strokeThickness: 2,
      wordWrap: { width: chartWidth - 44, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(content.x + 22, content.y + 83, selectedCard?.meta || "选择星位查看命途", {
      fontSize: "10px",
      color: "#c0b39b",
      wordWrap: { width: chartWidth - 44, useAdvancedWrap: true },
      maxLines: 1,
    });
    const centerX = content.x + chartWidth * 0.47;
    const centerY = content.y + 392;
    const radiusX = Math.min(245, chartWidth * 0.36);
    const radiusY = 205;
    const positions = [
      [-0.94, -0.7],
      [0.94, -0.7],
      [-1.04, 0.08],
      [1.04, 0.08],
      [-0.78, 0.94],
      [0.78, 0.94],
    ];
    for (let index = 0; index < 28; index += 1) {
      const seed = hashSeed(`codex-star-${index}`);
      const sx = content.x + 26 + (seed % Math.max(1, chartWidth - 52));
      const sy =
        content.y +
        132 +
        ((Math.floor(seed / 31) % Math.max(1, content.height - 246)));
      const radius = index % 7 === 0 ? 1.8 : index % 3 === 0 ? 1.1 : 0.65;
      g.fillStyle(index % 5 === 0 ? COLORS.bronze : COLORS.paperMuted, 0.18 + (index % 4) * 0.08);
      g.fillCircle(sx, sy, radius);
    }
    g.lineStyle(1, COLORS.bronzeDim, 0.2);
    g.lineBetween(centerX - 190, centerY - 142, centerX - 64, centerY - 92);
    g.lineBetween(centerX + 58, centerY + 116, centerX + 184, centerY + 162);
    satelliteCards.forEach((card, index) => {
      const [radiusScaleX, radiusScaleY] = positions[index] || [0, 0];
      const x = centerX + radiusScaleX * radiusX;
      const y = centerY + radiusScaleY * radiusY;
      g.lineStyle(1, COLORS.bronzeDim, 0.28);
      g.lineBetween(centerX, centerY, x, y);
    });
    g.lineStyle(1, COLORS.tealDim, 0.24);
    g.strokeCircle(centerX, centerY, radiusX * 0.94);
    g.strokeCircle(centerX, centerY, radiusY * 0.94);
    if (selectedCard?.image) {
      g.fillStyle(COLORS.ink, 0.74);
      g.fillCircle(centerX, centerY, 116);
      this.addImage(centerX, centerY, selectedCard.image, 196, 294, {
        decorative: true,
        alpha: 0.96,
      });
    }
    g.fillStyle(COLORS.ink, 0.68);
    g.fillRect(centerX - 116, centerY + 94, 232, 62);
    g.lineStyle(2, COLORS.cinnabar, 0.78);
    g.strokeCircle(centerX, centerY, 117);
    this.addCenteredText(
      centerX,
      centerY + 108,
      selectedCard?.title || detail.selectedHeroId || "星位未明",
      {
        fontFamily: TEXT_STYLE.serif,
        fontSize: "22px",
        fontStyle: "bold",
        color: "#f2ead8",
      },
      210,
    );
    this.addCenteredText(
      centerX,
      centerY + 136,
      selectedCard?.meta || "",
      {
        fontSize: "10px",
        color: "#e2c581",
      },
      210,
    );
    satelliteCards.forEach((card, index) => {
      const [radiusScaleX, radiusScaleY] = positions[index] || [0, 0];
      const x = centerX + radiusScaleX * radiusX;
      const y = centerY + radiusScaleY * radiusY;
      const active = card.tone === "primary";
      g.fillStyle(COLORS.ink, 0.92);
      g.fillCircle(x, y, 34);
      g.lineStyle(active ? 2 : 1, active ? COLORS.cinnabar : COLORS.bronzeDim, active ? 0.9 : 0.6);
      g.strokeCircle(x, y, 34);
      if (card.image) {
        this.addImage(x, y - 2, card.image, 52, 64, {
          decorative: true,
          alpha: 0.86,
        });
      }
      this.addCenteredText(
        x,
        y + 45,
        card.title || "好汉",
        {
          fontFamily: TEXT_STYLE.serif,
          fontSize: "11px",
          color: "#f0e8d7",
        },
        86,
      );
      this.addCenteredText(
        x,
        y + 60,
        card.badge || "",
        {
          fontSize: "9px",
          color: active ? "#e2c581" : "#aaa08a",
        },
        72,
      );
      this.addHitArea(`codex-star:${card.id}`, x - 40, y - 40, 80, 108, card);
    });
    const chronicle = (model.actions || []).find(
      (action) => action.id === "chronicle",
    );
    if (chronicle) {
      this.drawButton(
        centerX - 112,
        content.y + content.height - 62,
        224,
        40,
        chronicle,
        false,
      );
    }

    g.fillStyle(COLORS.ink, 0.9);
    g.fillRect(archiveX, content.y, archiveWidth, content.height);
    g.lineStyle(1, COLORS.line, 0.5);
    g.strokeRect(archiveX + 0.5, content.y + 0.5, archiveWidth - 1, content.height - 1);
    g.fillStyle(COLORS.teal, 0.7);
    g.fillRect(archiveX, content.y, 3, 142);
    this.drawPanelOrnaments(
      archiveX,
      content.y,
      archiveWidth,
      content.height,
      { alpha: 0.18, corners: 2 },
    );
    this.addText(archiveX + 20, content.y + 18, "命途档案", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "22px",
      fontStyle: "bold",
      color: "#f2ead8",
    });
    this.addText(archiveX + 20, content.y + 49, model.hero?.subtitle || "星位、命途与长期收录", {
      fontSize: "10px",
      color: "#d0c0a4",
      wordWrap: { width: archiveWidth - 40, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(archiveX + 20, content.y + 76, "命途抉择", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "15px",
      color: "#f2ead8",
    });
    const doctrines = detail.doctrines || [];
    doctrines.slice(0, 3).forEach((card, index) => {
      this.drawCodexDoctrineRow(
        archiveX + 18,
        content.y + 110 + index * 66,
        archiveWidth - 36,
        58,
        card,
      );
    });
    if (!doctrines.length) {
      this.addText(archiveX + 20, content.y + 106, "完成星命试炼后开启命途抉择。", {
      fontSize: "9px",
      color: "#a99c84",
        wordWrap: { width: archiveWidth - 40, useAdvancedWrap: true },
        maxLines: 2,
      });
    }
    const summaryY = content.y + 326;
    const alignmentCard = cards.find((card) => card.id === "alignment");
    const endingsCard = cards.find((card) => card.id === "endings");
    const achievementCard = cards.find((card) => card.id === "achievements");
    g.fillStyle(COLORS.panel, 0.78);
    g.fillRect(archiveX + 18, summaryY, archiveWidth - 36, 92);
    g.lineStyle(1, COLORS.line, 0.46);
    g.strokeRect(archiveX + 18.5, summaryY + 0.5, archiveWidth - 37, 91);
    this.addText(archiveX + 31, summaryY + 11, alignmentCard?.meta || "梁山主势", {
      fontSize: "10px",
      color: "#c8b99e",
    });
    this.addText(archiveX + 31, summaryY + 31, alignmentCard?.title || "主势未定", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "18px",
      color: "#f2ead8",
      wordWrap: { width: archiveWidth - 62, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(archiveX + 31, summaryY + 61, alignmentCard?.body || "", {
      fontSize: "10px",
      color: "#d8c9ad",
      wordWrap: { width: archiveWidth - 62, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(archiveX + 20, summaryY + 108, endingsCard?.title || "0/3 结局", {
      fontSize: "10px",
      color: "#d8b970",
      wordWrap: { width: archiveWidth * 0.45, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(archiveX + archiveWidth * 0.52, summaryY + 108, achievementCard?.title || "0 战功", {
      fontSize: "9px",
      color: "#d8b970",
      wordWrap: { width: archiveWidth * 0.42, useAdvancedWrap: true },
      maxLines: 1,
    });
    const archiveActions = (model.actions || []).filter(
      (action) => action.id === "bonds" || action.id === "chains",
    );
    archiveActions.forEach((action, index) => {
      this.drawButton(
        archiveX + 18 + index * ((archiveWidth - 42) / 2 + 6),
        content.y + 466,
        (archiveWidth - 42) / 2,
        36,
        action,
        false,
      );
    });
    const activeArchiveCards = cards
      .filter(
        (card) =>
          String(card.id).startsWith("bond-") ||
          String(card.id).startsWith("chain-"),
      )
      .slice(0, 3);
    if (activeArchiveCards.length) {
      activeArchiveCards.forEach((card, index) => {
        const rowY = content.y + 516 + index * 62;
        g.fillStyle(COLORS.panelRaised, 0.72);
        g.fillRect(archiveX + 18, rowY, archiveWidth - 36, 54);
        g.fillStyle(
          card.tone === "primary" ? COLORS.bronze : COLORS.line,
          0.7,
        );
        g.fillRect(archiveX + 18, rowY, 2, 54);
        this.drawGlyph(
          g,
          card.icon || "star",
          archiveX + 39,
          rowY + 26,
          15,
          COLORS.bronze,
        );
        this.addText(archiveX + 55, rowY + 7, card.title || "", {
          fontFamily: TEXT_STYLE.serif,
          fontSize: "12px",
          color: "#f0e8d7",
          wordWrap: { width: archiveWidth - 106, useAdvancedWrap: true },
          maxLines: 1,
        });
        this.addText(archiveX + 55, rowY + 28, card.meta || card.body || "", {
          fontSize: "10px",
          color: "#c8b99e",
          wordWrap: { width: archiveWidth - 106, useAdvancedWrap: true },
          maxLines: 1,
        });
      });
    } else {
      this.addText(
        archiveX + 20,
        content.y + 526,
        "切换兄弟契或星命合击，翻阅已录阵谱。",
        {
          fontSize: "11px",
          color: "#c0b39b",
          lineSpacing: 4,
          wordWrap: { width: archiveWidth - 40, useAdvancedWrap: true },
          maxLines: 2,
        },
      );
    }
    const rosterAction = (model.actions || []).find(
      (action) => action.id === "roster",
    );
    if (rosterAction) {
      this.drawButton(
        archiveX + 18,
        content.y + content.height - 58,
        archiveWidth - 36,
        38,
        rosterAction,
        false,
      );
    }
  }

  drawCodexDoctrineRow(x, y, width, height, card) {
    const g = this.graphics;
    const disabled = Boolean(card.disabled);
    const active = card.tone === "primary";
    g.fillStyle(COLORS.panel, disabled ? 0.62 : 0.9);
    g.fillRect(x, y, width, height);
    g.lineStyle(active ? 2 : 1, active ? COLORS.bronze : COLORS.line, disabled ? 0.28 : active ? 0.8 : 0.46);
    g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    g.fillStyle(active ? COLORS.bronze : COLORS.tealDim, active ? 0.76 : 0.34);
    g.fillRect(x, y, 3, height);
    this.addText(x + 12, y + 7, card.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "13px",
      fontStyle: "bold",
      color: disabled ? "#858a80" : "#f2ead8",
      wordWrap: { width: width - 82, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(x + 12, y + 29, card.body || "", {
      fontSize: "10px",
      color: disabled ? "#777d73" : "#c8b99e",
      wordWrap: { width: width - 24, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(x + width - 62, y + 9, card.badge || "", {
      fontSize: "9px",
      color: active ? "#f0c994" : disabled ? "#858b81" : "#aaa08a",
      align: "right",
      wordWrap: { width: 50, useAdvancedWrap: true },
      maxLines: 1,
    });
    if (card.action && !disabled) {
      this.addHitArea(`codex-doctrine:${card.id}`, x, y, width, height, card);
    }
  }

  drawSettings(model) {
    const frame = this.getFrame();
    this.drawHeader(model, frame);
    this.drawNavigation(model, frame);
    const content = frame.content;
    const compact = frame.compact || this.width < 1040;
    const detail = model.detail || {};
    const cards = model.cards || [];
    const actions = model.actions || [];
    if (compact) {
      this.drawSectionHeading(
        content.x,
        content.y,
        model.hero?.eyebrow,
        model.hero?.title,
        model.hero?.subtitle,
        content.width,
        true,
      );
      const actionHeight = this.drawActionGrid(
        actions,
        content.x,
        content.y + 92,
        content.width,
        2,
        true,
      );
      this.drawCardGrid(
        cards,
        content,
        content.y + 104 + actionHeight,
        model,
        { compact: true, columns: 2, minHeight: 66, maxHeight: 88 },
      );
      return;
    }

    const gap = 16;
    const leftWidth = Math.floor((content.width - gap) * 0.56);
    const rightX = content.x + leftWidth + gap;
    const rightWidth = content.width - leftWidth - gap;
    const panelHeight = Math.max(470, content.height - 82);
    const dense = panelHeight < 600;
    const g = this.graphics;
    g.fillStyle(COLORS.ink, 0.56);
    g.fillRect(content.x, content.y, leftWidth, panelHeight);
    g.fillRect(rightX, content.y, rightWidth, panelHeight);
    g.lineStyle(1, COLORS.bronzeDim, 0.48);
    g.strokeRect(content.x + 0.5, content.y + 0.5, leftWidth - 1, panelHeight - 1);
    g.strokeRect(rightX + 0.5, content.y + 0.5, rightWidth - 1, panelHeight - 1);
    g.fillStyle(COLORS.bronze, 0.82);
    g.fillRect(content.x, content.y, 3, 132);
    g.fillStyle(COLORS.teal, 0.72);
    g.fillRect(rightX, content.y, 3, 132);
    this.drawPanelOrnaments(
      content.x,
      content.y,
      leftWidth,
      panelHeight,
      { alpha: 0.18, corners: 2 },
    );
    this.drawPanelOrnaments(
      rightX,
      content.y,
      rightWidth,
      panelHeight,
      { alpha: 0.18, corners: 2 },
    );

    const findCard = (id) => cards.find((card) => card.id === id);
    const findAction = (id) => actions.find((action) => action.id === id);
    const soundCard = findCard("sound");
    const motionCard = findCard("motion");
    const contrastCard = findCard("contrast");
    const autoBattleCard = findCard("auto-battle");
    const autoArenaCard = findCard("auto-arena");
    const speedCard = findCard("speed");
    const uiScaleCards = cards.filter((card) =>
      String(card.id).startsWith("ui-scale-"),
    );
    const textSpeedCards = cards.filter((card) =>
      String(card.id).startsWith("text-speed-"),
    );

    this.addText(content.x + 22, content.y + 18, model.hero?.eyebrow || "卷宗与偏好", {
      fontSize: "10px",
      letterSpacing: 1.4,
      color: "#d8b970",
      wordWrap: { width: leftWidth - 44, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(content.x + 22, content.y + 41, "声音与画面", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "28px",
      fontStyle: "bold",
      color: "#f2ead8",
      wordWrap: { width: leftWidth - 44, useAdvancedWrap: true },
      maxLines: 1,
    });
    if (soundCard) {
      this.drawSettingToggleRow(
        content.x + 20,
        content.y + 82,
        leftWidth - 40,
        52,
        soundCard,
        "声音总开关",
        "统一控制配乐与战斗音效，精调见右下音量控制",
      );
    }
    this.addText(content.x + 22, content.y + 158, "动态与显示", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "16px",
      color: "#f2ead8",
    });
    const toggleGap = 10;
    const toggleWidth = (leftWidth - 50) / 2;
    if (motionCard) {
      this.drawSettingToggleTile(
        content.x + 20,
        content.y + 186,
        toggleWidth,
        76,
        motionCard,
      );
    }
    if (contrastCard) {
      this.drawSettingToggleTile(
        content.x + 30 + toggleWidth,
        content.y + 186,
        toggleWidth,
        76,
        contrastCard,
      );
    }
    this.addText(content.x + 22, content.y + 286, "界面字号", {
      fontSize: "10px",
      color: "#c0b39b",
    });
    const scaleY = content.y + 306;
    const scaleGap = 6;
    const scaleWidth =
      (leftWidth - 40 - scaleGap * Math.max(0, uiScaleCards.length - 1)) /
      Math.max(1, uiScaleCards.length);
    uiScaleCards.forEach((card, index) => {
      this.drawTab(
        content.x + 20 + index * (scaleWidth + scaleGap),
        scaleY,
        scaleWidth,
        32,
        {
          id: card.id,
          label: String(card.title).replace("界面字号 · ", ""),
          action: card.action,
          data: card.data,
          active: card.pressed || card.tone === "primary",
        },
        false,
      );
    });
    this.addText(content.x + 22, content.y + 361, "剧情文字节奏", {
      fontSize: "10px",
      color: "#c0b39b",
    });
    const textY = content.y + 381;
    const textGap = 6;
    const textWidth =
      (leftWidth - 40 - textGap * Math.max(0, textSpeedCards.length - 1)) /
      Math.max(1, textSpeedCards.length);
    textSpeedCards.forEach((card, index) => {
      this.drawTab(
        content.x + 20 + index * (textWidth + textGap),
        textY,
        textWidth,
        32,
        {
          id: card.id,
          label: String(card.title).replace("文字节奏 · ", ""),
          action: card.action,
          data: card.data,
          active: card.pressed || card.tone === "primary",
        },
        false,
      );
    });
    this.addText(
      content.x + 22,
      content.y + panelHeight - 48,
      model.hero?.body || "",
      {
        fontSize: "10px",
        color: "#aaa08a",
        lineSpacing: 4,
        wordWrap: { width: leftWidth - 44, useAdvancedWrap: true },
        maxLines: 2,
      },
    );

    this.addText(rightX + 20, content.y + 18, "战阵偏好", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "22px",
      fontStyle: "bold",
      color: "#f2ead8",
    });
    this.addText(rightX + 20, content.y + 49, "自动战法与演武续阵", {
      fontSize: "10px",
      color: "#b9ac94",
      wordWrap: { width: rightWidth - 40, useAdvancedWrap: true },
      maxLines: 1,
    });
    const toggleY = content.y + (dense ? 64 : 78);
    const toggleHeight = dense ? 68 : 78;
    if (autoBattleCard) {
      this.drawSettingToggleTile(
        rightX + 18,
        toggleY,
        (rightWidth - 44) / 2,
        toggleHeight,
        autoBattleCard,
      );
    }
    if (autoArenaCard) {
      this.drawSettingToggleTile(
        rightX + 26 + (rightWidth - 44) / 2,
        toggleY,
        (rightWidth - 44) / 2,
        toggleHeight,
        autoArenaCard,
      );
    }
    const speedY = content.y + (dense ? 144 : 172);
    if (speedCard) {
      this.drawSettingSpeedRow(
        rightX + 18,
        speedY,
        rightWidth - 36,
        dense ? 48 : 54,
        speedCard,
      );
    }
    const tacticLabelY = content.y + (dense ? 204 : 244);
    this.addText(rightX + 20, tacticLabelY, "自动战斗战法", {
      fontSize: "10px",
      color: "#c0b39b",
    });
    const tactics = detail.autoTactics || [];
    const tacticGap = 5;
    const tacticWidth =
      (rightWidth - 36 - tacticGap * Math.max(0, tactics.length - 1)) /
      Math.max(1, tactics.length);
    tactics.forEach((tactic, index) => {
      this.drawTab(
        rightX + 18 + index * (tacticWidth + tacticGap),
        tacticLabelY + 20,
        tacticWidth,
        dense ? 28 : 30,
        {
          id: tactic.id,
          label: tactic.name,
          action: "auto-tactic",
          data: { tactic: tactic.id },
          active: tactic.active,
        },
        false,
      );
    });
    const dividerY = content.y + (dense ? 260 : 315);
    g.lineStyle(1, COLORS.line, 0.48);
    g.lineBetween(
      rightX + 18,
      dividerY,
      rightX + rightWidth - 18,
      dividerY,
    );
    const saveHeadingY = dividerY + (dense ? 14 : 16);
    this.addText(rightX + 20, saveHeadingY, "战卷存档", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "16px",
      color: "#f2ead8",
    });
    const saveActions = actions.filter((action) =>
      ["save", "export", "back", "delete"].includes(action.id),
    );
    this.drawActionGrid(
      saveActions,
      rightX + 18,
      saveHeadingY + (dense ? 26 : 29),
      rightWidth - 36,
      2,
      dense,
    );
    const saveStatusY = saveHeadingY + (dense ? 120 : 159);
    g.fillStyle(COLORS.panel, 0.7);
    g.fillRect(rightX + 18, saveStatusY, rightWidth - 36, dense ? 64 : 76);
    g.lineStyle(1, COLORS.line, 0.46);
    g.strokeRect(
      rightX + 18.5,
      saveStatusY + 0.5,
      rightWidth - 37,
      (dense ? 64 : 76) - 1,
    );
    this.addText(rightX + 30, saveStatusY + 12, "存档状态", {
      fontSize: "10px",
      color: "#aaa08a",
    });
    this.addText(rightX + 30, saveStatusY + 32, detail.save?.lastSavedAt ? "最近修改已自动保存" : "尚未写入本地存档", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "12px",
      color: "#d8b970",
      wordWrap: { width: rightWidth - 60, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(rightX + 30, saveStatusY + (dense ? 49 : 55), "导出文件可用于备份与跨设备迁移。", {
      fontSize: "10px",
      color: "#b9ac94",
      wordWrap: { width: rightWidth - 60, useAdvancedWrap: true },
      maxLines: 1,
    });
    const backAction = findAction("back");
    if (backAction) {
      this.drawButton(
        content.x + leftWidth - 150,
        content.y + 18,
        128,
        34,
        backAction,
        true,
      );
    }
  }

  drawSettingToggleRow(x, y, width, height, card, title, body) {
    const g = this.graphics;
    g.fillStyle(COLORS.panel, 0.88);
    g.fillRect(x, y, width, height);
    g.lineStyle(1, COLORS.line, 0.5);
    g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    this.addText(x + 14, y + 8, title, {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "13px",
      color: "#f0e8d7",
      wordWrap: { width: width - 94, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(x + 14, y + 28, body, {
      fontSize: "10px",
      color: "#aaa08a",
      wordWrap: { width: width - 94, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.drawSettingSwitch(
      x + width - 66,
      y + height / 2 - 12,
      Boolean(card?.pressed || card?.tone === "primary"),
    );
    if (card?.action) {
      this.addHitArea(`setting-toggle:${card.id}`, x, y, width, height, card);
    }
  }

  drawSettingToggleTile(x, y, width, height, card) {
    const g = this.graphics;
    const active = Boolean(card.pressed || card.tone === "primary");
    g.fillStyle(COLORS.panel, 0.88);
    g.fillRect(x, y, width, height);
    g.lineStyle(active ? 2 : 1, active ? COLORS.teal : COLORS.line, active ? 0.74 : 0.48);
    g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    this.drawGlyph(
      g,
      card.icon || "settings",
      x + 22,
      y + 24,
      15,
      active ? COLORS.teal : COLORS.paperMuted,
    );
    this.addText(x + 40, y + 12, card.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "14px",
      color: "#f0e8d7",
      wordWrap: { width: width - 52, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(x + 12, y + 40, card.body || "", {
      fontSize: "10px",
      color: "#aaa08a",
      lineSpacing: 4,
      wordWrap: { width: width - 24, useAdvancedWrap: true },
      maxLines: 2,
    });
    this.drawSettingSwitch(x + width - 54, y + height - 23, active);
    if (card.action) {
      this.addHitArea(`setting-tile:${card.id}`, x, y, width, height, card);
    }
  }

  drawSettingSwitch(x, y, active) {
    const g = this.graphics;
    g.fillStyle(active ? COLORS.tealDim : COLORS.panelRaised, active ? 0.94 : 0.82);
    g.fillRoundedRect(x, y, 42, 22, 11);
    g.lineStyle(1, active ? COLORS.teal : COLORS.line, 0.72);
    g.strokeRoundedRect(x + 0.5, y + 0.5, 41, 21, 11);
    g.fillStyle(active ? COLORS.teal : COLORS.faint, 0.96);
    g.fillCircle(x + (active ? 29 : 13), y + 11, 7);
  }

  drawSettingSpeedRow(x, y, width, height, card) {
    const g = this.graphics;
    const match = String(card?.title || "").match(/(\d+(?:\.\d+)?)x/);
    const current = match ? Number(match[1]) : 1;
    const speeds = [1, 2, 4];
    g.fillStyle(COLORS.panel, 0.86);
    g.fillRect(x, y, width, height);
    g.lineStyle(1, COLORS.line, 0.5);
    g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    this.drawGlyph(g, "gauge", x + 20, y + height / 2, 15, COLORS.bronze);
    this.addText(x + 38, y + 8, "战斗速度", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: "13px",
      color: "#f0e8d7",
      wordWrap: { width: width - 210, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(x + 38, y + 29, card?.body || "影响结算与自动出招节奏", {
      fontSize: "10px",
      color: "#aaa08a",
      wordWrap: { width: width - 210, useAdvancedWrap: true },
      maxLines: 1,
    });
    const segmentWidth = 46;
    const segmentGap = 4;
    const startX = x + width - (segmentWidth * speeds.length + segmentGap * (speeds.length - 1)) - 12;
    speeds.forEach((speed, index) => {
      const active = speed === current;
      const sx = startX + index * (segmentWidth + segmentGap);
      g.fillStyle(active ? COLORS.tealDim : COLORS.panelRaised, active ? 0.92 : 0.78);
      g.fillRoundedRect(sx, y + 14, segmentWidth, 26, 3);
      g.lineStyle(1, active ? COLORS.teal : COLORS.line, active ? 0.78 : 0.46);
      g.strokeRoundedRect(sx + 0.5, y + 14.5, segmentWidth - 1, 25, 3);
      this.addCenteredText(
        sx + segmentWidth / 2,
        y + 27,
        `${speed}x`,
        {
          fontSize: "10px",
          color: active ? "#f0e8d7" : "#8f856f",
        },
        segmentWidth - 8,
      );
    });
    if (card?.action) {
      this.addHitArea(`setting-speed:${card.id}`, x, y, width, height, card);
    }
  }

  drawDashboard(model) {
    const frame = this.getFrame();
    this.drawHeader(model, frame);
    this.drawNavigation(model, frame);
    const content = frame.content;
    let y = content.y;

    const heroHeight = frame.compact ? 94 : 104;
    this.drawHeroBanner(model, content.x, y, content.width, heroHeight, frame.compact);
    y += heroHeight + (frame.compact ? 10 : 14);

    const actionHeight = this.drawActionBar(
      (model.actions || []).slice(0, 4),
      content,
      y,
      frame.compact,
    );
    if (actionHeight) y += actionHeight + (frame.compact ? 10 : 14);

    if (model.tabs?.length) {
      const tabHeight = frame.compact ? 30 : 32;
      const gap = 6;
      const widths = model.tabs.map((tab) =>
        clamp(30 + String(tab.label).length * 11, 58, 132),
      );
      const total = widths.reduce((sum, width) => sum + width, 0) + gap * (widths.length - 1);
      const scale = total > content.width ? content.width / total : 1;
      let x = content.x;
      model.tabs.forEach((tab, index) => {
        const width = widths[index] * scale;
        this.drawTab(x, y, width, tabHeight, tab, frame.compact);
        x += width + gap * scale;
      });
      y += tabHeight + (frame.compact ? 8 : 12);
    }

    this.drawCardGrid(model.cards || [], content, y, model, {
      compact: frame.compact,
    });
  }

  drawActionBar(actions, content, y, compact) {
    if (!actions.length) return 0;
    const columns =
      compact && this.width < 620 && actions.length > 2
        ? 2
        : actions.length;
    const rows = Math.ceil(actions.length / columns);
    const gap = compact ? 7 : 9;
    const buttonHeight = compact ? 38 : 42;
    for (let row = 0; row < rows; row += 1) {
      const rowActions = actions.slice(row * columns, row * columns + columns);
      const rowWidth =
        (content.width - gap * (rowActions.length - 1)) /
        Math.max(1, rowActions.length);
      rowActions.forEach((action, column) => {
        this.drawButton(
          content.x + column * (rowWidth + gap),
          y + row * (buttonHeight + gap),
          rowWidth,
          buttonHeight,
          action,
          compact,
        );
      });
    }
    return rows * buttonHeight + (rows - 1) * gap;
  }

  drawHeader(model, frame) {
    const g = this.graphics;
    g.fillStyle(COLORS.ink, 0.94);
    g.fillRect(0, 0, this.width, frame.headerHeight);
    g.lineStyle(1, COLORS.line, 0.65);
    g.lineBetween(0, frame.headerHeight - 0.5, this.width, frame.headerHeight - 0.5);
    g.fillStyle(COLORS.bronze, 0.92);
    g.fillRect(0, 0, frame.compact ? 3 : 4, frame.headerHeight);

    const titleX = model.header?.back
      ? frame.compact
        ? 54
        : 64
      : frame.compact
        ? 14
        : 20;
    const stats = (model.header?.stats || []).slice(
      0,
      frame.compact ? (this.width >= 700 ? 4 : 2) : 4,
    );
    const statWidth =
      frame.compact ? (this.width >= 700 ? 68 : 54) : 76;
    const statGap = 5;
    const statsWidth =
      stats.length * statWidth + Math.max(0, stats.length - 1) * statGap;
    const headerTextWidth = Math.max(
      86,
      this.width - titleX - (frame.compact ? 10 : 22) - statsWidth - 12,
    );
    this.addText(titleX, frame.compact ? 8 : 10, model.brand || "星命水浒", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: frame.compact ? "17px" : "21px",
      fontStyle: "bold",
      color: "#f0e8d7",
    });
    if (this.toast) {
      this.drawHeaderToast(titleX, frame.compact ? 35 : 42, headerTextWidth);
    } else {
      this.addText(
        titleX,
        frame.compact ? 35 : 42,
        model.header?.title || model.title || "",
        {
          fontSize: frame.compact ? "9px" : "10px",
          color: "#9c927d",
          wordWrap: { width: headerTextWidth, useAdvancedWrap: true },
          maxLines: 1,
        },
      );
    }

    let x = this.width - (frame.compact ? 10 : 22);
    for (const stat of [...stats].reverse()) {
      x -= statWidth;
      this.drawHeaderStat(
        x,
        7,
        statWidth,
        frame.headerHeight - 14,
        stat,
        frame.compact,
      );
      x -= statGap;
    }

    if (model.header?.back) {
      this.drawIconButton(8, 10, 36, "back", model.header.back, frame.compact);
    }
  }

  drawHeaderStat(x, y, width, height, stat, compact) {
    const g = this.graphics;
    g.fillStyle(COLORS.panel, 0.86);
    g.fillRoundedRect(x, y, width, height, 3);
    g.lineStyle(1, COLORS.line, 0.5);
    g.strokeRoundedRect(x + 0.5, y + 0.5, width - 1, height - 1, 3);
    this.addText(x + 7, y + (compact ? 5 : 7), stat.label || "", {
      fontSize: compact ? "8px" : "9px",
      color: "#8f856f",
    });
    this.addText(x + 7, y + (compact ? 19 : 23), String(stat.value ?? ""), {
      fontFamily: TEXT_STYLE.serif,
      fontSize: compact ? "12px" : "14px",
      color: "#d7bc7d",
    });
  }

  drawNavigation(model, frame) {
    const nav = model.nav || [];
    if (!nav.length) return;
    const g = this.graphics;
    if (frame.compact) {
      const y = this.height - frame.navHeight;
      g.fillStyle(COLORS.ink, 0.97);
      g.fillRect(0, y, this.width, frame.navHeight);
      g.lineStyle(1, COLORS.line, 0.62);
      g.lineBetween(0, y + 0.5, this.width, y + 0.5);
      const width = this.width / nav.length;
      nav.forEach((item, index) => {
        this.drawNavItem(index * width, y, width, frame.navHeight, item, true);
      });
      return;
    }
    g.fillStyle(COLORS.ink, 0.84);
    g.fillRect(0, frame.headerHeight, frame.navWidth, this.height - frame.headerHeight);
    g.lineStyle(1, COLORS.line, 0.45);
    g.lineBetween(
      frame.navWidth - 0.5,
      frame.headerHeight,
      frame.navWidth - 0.5,
      this.height,
    );
    const itemHeight = 68;
    nav.forEach((item, index) => {
      this.drawNavItem(
        8,
        frame.headerHeight + 16 + index * itemHeight,
        frame.navWidth - 16,
        itemHeight - 6,
        item,
        false,
      );
    });
  }

  drawNavItem(x, y, width, height, item, compact) {
    if (item.active) {
      this.graphics.fillStyle(COLORS.tealDim, 0.26);
      this.graphics.fillRoundedRect(x + 3, y + 3, width - 6, height - 6, 4);
      this.graphics.fillStyle(COLORS.bronze, 0.82);
      this.graphics.fillRect(x + 3, y + 8, 2, height - 16);
    }
    this.drawGlyph(
      this.graphics,
      item.icon || "map",
      x + width / 2,
      y + (compact ? 20 : 24),
      compact ? 17 : 20,
      item.active ? COLORS.bronze : COLORS.muted,
    );
    this.addCenteredText(
      x + width / 2,
      y + (compact ? 39 : 46),
      item.label,
      {
        fontSize: compact ? "9px" : "10px",
        color: item.active ? "#d7bc7d" : "#8f856f",
      },
      width - 8,
    );
    this.addHitArea(`nav:${item.id}`, x + 2, y + 2, width - 4, height - 4, item);
  }

  drawHeroBanner(model, x, y, width, height, compact, options = {}) {
    const g = this.graphics;
    g.fillStyle(COLORS.ink, 0.9);
    g.fillRoundedRect(x, y, width, height, 6);
    g.lineStyle(1, COLORS.line, 0.72);
    g.strokeRoundedRect(x + 0.5, y + 0.5, width - 1, height - 1, 6);
    g.fillStyle(COLORS.bronzeDim, 0.72);
    g.fillRect(x, y + 1, 3, height - 2);

    let textX = x + 18;
    if (model.hero?.image) {
      const imageWidth = compact ? 62 : 88;
      g.fillStyle(COLORS.panelRaised, 0.92);
      g.fillRoundedRect(x + 9, y + 9, imageWidth, height - 18, 4);
      this.addImage(
        x + 9 + imageWidth / 2,
        y + height / 2,
        model.hero.image,
        imageWidth - 4,
        height - 22,
      );
      textX = x + imageWidth + 20;
    }
    const textWidth = width - (textX - x) - 16;
    this.addText(textX, y + (compact ? 11 : 13), model.hero?.eyebrow || "", {
      fontSize: compact ? "9px" : "10px",
      color: "#8f856f",
      wordWrap: { width: textWidth, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(textX, y + (compact ? 27 : 31), model.hero?.title || model.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: compact ? (options.choice ? "18px" : "19px") : "24px",
      fontStyle: "bold",
      color: "#f0e8d7",
      wordWrap: { width: textWidth, useAdvancedWrap: true },
      maxLines: compact && options.choice ? 2 : 1,
    });
    this.addText(textX, y + (compact ? (options.choice ? 78 : 55) : 63), model.hero?.subtitle || "", {
      fontSize: compact ? "9px" : "11px",
      color: "#9c927d",
      wordWrap: { width: textWidth, useAdvancedWrap: true },
      maxLines: compact ? 1 : 2,
    });
  }

  drawButton(x, y, width, height, action, compact) {
    const disabled = Boolean(action.disabled);
    const tone = TONE_COLORS[action.tone] || COLORS.panelRaised;
    const g = this.graphics;
    g.fillStyle(
      disabled ? COLORS.panelRaised : tone,
      disabled ? 0.94 : action.tone === "ghost" ? 0.9 : 0.94,
    );
    g.fillRoundedRect(x, y, width, height, 4);
    g.lineStyle(
      1,
      disabled
        ? COLORS.line
        : action.tone === "primary"
          ? COLORS.teal
          : COLORS.line,
      disabled ? 0.55 : 0.78,
    );
    g.strokeRoundedRect(x + 0.5, y + 0.5, width - 1, height - 1, 4);
    const fontSize = compact ? (this.width < 620 ? 10 : 11) : 12;
    const canShowIcon = width > 92;
    const iconSize = compact ? 13 : 15;
    const iconGap = 7;
    const labelText = this.addText(0, 0, action.label || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: `${fontSize}px`,
      color: disabled ? "#a59a84" : "#f0e8d7",
      wordWrap: {
        width: Math.max(20, width - (canShowIcon ? iconSize + iconGap + 16 : 14)),
        useAdvancedWrap: true,
      },
      maxLines: 1,
    });
    labelText.setOrigin(0, 0.5);
    const labelWidth = Math.min(
      labelText.width,
      width - (canShowIcon ? iconSize + iconGap + 16 : 14),
    );
    const groupWidth = canShowIcon
      ? iconSize + iconGap + labelWidth
      : labelWidth;
    const groupX = x + Math.max(7, (width - groupWidth) / 2);
    if (canShowIcon) {
      this.drawGlyph(
        g,
        disabled ? "lock" : action.icon || "chevron",
        groupX + iconSize / 2,
        y + height / 2,
        iconSize,
        disabled
          ? COLORS.bronzeDim
          : action.tone === "primary"
            ? COLORS.paper
            : COLORS.bronze,
      );
    }
    this.positionText(
      labelText,
      groupX + (canShowIcon ? iconSize + iconGap : 0),
      y + height / 2,
      0,
      0.5,
    );
    if (!disabled) this.addHitArea(`action:${action.id || action.label}`, x, y, width, height, action);
  }

  drawTab(x, y, width, height, tab, compact) {
    this.graphics.fillStyle(tab.active ? COLORS.tealDim : COLORS.panelRaised, tab.active ? 0.86 : 0.74);
    this.graphics.fillRoundedRect(x, y, width, height, 3);
    this.graphics.lineStyle(1, tab.active ? COLORS.teal : COLORS.line, 0.66);
    this.graphics.strokeRoundedRect(x + 0.5, y + 0.5, width - 1, height - 1, 3);
    this.addCenteredText(
      x + width / 2,
      y + height / 2,
      tab.label,
      {
        fontSize: compact ? "9px" : "10px",
        color: tab.active ? "#f5ecdc" : "#b6aa91",
      },
      width - 10,
    );
    this.addHitArea(`tab:${tab.id || tab.label}`, x, y, width, height, tab);
  }

  drawCard(x, y, width, height, card, compact) {
    const g = this.graphics;
    const tone =
      card.tone === "danger"
        ? COLORS.cinnabar
        : card.tone === "primary"
          ? COLORS.teal
          : COLORS.line;
    g.fillStyle(COLORS.panel, 0.98);
    g.fillRoundedRect(x, y, width, height, 5);
    g.lineStyle(1, tone, card.disabled ? 0.25 : 0.64);
    g.strokeRoundedRect(x + 0.5, y + 0.5, width - 1, height - 1, 5);
    g.fillStyle(tone, card.disabled ? 0.25 : 0.82);
    g.fillRect(x + 1, y + 7, 2, Math.max(8, height - 14));
    this.drawCornerBrackets(
      x,
      y,
      width,
      height,
      tone,
      card.disabled ? 0.2 : 0.36,
    );

    const leadingWidth = compact ? 48 : card.image ? 106 : 86;
    if (card.image) {
      const imageWidth = compact ? 40 : 82;
      const imageHeight = Math.max(32, height - (compact ? 12 : 16));
      g.fillStyle(COLORS.panelRaised, 0.9);
      g.fillRoundedRect(
        x + (compact ? 7 : 10),
        y + (height - imageHeight) / 2,
        imageWidth,
        imageHeight,
        4,
      );
      this.addImage(
        x + (compact ? 7 : 10) + imageWidth / 2,
        y + height / 2,
        card.image,
        imageWidth - 4,
        imageHeight - 4,
      );
    } else {
      const wellWidth = compact ? 34 : 44;
      const wellHeight = Math.max(30, height - (compact ? 16 : 20));
      g.fillStyle(COLORS.panelRaised, 0.88);
      g.fillRoundedRect(
        x + (compact ? 8 : 12),
        y + (height - wellHeight) / 2,
        wellWidth,
        wellHeight,
        4,
      );
      this.drawGlyph(
        g,
        card.icon || "scroll",
        x + (compact ? 8 : 12) + wellWidth / 2,
        y + height / 2,
        compact ? 18 : 22,
        card.disabled ? COLORS.faint : COLORS.bronze,
      );
    }
    const contentX = x + leadingWidth;
    const contentWidth = Math.max(34, width - leadingWidth - (compact ? 8 : 14));
    const titleColor = card.disabled ? "#858a80" : "#f0e8d7";
    const metaColor = card.disabled ? "#71776d" : "#a79b84";
    const bodyColor = card.disabled ? "#696f66" : "#c5b89e";
    this.addText(contentX, y + (compact ? 8 : 10), card.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: compact ? "12px" : "15px",
      fontStyle: "bold",
      color: titleColor,
      wordWrap: { width: contentWidth, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(contentX, y + (compact ? 28 : 33), card.meta || "", {
      fontSize: compact ? "9px" : "11px",
      color: metaColor,
      wordWrap: { width: contentWidth, useAdvancedWrap: true },
      maxLines: 1,
    });
    const showBody = height >= (compact ? 78 : 92) && Boolean(card.body);
    if (showBody) {
      this.addText(contentX, y + (compact ? 46 : 55), card.body || "", {
        fontSize: compact ? "9px" : "11px",
        color: bodyColor,
        lineSpacing: compact ? 3 : 5,
        wordWrap: { width: contentWidth, useAdvancedWrap: true },
        maxLines: height >= (compact ? 90 : 106) ? 2 : 1,
      });
    }
    if (card.progress !== undefined) {
      const barY = y + height - 10;
      g.fillStyle(COLORS.line, 0.7);
      g.fillRoundedRect(contentX, barY, contentWidth, 4, 2);
      g.fillStyle(tone, 0.9);
      g.fillRoundedRect(
        contentX,
        barY,
        contentWidth * clamp(card.progress, 0, 1),
        4,
        2,
      );
    } else if (card.badge) {
      const badge = String(card.badge);
      const badgeWidth = clamp(12 + badge.length * (compact ? 8 : 9), 30, 78);
      const badgeHeight = compact ? 17 : 18;
      const badgeX = x + width - badgeWidth - (compact ? 7 : 10);
      const badgeY = y + height - badgeHeight - (compact ? 6 : 7);
      g.fillStyle(tone, card.disabled ? 0.16 : 0.24);
      g.fillRoundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 3);
      this.addCenteredText(
        badgeX + badgeWidth / 2,
        badgeY + badgeHeight / 2,
        badge,
        {
          fontSize: compact ? "8px" : "10px",
          color: card.disabled ? "#81877d" : "#e7d5a6",
        },
        badgeWidth - 6,
      );
    }
    if (card.action && !card.disabled) {
      this.addHitArea(`card:${card.id || card.title}`, x, y, width, height, card);
    }
  }

  drawCardGrid(cards, content, startY, model, options = {}) {
    if (!cards.length) return;
    const compact = Boolean(options.compact);
    const bottom = content.y + content.height;
    const gap = compact ? 7 : 10;
    const pagerHeight = compact ? 28 : 30;
    const columns = clamp(
      options.columns ||
        (compact ? model.compactColumns || 2 : model.columns || 2),
      1,
      Math.min(3, cards.length),
    );
    const minHeight = options.minHeight || (compact ? 64 : 88);
    const maxHeight = options.maxHeight || (compact ? 94 : 112);
    const available = Math.max(minHeight, bottom - startY);
    const rowsAtMin = Math.max(
      1,
      Math.floor((available + gap) / (minHeight + gap)),
    );
    let capacity = Math.max(1, rowsAtMin * columns);
    let pageCount = Math.ceil(cards.length / capacity);
    if (pageCount > 1) {
      const usable = Math.max(
        minHeight,
        available - pagerHeight - gap,
      );
      capacity =
        Math.max(
          1,
          Math.floor((usable + gap) / (minHeight + gap)),
        ) * columns;
      pageCount = Math.ceil(cards.length / capacity);
    }
    const page = clamp(this.cardPage, 0, Math.max(0, pageCount - 1));
    this.cardPage = page;
    const visible = cards.slice(page * capacity, page * capacity + capacity);
    const rows = Math.max(1, Math.ceil(visible.length / columns));
    const hasPager = pageCount > 1;
    const cardAreaHeight =
      available - (hasPager ? pagerHeight + gap : 0);
    const cardHeight = clamp(
      (cardAreaHeight - gap * (rows - 1)) / rows,
      minHeight,
      maxHeight,
    );
    const cardWidth = (content.width - gap * (columns - 1)) / columns;
    visible.forEach((card, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      this.drawCard(
        content.x + column * (cardWidth + gap),
        startY + row * (cardHeight + gap),
        cardWidth,
        cardHeight,
        card,
        compact,
      );
    });
    if (hasPager) {
      this.drawCardPager(
        content.x,
        bottom - pagerHeight,
        content.width,
        pagerHeight,
        page,
        pageCount,
        compact,
      );
    }
  }

  drawCardPager(x, y, width, height, page, pageCount, compact) {
    const g = this.graphics;
    const buttonWidth = compact ? 72 : 92;
    const buttonHeight = compact ? 26 : 28;
    g.fillStyle(COLORS.ink, 0.82);
    g.fillRoundedRect(x, y, width, height, 4);
    g.lineStyle(1, COLORS.line, 0.5);
    g.strokeRoundedRect(x + 0.5, y + 0.5, width - 1, height - 1, 4);
    this.addCenteredText(
      x + width / 2,
      y + height / 2,
      `${page + 1} / ${pageCount}`,
      {
        fontSize: compact ? "9px" : "10px",
        color: "#b9ab90",
      },
      70,
    );
    const buttonY = y + (height - buttonHeight) / 2;
    this.drawButton(
      x + 3,
      buttonY,
      buttonWidth,
      buttonHeight,
      {
        id: "card-page-prev",
        label: "上一页",
        action: "__card-page-prev",
        icon: "back",
        tone: "ghost",
        disabled: page <= 0,
        onPress: () => {
          this.cardPage = Math.max(0, page - 1);
          this.render();
        },
      },
      compact,
    );
    this.drawButton(
      x + width - buttonWidth - 3,
      buttonY,
      buttonWidth,
      buttonHeight,
      {
        id: "card-page-next",
        label: "下一页",
        action: "__card-page-next",
        icon: "chevron",
        tone: "ghost",
        disabled: page >= pageCount - 1,
        onPress: () => {
          this.cardPage = Math.min(pageCount - 1, page + 1);
          this.render();
        },
      },
      compact,
    );
  }

  drawTitle(model) {
    const compact = this.width < 960;
    const x = compact
      ? clamp(this.width * 0.08, 24, 64)
      : 88;
    const contentWidth = Math.min(
      compact ? this.width - x * 2 : 510,
      this.width - x * 2,
    );
    const y = clamp(
      compact ? this.height * 0.34 : this.height * 0.18,
      88,
      Math.max(88, this.height - 380),
    );
    const titleSize = compact
      ? clamp(this.width * 0.062, 36, 46)
      : clamp(this.height * 0.075, 58, 76);
    const subtitleSize = compact ? 17 : 22;
    const eyebrowSize = compact ? 9 : 11;

    const g = this.graphics;
    this.addImage(
      x + (compact ? 18 : 18),
      y - (compact ? 24 : 32),
      UI_ASSETS.corner,
      compact ? 72 : 100,
      compact ? 72 : 100,
      {
        alpha: 0.2,
        blendMode: "SCREEN",
        decorative: true,
      },
    );

    this.addText(x + 28, y, model.hero?.eyebrow || "北宋末年 · 梁山群像", {
      fontSize: `${eyebrowSize}px`,
      letterSpacing: compact ? 1.2 : 2.2,
      color: "#d8b970",
    });
    const titleText = this.addText(
      x + 26,
      y + (compact ? 18 : 25),
      model.hero?.title || "星命水浒",
      {
        fontFamily: TEXT_STYLE.serif,
        fontSize: `${titleSize}px`,
        fontStyle: "bold",
        color: "#f2ead8",
        stroke: "#050807",
        strokeThickness: compact ? 2 : 3,
      },
    );
    const titleBounds = titleText.getBounds();
    const titleBottom =
      titleBounds.y + Math.max(titleBounds.height, titleSize * 1.4);
    const subtitleY = titleBottom + (compact ? 12 : 16);
    const subtitleText = this.addText(x + 30, subtitleY, model.hero?.subtitle || "风雪山神庙", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: `${subtitleSize}px`,
      color: "#c6b796",
    });
    const subtitleBottom =
      subtitleY + Math.max(subtitleText.getBounds().height, subtitleSize * 1.35);
    const dividerY = subtitleBottom + (compact ? 14 : 18);
    g.fillStyle(COLORS.bronze, 0.9);
    g.fillRect(x - 1, y + 1, 2, dividerY - y);
    g.lineStyle(1, COLORS.bronzeDim, 0.6);
    g.lineBetween(x + 14, y + 5, x + 14, dividerY);
    g.lineStyle(1, COLORS.bronzeDim, 0.72);
    g.lineBetween(x + 30, dividerY, x + 30 + Math.min(280, contentWidth - 30), dividerY);
    g.fillStyle(COLORS.cinnabar, 0.9);
    g.fillRect(x + 30, dividerY - 2, compact ? 22 : 30, 4);

    const bodyY = dividerY + (compact ? 15 : 20);
    const bodyText = this.addText(x + 30, bodyY, model.hero?.body || "", {
      fontSize: compact ? "10px" : "12px",
      color: "#d2c3a7",
      lineSpacing: compact ? 4 : 6,
      wordWrap: {
        width: Math.min(contentWidth - 30, compact ? 500 : contentWidth - 30),
        useAdvancedWrap: true,
      },
      maxLines: 2,
    });

    let cursorY = bodyText.getBounds().bottom + (compact ? 22 : 28);
    const tabs = model.tabs || [];
    if (tabs.length) {
      const tabGap = 7;
      const tabHeight = 30;
      const tabWidth = Math.min(
        132,
        (contentWidth - 30 - tabGap * (tabs.length - 1)) / tabs.length,
      );
      tabs.forEach((tab, index) => {
        const tabX = x + 30 + index * (tabWidth + tabGap);
        g.fillStyle(tab.active ? COLORS.cinnabar : COLORS.ink, tab.active ? 0.82 : 0.5);
        g.fillRect(tabX, cursorY, tabWidth, tabHeight);
        g.lineStyle(1, tab.active ? COLORS.bronze : COLORS.line, tab.active ? 0.8 : 0.5);
        g.strokeRect(tabX + 0.5, cursorY + 0.5, tabWidth - 1, tabHeight - 1);
        this.addCenteredText(
          tabX + tabWidth / 2,
          cursorY + tabHeight / 2,
          tab.label,
          {
            fontFamily: TEXT_STYLE.serif,
            fontSize: compact ? "9px" : "10px",
            color: tab.active ? "#f2ead8" : "#a79c84",
          },
          tabWidth - 8,
        );
        this.addHitArea(`tab:${tab.id || tab.label}`, tabX, cursorY, tabWidth, tabHeight, tab);
      });
      cursorY += tabHeight + (compact ? 14 : 18);
    }

    const actions = (model.actions || []).slice(0, 4);
    const actionWidth = Math.min(compact ? 360 : 340, contentWidth - 30);
    actions.forEach((item, index) => {
      const height = index === 0 ? (compact ? 44 : 48) : 42;
      this.drawCinematicMenuButton(
        x + 30,
        cursorY,
        actionWidth,
        height,
        item,
        compact,
        index === 0,
      );
      cursorY += height + (compact ? 7 : 9);
    });
  }

  drawCinematicMenuButton(x, y, width, height, action, compact, featured) {
    if (!action) return;
    const g = this.graphics;
    const disabled = Boolean(action.disabled);
    const tone =
      action.tone === "primary"
        ? COLORS.cinnabar
        : action.tone === "secondary"
          ? COLORS.bronzeDim
          : COLORS.ink;
    g.fillStyle(tone, featured ? 0.86 : 0.46);
    g.fillRect(x, y, width, height);
    g.fillStyle(featured ? COLORS.bronze : COLORS.line, disabled ? 0.3 : featured ? 0.9 : 0.62);
    g.fillRect(x, y, 3, height);
    g.lineStyle(1, featured ? COLORS.bronze : COLORS.line, disabled ? 0.3 : 0.55);
    g.lineBetween(x + 12, y + height - 0.5, x + width, y + height - 0.5);
    const iconSize = compact ? 14 : 16;
    this.drawGlyph(
      g,
      disabled ? "lock" : action.icon || "chevron",
      x + 22,
      y + height / 2,
      iconSize,
      disabled ? COLORS.faint : featured ? COLORS.paper : COLORS.bronze,
    );
    const label = this.addText(0, 0, action.label || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: `${featured ? (compact ? 13 : 15) : compact ? 11 : 12}px`,
      fontStyle: featured ? "bold" : "normal",
      color: disabled ? "#6f7569" : featured ? "#fff8e9" : "#d9cdb5",
      wordWrap: { width: width - 70, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.positionText(label, x + 42, y + height / 2, 0, 0.5);
    this.addCenteredText(
      x + width - 22,
      y + height / 2,
      "›",
      {
        fontFamily: TEXT_STYLE.serif,
        fontSize: "18px",
        color: disabled ? "#555c55" : featured ? "#f2ead8" : "#8f856f",
      },
      16,
    );
    if (!disabled) {
      this.addHitArea(`action:${action.id || action.label}`, x, y, width, height, action);
    }
  }

  drawStory(model) {
    const compact = this.width < 800;
    const frame = this.getFrame();
    const dialogueHeight = compact ? 196 : 218;
    const dialogueWidth = compact ? this.width - 24 : Math.min(900, this.width - 120);
    const x = (this.width - dialogueWidth) / 2;
    const y = this.height - dialogueHeight - (compact ? frame.navHeight + 12 : 20);
    this.graphics.fillStyle(COLORS.ink, 0.94);
    this.graphics.fillRoundedRect(x, y, dialogueWidth, dialogueHeight, 6);
    this.graphics.lineStyle(1, COLORS.bronzeDim, 0.72);
    this.graphics.strokeRoundedRect(x + 0.5, y + 0.5, dialogueWidth - 1, dialogueHeight - 1, 6);
    this.drawPanelOrnaments(
      x,
      y,
      dialogueWidth,
      dialogueHeight,
      { alpha: 0.2, corners: 2, size: 92 },
    );
    if (model.hero?.image && !compact) {
      this.addImage(x + 86, y - 18, model.hero.image, 150, dialogueHeight + 42);
    }
    const textX = x + (compact ? 18 : 182);
    const textWidth = dialogueWidth - (textX - x) - 18;
    this.addText(textX, y + 18, model.hero?.eyebrow || model.header?.title || "", {
      fontSize: "9px",
      color: "#d7bc7d",
    });
    this.addText(textX, y + 40, model.hero?.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: compact ? "17px" : "20px",
      color: "#f0e8d7",
      wordWrap: { width: textWidth, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(textX, y + 70, model.hero?.body || "", {
      fontSize: compact ? "11px" : "13px",
      color: "#dfd3bb",
      lineSpacing: 6,
      wordWrap: { width: textWidth, useAdvancedWrap: true },
      maxLines: compact ? 4 : 5,
    });
    const actions = (model.actions || []).slice(0, 3);
    let actionX = x + dialogueWidth - 16;
    for (const action of [...actions].reverse()) {
      const width = clamp(34 + String(action.label).length * 12, 92, 150);
      actionX -= width;
      this.drawButton(actionX, y + dialogueHeight - 48, width, 32, action, compact);
      actionX -= 8;
    }
  }

  drawChoice(model) {
    const frame = this.getFrame();
    this.drawHeader(model, frame);
    this.drawNavigation(model, frame);
    const content = frame.content;
    const heroHeight = frame.compact ? 118 : 112;
    this.drawHeroBanner(
      model,
      content.x,
      content.y,
      content.width,
      heroHeight,
      frame.compact,
      { choice: true },
    );
    const cards = model.cards || [];
    this.drawCardGrid(cards, content, content.y + heroHeight + 12, model, {
      compact: frame.compact,
      columns: frame.compact ? 1 : Math.min(3, cards.length),
      minHeight: frame.compact ? 88 : 104,
      maxHeight: frame.compact ? 116 : 138,
    });
  }

  drawModal(modal) {
    const compact = this.width < 700;
    const width = Math.min(compact ? this.width - 28 : 520, this.width - 24);
    const actions = (modal.actions || []).slice(0, 3);
    const height = Math.min(
      this.height - 40,
      (compact ? 220 : 250) + Math.max(0, actions.length - 1) * 46,
    );
    const x = (this.width - width) / 2;
    const y = (this.height - height) / 2;
    this.graphics.fillStyle(0x020505, 0.76);
    this.graphics.fillRect(0, 0, this.width, this.height);
    this.addDismissAreas(x, y, width, height, "modal:dismiss", modal.onDismiss);
    this.graphics.fillStyle(COLORS.ink, 0.98);
    this.graphics.fillRoundedRect(x, y, width, height, 6);
    this.graphics.lineStyle(1, COLORS.bronzeDim, 0.9);
    this.graphics.strokeRoundedRect(x + 0.5, y + 0.5, width - 1, height - 1, 6);
    this.drawPanelOrnaments(x, y, width, height, {
      alpha: 0.22,
      corners: 2,
      size: 88,
    });
    this.addText(x + 22, y + 20, modal.title || "", {
      fontFamily: TEXT_STYLE.serif,
      fontSize: compact ? "20px" : "24px",
      fontStyle: "bold",
      color: "#f0e8d7",
      wordWrap: { width: width - 44, useAdvancedWrap: true },
      maxLines: 1,
    });
    this.addText(x + 22, y + 58, modal.body || "", {
      fontSize: compact ? "10px" : "11px",
      color: "#c5b89e",
      lineSpacing: 5,
      wordWrap: { width: width - 44, useAdvancedWrap: true },
      maxLines: compact ? 4 : 5,
    });
    let actionY = y + height - actions.length * 48 - 14;
    actions.forEach((action) => {
      this.drawButton(x + 20, actionY, width - 40, 38, action, compact);
      actionY += 46;
    });
  }

  showToast(message, tone = "default", duration = 2800) {
    if (!message) return;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = { message: String(message), tone };
    this.render();
    this.toastTimer = setTimeout(() => {
      this.toastTimer = null;
      this.toast = null;
      this.render();
    }, Math.max(600, Number(duration) || 2800));
  }

  toastTone(toast) {
    return toast.tone === "success"
      ? COLORS.teal
      : toast.tone === "danger"
        ? COLORS.cinnabar
        : COLORS.bronze;
  }

  drawHeaderToast(x, y, maxWidth) {
    const tone = this.toastTone(this.toast);
    this.graphics.fillStyle(tone, 0.88);
    this.graphics.fillRect(x, y + 1, 2, 10);
    this.addText(
      x + 8,
      y - 1,
      this.toast.message,
      {
        fontSize: this.width < 700 ? "9px" : "10px",
        color: "#f0e8d7",
        wordWrap: {
          width: Math.max(60, maxWidth - 8),
          useAdvancedWrap: true,
        },
        maxLines: 1,
      },
    );
  }

  drawFloatingToast(toast) {
    const compact = this.width < 700;
    const width = Math.min(compact ? this.width - 28 : 460, this.width - 28);
    const height = compact ? 34 : 38;
    const x = compact ? 14 : this.width - width - 22;
    const y = compact ? 14 : 18;
    const tone = this.toastTone(toast);
    this.graphics.fillStyle(COLORS.ink, 0.97);
    this.graphics.fillRoundedRect(x, y, width, height, 5);
    this.graphics.lineStyle(1, tone, 0.9);
    this.graphics.strokeRoundedRect(x + 0.5, y + 0.5, width - 1, height - 1, 5);
    this.graphics.fillStyle(tone, 0.92);
    this.graphics.fillRect(x + 1, y + 7, 3, height - 14);
    this.addCenteredText(
      x + width / 2,
      y + height / 2,
      toast.message,
      {
        fontSize: compact ? "9px" : "10px",
        color: "#f0e8d7",
      },
      width - 28,
    );
  }

  addDismissAreas(x, y, width, height, prefix, action) {
    if (!action) return;
    const areas = [
      [0, 0, this.width, y],
      [0, y, x, height],
      [x + width, y, this.width - x - width, height],
      [x, y + height, width, this.height - y - height],
    ];
    areas.forEach(([ax, ay, aw, ah], index) => {
      if (aw <= 0 || ah <= 0) return;
      this.addHitArea(`${prefix}:${index}`, ax, ay, aw, ah, action);
    });
  }

  drawIconButton(x, y, size, glyph, action, compact) {
    this.graphics.fillStyle(COLORS.panelRaised, 0.86);
    this.graphics.fillRoundedRect(x, y, size, size, 3);
    this.graphics.lineStyle(1, COLORS.line, 0.7);
    this.graphics.strokeRoundedRect(x + 0.5, y + 0.5, size - 1, size - 1, 3);
    this.drawGlyph(this.graphics, glyph, x + size / 2, y + size / 2, compact ? 15 : 17, COLORS.paperMuted);
    this.addHitArea(`icon:${action.id || glyph}`, x, y, size, size, action);
  }

  addText(x, y, value, style = {}) {
    const text = this.scene.add
      .text(x, y, String(value ?? ""), {
        fontFamily: TEXT_STYLE.sans,
        fontSize: "12px",
        color: "#f0e8d7",
        shadow: {
          offsetX: 0,
          offsetY: 1,
          color: "#000000",
          blur: 2,
          stroke: true,
          fill: true,
        },
        ...style,
      })
      .setResolution?.(1);
    this.uiLayer.add(text);
    const bounds = text.getBounds();
    const auditRect = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      text: String(value ?? ""),
    };
    text.__uiAuditRect = auditRect;
    this.textRects.push(auditRect);
    return text;
  }

  addCenteredText(x, y, value, style, maxWidth) {
    const text = this.scene.add
      .text(x, y, String(value ?? ""), {
        fontFamily: TEXT_STYLE.sans,
        fontSize: "12px",
        color: "#f0e8d7",
        align: "center",
        shadow: {
          offsetX: 0,
          offsetY: 1,
          color: "#000000",
          blur: 2,
          stroke: true,
          fill: true,
        },
        ...style,
        wordWrap: { width: maxWidth, useAdvancedWrap: true },
        maxLines: 1,
      })
      .setOrigin(0.5, 0.5)
      .setResolution?.(1);
    this.uiLayer.add(text);
    const bounds = text.getBounds();
    const auditRect = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      text: String(value ?? ""),
    };
    text.__uiAuditRect = auditRect;
    this.textRects.push(auditRect);
    return text;
  }

  positionText(text, x, y, originX = 0, originY = 0) {
    if (!text) return null;
    text.setOrigin(originX, originY);
    text.setPosition(x, y);
    const bounds = text.getBounds();
    const auditRect = text.__uiAuditRect;
    if (auditRect) {
      auditRect.x = bounds.x;
      auditRect.y = bounds.y;
      auditRect.width = bounds.width;
      auditRect.height = bounds.height;
    }
    return text;
  }

  addImage(x, y, url, width, height, options = {}) {
    const key = assetKey(url);
    if (this.scene.textures.exists(key)) {
      const image = this.scene.add
        .image(x, y, key)
        .setDisplaySize(width, height)
        .setOrigin(0.5, 0.5);
      if (options.alpha !== undefined) image.setAlpha(options.alpha);
      if (options.rotation !== undefined) image.setRotation(options.rotation);
      if (options.blendMode) {
        const blendMode =
          this.engine?.BlendModes?.[options.blendMode] ?? options.blendMode;
        image.setBlendMode(blendMode);
      }
      this.uiLayer.add(image);
      this.imageRects.push({
        x: x - width / 2,
        y: y - height / 2,
        width,
        height,
        url,
        decorative: Boolean(options.decorative),
      });
      return image;
    }
    this.imageRects.push({
      x: x - width / 2,
      y: y - height / 2,
      width,
      height,
      url,
      pending: true,
      decorative: Boolean(options.decorative),
    });
    return null;
  }

  addTiledImage(x, y, width, height, url, options = {}) {
    const key = assetKey(url);
    if (this.scene.textures.exists(key)) {
      const image = this.scene.add
        .tileSprite(x, y, width, height, key)
        .setOrigin(0, 0);
      if (options.alpha !== undefined) image.setAlpha(options.alpha);
      if (options.tileScale !== undefined) {
        image.setTileScale(options.tileScale, options.tileScale);
      }
      if (options.blendMode) {
        const blendMode =
          this.engine?.BlendModes?.[options.blendMode] ?? options.blendMode;
        image.setBlendMode(blendMode);
      }
      this.uiLayer.add(image);
      this.imageRects.push({
        x,
        y,
        width,
        height,
        url,
        decorative: Boolean(options.decorative),
      });
      return image;
    }
    this.imageRects.push({
      x,
      y,
      width,
      height,
      url,
      pending: true,
      decorative: Boolean(options.decorative),
    });
    return null;
  }

  addHitArea(id, x, y, width, height, action) {
    if (this.model?.modal && !String(id).startsWith("modal:")) {
      return null;
    }
    const hoverTone =
      action.tone === "primary"
        ? COLORS.teal
        : action.tone === "danger"
          ? COLORS.cinnabar
          : COLORS.bronze;
    const zone = this.scene.add
      .zone(x, y, width, height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: !action.disabled });
    zone.on("pointerover", () => {
      if (
        action.disabled ||
        String(id).startsWith("modal:dismiss") ||
        !this.hoverGraphics
      ) {
        return;
      }
      const graphics = this.hoverGraphics;
      graphics.clear();
      graphics.fillStyle(hoverTone, 0.045);
      graphics.fillRect(x, y, width, height);
      const length = clamp(Math.min(width, height) * 0.14, 6, 15);
      graphics.lineStyle(1, hoverTone, 0.92);
      graphics.lineBetween(x, y + length, x, y);
      graphics.lineBetween(x, y, x + length, y);
      graphics.lineBetween(x + width - length, y, x + width, y);
      graphics.lineBetween(x + width, y, x + width, y + length);
      graphics.lineBetween(x, y + height - length, x, y + height);
      graphics.lineBetween(x, y + height, x + length, y + height);
      graphics.lineBetween(x + width - length, y + height, x + width, y + height);
      graphics.lineBetween(x + width, y + height - length, x + width, y + height);
    });
    zone.on("pointerout", () => {
      this.hoverGraphics?.clear?.();
    });
    zone.on("pointerdown", (_pointer, _localX, _localY, event) => {
      event?.stopPropagation?.();
      if (action.disabled) return;
      if (typeof action.onPress === "function") {
        action.onPress();
        return;
      }
      this.callbacks.onAction?.(action.action, action.data || {}, action);
    });
    this.uiLayer.add(zone);
    this.hitAreas.set(id, { x, y, width, height, action: action.action || null });
    return zone;
  }

  drawGlyph(graphics, kind, x, y, size, color) {
    const half = size / 2;
    this.glyphRects.push({
      x: x - half,
      y: y - half,
      width: size,
      height: size,
      kind,
    });
    graphics.lineStyle(Math.max(1.2, size * 0.09), color, 0.9);
    graphics.fillStyle(color, 0.9);
    if (kind === "back") {
      graphics.lineBetween(x + half * 0.55, y - half, x - half * 0.45, y);
      graphics.lineBetween(x - half * 0.45, y, x + half * 0.55, y + half);
      return;
    }
    if (kind === "map") {
      graphics.strokeCircle(x, y, half * 0.82);
      graphics.lineBetween(x, y - half, x, y + half * 0.5);
      return;
    }
    if (kind === "camp" || kind === "home") {
      graphics.lineBetween(x - half, y + half * 0.7, x, y - half * 0.7);
      graphics.lineBetween(x, y - half * 0.7, x + half, y + half * 0.7);
      graphics.lineBetween(x - half * 0.7, y, x + half * 0.7, y);
      return;
    }
    if (kind === "landmark" || kind === "hall") {
      graphics.lineBetween(x - half * 0.9, y - half * 0.34, x, y - half * 0.88);
      graphics.lineBetween(x, y - half * 0.88, x + half * 0.9, y - half * 0.34);
      graphics.lineBetween(x - half * 0.72, y - half * 0.22, x + half * 0.72, y - half * 0.22);
      for (const column of [-0.58, 0, 0.58]) {
        graphics.lineBetween(
          x + half * column,
          y - half * 0.1,
          x + half * column,
          y + half * 0.62,
        );
      }
      graphics.lineBetween(x - half * 0.82, y + half * 0.76, x + half * 0.82, y + half * 0.76);
      return;
    }
    if (kind === "sparkles") {
      const drawSpark = (cx, cy, radius) => {
        graphics.lineBetween(cx, cy - radius, cx, cy + radius);
        graphics.lineBetween(cx - radius, cy, cx + radius, cy);
      };
      drawSpark(x - half * 0.2, y - half * 0.16, half * 0.58);
      drawSpark(x + half * 0.5, y - half * 0.54, half * 0.28);
      drawSpark(x + half * 0.46, y + half * 0.48, half * 0.2);
      return;
    }
    if (kind === "wheat") {
      graphics.lineBetween(x, y + half * 0.86, x, y - half * 0.8);
      for (const side of [-1, 1]) {
        for (let index = 0; index < 3; index += 1) {
          const grainY = y - half * (0.54 - index * 0.28);
          graphics.lineBetween(
            x,
            grainY + half * 0.16,
            x + half * 0.42 * side,
            grainY - half * 0.14,
          );
        }
      }
      graphics.lineBetween(x, y + half * 0.34, x - half * 0.46, y + half * 0.02);
      graphics.lineBetween(x, y + half * 0.34, x + half * 0.46, y + half * 0.02);
      return;
    }
    if (kind === "pickaxe") {
      graphics.lineBetween(
        x - half * 0.62,
        y + half * 0.78,
        x + half * 0.36,
        y - half * 0.36,
      );
      graphics.beginPath();
      graphics.arc(x + half * 0.32, y - half * 0.36, half * 0.62, Math.PI * 0.82, Math.PI * 1.78);
      graphics.strokePath();
      graphics.lineBetween(
        x + half * 0.36,
        y - half * 0.82,
        x + half * 0.84,
        y - half * 0.66,
      );
      return;
    }
    if (kind === "trees") {
      const drawTree = (cx, scale) => {
        graphics.lineBetween(cx, y + half * 0.82, cx, y - half * 0.24 * scale);
        graphics.lineBetween(cx, y - half * 0.7 * scale, cx - half * 0.46 * scale, y + half * 0.22 * scale);
        graphics.lineBetween(cx, y - half * 0.7 * scale, cx + half * 0.46 * scale, y + half * 0.22 * scale);
        graphics.lineBetween(cx, y - half * 0.34 * scale, cx - half * 0.56 * scale, y + half * 0.5 * scale);
        graphics.lineBetween(cx, y - half * 0.34 * scale, cx + half * 0.56 * scale, y + half * 0.5 * scale);
      };
      drawTree(x - half * 0.42, 0.76);
      drawTree(x + half * 0.34, 0.96);
      return;
    }
    if (kind === "fish") {
      graphics.strokeEllipse(x - half * 0.08, y, half * 1.28, half * 0.78);
      graphics.lineBetween(
        x + half * 0.5,
        y,
        x + half * 0.94,
        y - half * 0.42,
      );
      graphics.lineBetween(
        x + half * 0.5,
        y,
        x + half * 0.94,
        y + half * 0.42,
      );
      graphics.fillCircle(x - half * 0.46, y - half * 0.1, Math.max(1.2, size * 0.055));
      return;
    }
    if (kind === "factory") {
      graphics.strokeRect(x - half * 0.78, y - half * 0.22, half * 1.56, half * 0.94);
      graphics.lineBetween(x + half * 0.24, y - half * 0.22, x + half * 0.24, y - half * 0.82);
      graphics.lineBetween(x + half * 0.24, y - half * 0.82, x + half * 0.66, y - half * 0.82);
      for (const offset of [-0.38, 0.02, 0.42]) {
        graphics.strokeRect(
          x + half * offset - half * 0.1,
          y + half * 0.18,
          half * 0.2,
          half * 0.24,
          1,
        );
      }
      return;
    }
    if (kind === "flame") {
      graphics.beginPath();
      graphics.moveTo(x, y + half * 0.88);
      graphics.lineTo(x - half * 0.5, y + half * 0.28);
      graphics.lineTo(x - half * 0.26, y - half * 0.26);
      graphics.lineTo(x + half * 0.04, y - half * 0.84);
      graphics.lineTo(x + half * 0.16, y - half * 0.34);
      graphics.lineTo(x + half * 0.56, y + half * 0.12);
      graphics.lineTo(x + half * 0.38, y + half * 0.62);
      graphics.closePath();
      graphics.strokePath();
      return;
    }
    if (kind === "shield") {
      graphics.beginPath();
      graphics.moveTo(x, y - half * 0.82);
      graphics.lineTo(x + half * 0.68, y - half * 0.48);
      graphics.lineTo(x + half * 0.54, y + half * 0.38);
      graphics.lineTo(x, y + half * 0.82);
      graphics.lineTo(x - half * 0.54, y + half * 0.38);
      graphics.lineTo(x - half * 0.68, y - half * 0.48);
      graphics.closePath();
      graphics.strokePath();
      graphics.lineBetween(x, y - half * 0.48, x, y + half * 0.44);
      return;
    }
    if (kind === "shield-check") {
      graphics.beginPath();
      graphics.moveTo(x, y - half * 0.82);
      graphics.lineTo(x + half * 0.68, y - half * 0.48);
      graphics.lineTo(x + half * 0.54, y + half * 0.38);
      graphics.lineTo(x, y + half * 0.82);
      graphics.lineTo(x - half * 0.54, y + half * 0.38);
      graphics.lineTo(x - half * 0.68, y - half * 0.48);
      graphics.closePath();
      graphics.strokePath();
      graphics.lineBetween(
        x - half * 0.3,
        y - half * 0.02,
        x - half * 0.08,
        y + half * 0.24,
      );
      graphics.lineBetween(
        x - half * 0.08,
        y + half * 0.24,
        x + half * 0.34,
        y - half * 0.3,
      );
      return;
    }
    if (kind === "timer") {
      graphics.strokeCircle(x, y + half * 0.04, half * 0.66);
      graphics.lineBetween(x, y + half * 0.04, x, y - half * 0.38);
      graphics.lineBetween(x, y + half * 0.04, x + half * 0.38, y + half * 0.24);
      graphics.lineBetween(x - half * 0.22, y - half * 0.82, x + half * 0.22, y - half * 0.82);
      graphics.lineBetween(x, y - half * 0.82, x, y - half * 0.68);
      return;
    }
    if (kind === "plus") {
      graphics.lineBetween(x, y - half * 0.72, x, y + half * 0.72);
      graphics.lineBetween(x - half * 0.72, y, x + half * 0.72, y);
      return;
    }
    if (kind === "check") {
      graphics.lineBetween(
        x - half * 0.72,
        y,
        x - half * 0.16,
        y + half * 0.58,
      );
      graphics.lineBetween(
        x - half * 0.16,
        y + half * 0.58,
        x + half * 0.76,
        y - half * 0.58,
      );
      return;
    }
    if (kind === "trophy") {
      graphics.beginPath();
      graphics.moveTo(x - half * 0.48, y - half * 0.76);
      graphics.lineTo(x + half * 0.48, y - half * 0.76);
      graphics.lineTo(x + half * 0.34, y + half * 0.06);
      graphics.lineTo(x, y + half * 0.34);
      graphics.lineTo(x - half * 0.34, y + half * 0.06);
      graphics.closePath();
      graphics.strokePath();
      graphics.lineBetween(x, y + half * 0.34, x, y + half * 0.66);
      graphics.lineBetween(x - half * 0.38, y + half * 0.78, x + half * 0.38, y + half * 0.78);
      graphics.lineBetween(x - half * 0.62, y - half * 0.62, x - half * 0.82, y - half * 0.2);
      graphics.lineBetween(x - half * 0.82, y - half * 0.2, x - half * 0.48, y + half * 0.06);
      graphics.lineBetween(x + half * 0.62, y - half * 0.62, x + half * 0.82, y - half * 0.2);
      graphics.lineBetween(x + half * 0.82, y - half * 0.2, x + half * 0.48, y + half * 0.06);
      return;
    }
    if (kind === "medal") {
      graphics.strokeCircle(x, y - half * 0.12, half * 0.48);
      graphics.lineBetween(x - half * 0.28, y + half * 0.22, x - half * 0.52, y + half * 0.78);
      graphics.lineBetween(x - half * 0.28, y + half * 0.22, x - half * 0.04, y + half * 0.66);
      graphics.lineBetween(x + half * 0.28, y + half * 0.22, x + half * 0.52, y + half * 0.78);
      graphics.lineBetween(x + half * 0.28, y + half * 0.22, x + half * 0.04, y + half * 0.66);
      return;
    }
    if (kind === "swords" || kind === "arena") {
      graphics.lineBetween(x - half * 0.8, y + half * 0.8, x + half * 0.72, y - half * 0.72);
      graphics.lineBetween(x + half * 0.8, y + half * 0.8, x - half * 0.72, y - half * 0.72);
      return;
    }
    if (kind === "users" || kind === "roster") {
      graphics.strokeCircle(x, y - half * 0.45, half * 0.32);
      graphics.arc(x, y + half * 0.68, half * 0.62, Math.PI, 0);
      graphics.strokePath();
      return;
    }
    if (kind === "scroll" || kind === "quests") {
      graphics.strokeRoundedRect(x - half * 0.62, y - half * 0.78, half * 1.24, half * 1.56, 2);
      graphics.lineBetween(x - half * 0.34, y - half * 0.26, x + half * 0.34, y - half * 0.26);
      graphics.lineBetween(x - half * 0.34, y + half * 0.08, x + half * 0.2, y + half * 0.08);
      return;
    }
    if (kind === "settings") {
      graphics.strokeCircle(x, y, half * 0.38);
      for (let index = 0; index < 8; index += 1) {
        const angle = (index * Math.PI) / 4;
        graphics.lineBetween(
          x + Math.cos(angle) * half * 0.54,
          y + Math.sin(angle) * half * 0.54,
          x + Math.cos(angle) * half * 0.84,
          y + Math.sin(angle) * half * 0.84,
        );
      }
      return;
    }
    if (kind === "star" || kind === "codex") {
      const points = [];
      for (let index = 0; index < 10; index += 1) {
        const radius = index % 2 === 0 ? half : half * 0.38;
        const angle = -Math.PI / 2 + (index * Math.PI) / 5;
        points.push([x + Math.cos(angle) * radius, y + Math.sin(angle) * radius]);
      }
      graphics.beginPath();
      graphics.moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach(([px, py]) => graphics.lineTo(px, py));
      graphics.closePath();
      graphics.strokePath();
      return;
    }
    if (kind === "play") {
      graphics.beginPath();
      graphics.moveTo(x - half * 0.45, y - half * 0.72);
      graphics.lineTo(x + half * 0.72, y);
      graphics.lineTo(x - half * 0.45, y + half * 0.72);
      graphics.closePath();
      graphics.strokePath();
      return;
    }
    if (kind === "lock") {
      graphics.strokeRoundedRect(
        x - half * 0.58,
        y - half * 0.08,
        half * 1.16,
        half * 0.9,
        2,
      );
      graphics.arc(
        x,
        y - half * 0.18,
        half * 0.4,
        Math.PI,
        0,
        false,
      );
      graphics.strokePath();
      return;
    }
    graphics.strokeCircle(x, y, half * 0.74);
    graphics.lineBetween(x - half * 0.42, y, x + half * 0.42, y);
  }

  auditLayout() {
    const textOverlaps = [];
    for (let left = 0; left < this.textRects.length; left += 1) {
      for (let right = left + 1; right < this.textRects.length; right += 1) {
        if (overlaps(this.textRects[left], this.textRects[right], 1.5)) {
          textOverlaps.push([
            this.textRects[left].text,
            this.textRects[right].text,
          ]);
        }
      }
    }
    const glyphTextOverlaps = [];
    for (const glyph of this.glyphRects) {
      for (const text of this.textRects) {
        if (overlaps(glyph, text, 0.5)) {
          glyphTextOverlaps.push([glyph.kind, text.text]);
        }
      }
    }
    const glyphOverlaps = [];
    for (let left = 0; left < this.glyphRects.length; left += 1) {
      for (
        let right = left + 1;
        right < this.glyphRects.length;
        right += 1
      ) {
        if (overlaps(this.glyphRects[left], this.glyphRects[right], 0.5)) {
          glyphOverlaps.push([
            this.glyphRects[left].kind,
            this.glyphRects[right].kind,
          ]);
        }
      }
    }
    const imageTextOverlaps = [];
    for (const image of this.imageRects.filter((item) => !item.decorative)) {
      for (const text of this.textRects) {
        if (overlaps(image, text, 0.5)) {
          imageTextOverlaps.push([image.url, text.text]);
        }
      }
    }
    const hitEntries = [...this.hitAreas.entries()];
    const hitOverlaps = [];
    for (let left = 0; left < hitEntries.length; left += 1) {
      for (let right = left + 1; right < hitEntries.length; right += 1) {
        if (overlaps(hitEntries[left][1], hitEntries[right][1], 1)) {
          hitOverlaps.push([hitEntries[left][0], hitEntries[right][0]]);
        }
      }
    }
    const outside = [
      ...this.textRects
        .filter((rect) => !rectWithin(rect, this.width, this.height))
        .map((rect) => ({ kind: "text", value: rect.text, rect })),
      ...hitEntries
        .filter(([, rect]) => !rectWithin(rect, this.width, this.height))
        .map(([id, rect]) => ({ kind: "hit", value: id, rect })),
      ...this.imageRects
        .filter((rect) => !rectWithin(rect, this.width, this.height))
        .map((rect) => ({ kind: "image", value: rect.url, rect })),
      ...this.glyphRects
        .filter((rect) => !rectWithin(rect, this.width, this.height))
        .map((rect) => ({ kind: "glyph", value: rect.kind, rect })),
    ];
    return {
      textOverlaps,
      glyphTextOverlaps,
      glyphOverlaps,
      imageTextOverlaps,
      hitOverlaps,
      outside,
      textCount: this.textRects.length,
      imageCount: this.imageRects.length,
      glyphCount: this.glyphRects.length,
      hitCount: this.hitAreas.size,
    };
  }

  getUiSnapshot() {
    return {
      screen: this.model?.screen || null,
      mode: this.mode,
      width: Math.round(this.width),
      height: Math.round(this.height),
      hitAreas: Object.fromEntries(this.hitAreas),
      texts: this.textRects.map((rect) => ({ ...rect })),
      images: this.imageRects.map((rect) => ({ ...rect })),
      glyphs: this.glyphRects.map((rect) => ({ ...rect })),
      audit: this.audit || null,
    };
  }

  destroy() {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.destroyed = true;
    this.mode = "destroyed";
    this.scene?.scale?.off?.("resize", this.resizeHandler);
    this.game?.destroy?.(true);
    this.game = null;
    this.scene = null;
    this.phaserReady = false;
  }
}

export function createGameStage(canvas, options) {
  return new GameStage(canvas, options);
}
