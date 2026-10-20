const ASSET_BASE = "/assets/";

const OPEN_SOURCE_VFX = Object.freeze({
  blade_arc: "/assets/vfx/kenney/blade_arc.webp",
  blade_cut: "/assets/vfx/kenney/blade_cut.webp",
  impact_spark: "/assets/vfx/kenney/impact_spark.webp",
  hit_spark: "/assets/vfx/kenney/hit_spark.webp",
  heavy_dust: "/assets/vfx/kenney/heavy_dust.webp",
  volley_trace: "/assets/vfx/kenney/volley_trace.webp",
  ultimate_star: "/assets/vfx/kenney/ultimate_star.webp",
  restore_glow: "/assets/vfx/kenney/restore_glow.webp",
});

const OPEN_SOURCE_VFX_KEY = "battle-open-vfx-";

const OPEN_SOURCE_VFX_RECIPES = Object.freeze({
  blade: ["blade_arc", "hit_spark"],
  volley: ["volley_trace", "impact_spark"],
  impact: ["heavy_dust", "impact_spark", "hit_spark"],
  guard: ["restore_glow", "hit_spark"],
  restore: ["restore_glow", "blade_cut"],
  ultimate: ["ultimate_star", "impact_spark", "blade_cut"],
});

const TONES = Object.freeze({
  cinnabar: {
    main: 0xc97b62,
    light: 0xf1d0ad,
    wash: 0x6e2927,
  },
  teal: {
    main: 0x79b2a8,
    light: 0xe1f2e9,
    wash: 0x203b3a,
  },
  gold: {
    main: 0xd3b36f,
    light: 0xfff2c7,
    wash: 0x6f5727,
  },
  blue: {
    main: 0x8dafc6,
    light: 0xe6f2fa,
    wash: 0x334d61,
  },
});

const PATH_PRESENTATION = Object.freeze({
  gang: { name: "刚猛", color: 0xc97b62 },
  ling: { name: "灵巧", color: 0x79b2a8 },
  tao: { name: "韬略", color: 0xd3b36f },
  shou: { name: "守御", color: 0x8dafc6 },
});

const STATUS_LABELS = Object.freeze({
  armorBreak: "破甲",
  bleeding: "流血",
  stun: "眩晕",
  guard: "护御",
  inspiration: "鼓舞",
  sealed: "封穴",
});

const UI_COLORS = Object.freeze({
  ink: 0x050807,
  panel: 0x0a100f,
  panelRaised: 0x151d1a,
  line: 0x3a443b,
  paper: 0xf2ead8,
  paperMuted: 0xa79c84,
  bronze: 0xd8b970,
  bronzeDim: 0x80683c,
  teal: 0x73aaa1,
  tealDim: 0x315653,
  cinnabar: 0xb95845,
  blue: 0x89a9bd,
});

const SKILL_DURATIONS = Object.freeze({
  blade: 780,
  volley: 900,
  impact: 980,
  guard: 900,
  restore: 900,
  ultimate: 1320,
});

const ROW_X = Object.freeze({
  0: 0.5,
  1: 0.31,
  2: 0.69,
});

const WEATHER_PATTERN =
  /(雪|风|冬|夜|林|庄|寨|渡|江|水|湖|门|灯)/;
const BACKDROP_TEXTURE_KEY = "battle-stage-backdrop";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - clamp(value, 0, 1), 3);
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

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function safeAssetUrl(value) {
  if (!value || typeof value !== "string") return null;
  return value.startsWith(ASSET_BASE) ? value : null;
}

function assetKey(url) {
  return `battle-asset-${hashSeed(url).toString(16)}`;
}

function actorArtHeight(actor, mobile) {
  const groundWidth = Number(actor?.position?.width) || 120;
  return actor?.unit?.side === "hero"
    ? clamp(groundWidth * (mobile ? 1.34 : 1.5), 92, 310)
    : clamp(groundWidth * 1.12, 82, 250);
}

function combatantAsset(unit) {
  return safeAssetUrl(unit?.portrait || unit?.sprite);
}

export function battlePerformanceKind(profile) {
  return SKILL_DURATIONS[profile?.template] ? profile.template : "blade";
}

/**
 * Phaser 3 owns the animated battle stage. HTML proxies remain on top for
 * accessible targeting and HUD measurement, while this controller exposes the
 * small imperative API consumed by the existing battle screen.
 */
export class BattleStageScene {
  constructor(canvas, options = {}) {
    if (!canvas) {
      throw new TypeError("Battle stage requires a canvas element");
    }
    this.canvas = canvas;
    this.mode = "pending";
    this.backdrop = options.backdrop || null;
    this.currentSignature = options.signature || "";
    this.reducedMotion = Boolean(options.reducedMotion);
    this.speed = [1, 2, 4].includes(options.speed) ? options.speed : 1;
    this.callbacks = options.callbacks || {};
    this.onReady = typeof options.onReady === "function" ? options.onReady : null;
    this.ui = null;
    this.uiLayer = null;
    this.interfaceGraphics = null;
    this.backdropImage = null;
    this.backdropShade = null;
    this.backdropBottomShade = null;
    this.interfaceHitRects = new Map();
    this.contextRect = null;
    this.chainRect = null;
    this.tutorialRect = null;
    this.commandRect = null;
    this.hoveredSkillId = null;
    this.focusedUid = null;
    this.width = 1;
    this.height = 1;
    this.actors = new Map();
    this.actorSprites = new Map();
    this.assetManifest = new Map();
    this.effectSprites = new Set();
    this.openSourceVfxPlays = 0;
    this.lastUnits = [];
    this.activeUid = null;
    this.attack = null;
    this.renderedVfx = null;
    this.targetableUids = new Set();
    this.fps = 60;
    this.characterPixels = false;
    this.phaserReady = false;
    this.destroyed = false;
    this.ambientParticles = [];
    this.resizeHandler = null;
    this.contextLostHandler = null;
    this.refreshViewport();
  }

  async start() {
    if (this.destroyed || this.phaserGame) return this.phaserGame || null;
    this.mode = "loading";
    try {
      const phaserModule = await import("phaser");
      const Phaser =
        phaserModule.default?.Game
          ? phaserModule.default
          : phaserModule.Phaser?.Game
            ? phaserModule.Phaser
            : phaserModule.Game
              ? phaserModule
              : phaserModule.default || phaserModule;
      if (this.destroyed) return null;
      if (!Phaser?.Game) {
        throw new TypeError(
          `Phaser module did not expose Game (keys: ${Object.keys(phaserModule).join(", ")})`,
        );
      }
      this.engine = Phaser;
      const supportsWebGl = Boolean(
        Phaser.Device?.Features?.webGL ?? Phaser.Device?.Features?.webgl,
      );
      const stage = this;
      const sceneConfig = {
        key: "shuihu-battle-stage",
        preload() {
          stage.preloadScene(this);
        },
        create() {
          stage.createScene(this);
        },
        update(time, delta) {
          stage.updateScene(this, time, delta);
        },
      };
      this.phaserGame = new Phaser.Game({
        // Phaser requires an explicit renderer when supplied a canvas.
        type: supportsWebGl ? Phaser.WEBGL : Phaser.CANVAS,
        canvas: this.canvas,
        parent: this.canvas.parentElement || null,
        width: Math.max(1, Math.round(this.width)),
        height: Math.max(1, Math.round(this.height)),
        transparent: true,
        backgroundColor: "rgba(0,0,0,0)",
        antialias: true,
        banner: false,
        audio: false,
        dom: { createContainer: false },
        scale: {
          mode: Phaser.Scale.RESIZE,
          width: Math.max(1, Math.round(this.width)),
          height: Math.max(1, Math.round(this.height)),
          autoCenter: Phaser.Scale.NO_CENTER,
        },
        scene: sceneConfig,
        callbacks: {
          postBoot: (game) => {
            this.mode = "phaser";
            this.canvas.dataset.renderer = "phaser";
            game.events.once("destroy", () => {
              this.phaserReady = false;
            });
          },
        },
      });
      this.mode = "phaser";
      return this.phaserGame;
    } catch (error) {
      this.mode = "failed";
      this.startError = error;
      globalThis.__shuihuBattleStageError = String(error?.stack || error);
      console.error("Phaser battle stage failed to start", error);
      throw error;
    }
  }

  async loadPhaserEngine() {
    await this.start();
    return this.engine;
  }

  preloadScene(scene) {
    const backdropUrl = safeAssetUrl(this.backdrop);
    if (backdropUrl) {
      scene.load.image(BACKDROP_TEXTURE_KEY, backdropUrl);
    }
    for (const [key, url] of this.assetManifest) {
      scene.load.image(key, url);
    }
    for (const [name, url] of Object.entries(OPEN_SOURCE_VFX)) {
      scene.load.image(`${OPEN_SOURCE_VFX_KEY}${name}`, url);
    }
  }

  createScene(scene) {
    if (this.destroyed) return;
    this.scene = scene;
    this.phaserReady = true;
    this.scene.cameras.main.setBackgroundColor("rgba(0,0,0,0)");
    this.createBackdrop();
    this.ambientGraphics = scene.add.graphics().setDepth(20);
    this.shadowGraphics = scene.add.graphics().setDepth(80);
    this.effectGraphics = scene.add.graphics().setDepth(2000);
    this.actorHudLayer = scene.add.container(0, 0).setDepth(2600);
    this.interfaceGraphics = scene.add.graphics().setDepth(3600);
    this.uiLayer = scene.add.container(0, 0).setDepth(3800);
    this.resizeHandler = (gameSize) => this.resizeTo(gameSize.width, gameSize.height);
    scene.scale.on("resize", this.resizeHandler);
    this.refreshViewport();
    this.syncSprites();
    if (this.attack) this.spawnOpenSourceVfx(this.attack);
    this.refreshProxyLayout();
    this.renderBattleInterface();
    this.onReady?.();
  }

  createBackdrop() {
    if (!this.scene?.textures?.exists?.(BACKDROP_TEXTURE_KEY)) return;
    this.backdropImage = this.scene.add
      .image(this.width / 2, this.height / 2, BACKDROP_TEXTURE_KEY)
      .setDepth(-100);
    this.backdropShade = this.scene.add
      .rectangle(0, 0, this.width, this.height, 0x05090a, 0.18)
      .setOrigin(0, 0)
      .setDepth(-90);
    this.backdropBottomShade = this.scene.add
      .rectangle(0, this.height * 0.58, this.width, this.height * 0.42, 0x05090a, 0.5)
      .setOrigin(0, 0)
      .setDepth(-80);
    this.layoutBackdrop();
  }

  layoutBackdrop() {
    if (!this.backdropImage) return;
    const texture = this.backdropImage.texture?.getSourceImage?.();
    const textureWidth = Number(texture?.width) || Number(this.backdropImage.width) || 1;
    const textureHeight = Number(texture?.height) || Number(this.backdropImage.height) || 1;
    const scale = Math.max(
      this.width / Math.max(1, textureWidth),
      this.height / Math.max(1, textureHeight),
    );
    this.backdropImage
      .setPosition(this.width / 2, this.height / 2)
      .setDisplaySize(textureWidth * scale, textureHeight * scale);
    this.backdropShade?.setSize(this.width, this.height);
    this.backdropBottomShade
      ?.setPosition(0, this.height * 0.58)
      .setSize(this.width, this.height * 0.42);
  }

  refreshViewport() {
    const container = this.canvas.parentElement;
    const rect =
      container?.getBoundingClientRect?.() ||
      this.canvas.getBoundingClientRect?.();
    const width = Number(rect?.width) || Number(this.canvas.width) || 1;
    const height = Number(rect?.height) || Number(this.canvas.height) || 1;
    const changed =
      Math.abs(width - this.width) > 0.5 ||
      Math.abs(height - this.height) > 0.5;
    if (changed && this.scene?.scale?.resize) {
      this.scene.scale.resize(width, height);
      return;
    }
    this.resizeTo(width, height);
  }

  resizeTo(width, height) {
    const nextWidth = Math.max(1, Number(width) || 1);
    const nextHeight = Math.max(1, Number(height) || 1);
    const changed =
      Math.abs(nextWidth - this.width) > 0.5 ||
      Math.abs(nextHeight - this.height) > 0.5;
    this.width = nextWidth;
    this.height = nextHeight;
    if (!changed) return;
    this.ambientParticles = this.createAmbientParticles();
    this.layoutBackdrop();
    this.recalculateActorPositions();
    this.renderBattleInterface();
    this.refreshProxyLayout();
  }

  configure(options = {}) {
    this.backdrop = options.backdrop || this.backdrop;
    this.speed = [1, 2, 4].includes(options.speed) ? options.speed : 1;
    this.reducedMotion = Boolean(options.reducedMotion);
    this.weather = options.weather || this.weather || "clear";
    this.refreshViewport();
  }

  describeWeather(backdrop = this.backdrop) {
    return WEATHER_PATTERN.test(String(backdrop || "")) ? "snow" : "clear";
  }

  getBattleViewport() {
    const compact = this.width < 920;
    const contextTop = compact ? 56 + 6 : 62 + 6;
    const contextHeight = compact ? 58 : 48;
    const battleTop = contextTop + contextHeight + 8;
    if (compact) {
      const dockHeight = clamp(this.height * 0.32, 204, 252);
      return {
        x: 8,
        y: battleTop,
        width: Math.max(1, this.width - 16),
        height: Math.max(160, this.height - battleTop - dockHeight - 8),
      };
    }
    const railWidth = clamp(this.width * 0.235, 294, 336);
    return {
      x: 16,
      y: battleTop,
      width: Math.max(420, this.width - railWidth - 34),
      height: Math.max(300, this.height - battleTop - 22),
      railWidth,
    };
  }

  getInterfaceLayout() {
    const viewport = this.getBattleViewport();
    const compact = this.width < 920;
    if (compact) {
      return {
        compact,
        viewport,
        rail: {
          x: 8,
          y: this.height - clamp(this.height * 0.32, 204, 252) - 2,
          width: Math.max(1, this.width - 16),
          height: clamp(this.height * 0.32, 204, 252),
        },
      };
    }
    const railWidth = viewport.railWidth;
    return {
      compact,
      viewport,
      rail: {
        x: this.width - railWidth - 12,
        y: 64,
        width: railWidth,
        height: this.height - 76,
      },
    };
  }

  collectAssetManifest(units = this.lastUnits) {
    this.assetManifest.clear();
    for (const unit of units) {
      const url = combatantAsset(unit);
      if (url) this.assetManifest.set(assetKey(url), url);
    }
    return this.assetManifest;
  }

  computeLayout(units = this.lastUnits) {
    const layout = new Map();
    const mobile = this.width < 600;
    const viewport = this.getBattleViewport();
    const heroGroups = new Map();
    const enemyGroups = new Map();
    for (const unit of units) {
      const groups = unit.side === "hero" ? heroGroups : enemyGroups;
      const row = clamp(Number(unit.row) || 0, 0, 2);
      if (!groups.has(row)) groups.set(row, []);
      groups.get(row).push(unit);
    }

    const placeSide = (groups, side) => {
      for (const [row, list] of groups) {
        const laneSpread = mobile ? 0.13 : 0.1;
        list.forEach((unit, index) => {
          const laneOffset =
            list.length === 1
              ? 0
              : (index - (list.length - 1) / 2) * laneSpread;
          const baseX = ROW_X[row] + laneOffset;
          const xRatio = side === "hero" ? baseX : 1 - baseX;
          const depth = row === 0 ? 0 : mobile ? 4 : side === "hero" ? 12 : 9;
          const yRatio =
            side === "hero"
              ? (mobile ? 0.68 : 0.74) - row * (mobile ? 0.018 : 0.008)
              : (mobile ? 0.28 : 0.29) - row * (mobile ? 0.016 : 0.01);
          const groundWidth = mobile
            ? clamp(viewport.width * 0.23, 62, 108)
            : clamp(viewport.width * 0.18, 88, 210);
          layout.set(unit.uid, {
            side,
            slot: index,
            row,
            x: viewport.x + clamp(xRatio, 0.1, 0.9) * viewport.width,
            y: viewport.y + yRatio * viewport.height + depth,
            width: groundWidth,
            depth,
          });
        });
      }
    };

    placeSide(heroGroups, "hero");
    placeSide(enemyGroups, "enemy");
    return {
      units: layout,
      heroUnits: units.filter((unit) => unit.side === "hero"),
      enemyUnits: units.filter((unit) => unit.side !== "hero"),
    };
  }

  prepareActors(units = [], activeUid = null, targetableUids = []) {
    this.lastUnits = units;
    this.activeUid = activeUid;
    this.targetableUids = new Set(targetableUids);
    this.collectAssetManifest(units);
    const { units: positions } = this.computeLayout(units);
    const seen = new Set();
    for (const unit of units) {
      const position = positions.get(unit.uid);
      if (!position) continue;
      seen.add(unit.uid);
      const previous = this.actors.get(unit.uid);
      const actor = previous || {
        uid: unit.uid,
        identity: `${unit.uid}-${unit.side}`,
        phase: Math.random() * Math.PI * 2,
        hitAt: 0,
        recoverAt: 0,
        dodgeAt: 0,
        flash: 0,
        defeated: false,
        defeatAt: 0,
      };
      const wasDefeated = Boolean(actor.defeated);
      actor.unit = unit;
      actor.position = position;
      actor.active = unit.uid === activeUid;
      actor.targetable = this.targetableUids.has(unit.uid);
      actor.defeated = Number(unit.hp) <= 0;
      if (actor.defeated && !wasDefeated) {
        actor.defeatAt = this.scene?.time?.now ?? performance.now();
      }
      this.actors.set(unit.uid, actor);
    }
    for (const uid of this.actors.keys()) {
      if (!seen.has(uid)) this.actors.delete(uid);
    }
  }

  recalculateActorPositions() {
    if (!this.lastUnits.length) return;
    const { units: positions } = this.computeLayout(this.lastUnits);
    for (const [uid, actor] of this.actors) {
      const position = positions.get(uid);
      if (position) actor.position = position;
    }
    this.syncSprites();
  }

  syncSprites() {
    if (!this.scene?.add || !this.phaserReady) return;
    const mobile = this.width < 600;
    for (const [uid, actor] of this.actors) {
      this.syncActorHud(actor);
      const url = combatantAsset(actor.unit);
      const key = url ? assetKey(url) : null;
      if (!key || !this.scene.textures.exists(key)) continue;
      let sprite = this.actorSprites.get(uid);
      if (!sprite) {
        sprite = this.scene.add.image(actor.position.x, actor.position.y, key);
        sprite.setOrigin(0.5, 0.94);
        sprite.setDepth(100 + actor.position.y);
        sprite.setInteractive({ useHandCursor: true });
        sprite.on("pointerover", () => {
          this.focusedUid = uid;
        });
        sprite.on("pointerout", () => {
          if (this.focusedUid === uid) this.focusedUid = null;
        });
        sprite.on("pointerdown", () => {
          const current = this.actors.get(uid);
          if (!current?.targetable) return;
          this.callbacks.onTarget?.(uid);
        });
        if (sprite.preFX?.addColorMatrix) {
          actor.deathEffect = sprite.preFX.addColorMatrix();
          actor.deathEffect.grayscale(1);
          actor.deathEffect.active = false;
        }
        this.actorSprites.set(uid, sprite);
      }
      const artHeight = actorArtHeight(actor, mobile);
      const artWidth =
        artHeight * (actor.unit?.side === "hero" ? 0.88 : 0.75);
      sprite.setTexture(key);
      sprite.setDisplaySize(artWidth, artHeight);
      sprite.setVisible(true);
      this.characterPixels = true;
    }
  }

  updateScene(scene, time, delta) {
    if (this.destroyed) return;
    this.fps = Math.round(1000 / Math.max(12, delta));
    const gameSize = scene.scale.gameSize;
    this.resizeTo(gameSize.width, gameSize.height);
    this.syncSprites();
    this.updateAmbient();
    this.drawAmbient();
    this.updateActorSprites(time);
    this.drawEffects(time);
  }

  createAmbientParticles() {
    const random = seededRandom(
      hashSeed(`${this.currentSignature}-${this.width}-${this.height}`),
    );
    const count = this.reducedMotion ? 0 : this.width < 600 ? 34 : 72;
    return Array.from({ length: count }, () => ({
      x: random() * this.width,
      y: random() * this.height,
      speed: 0.014 + random() * 0.035,
      drift: (random() - 0.5) * 0.02,
      size: 0.55 + random() * 1.35,
      alpha: 0.18 + random() * 0.52,
      phase: random() * Math.PI * 2,
    }));
  }

  updateAmbient() {
    if (!this.ambientParticles.length) return;
    for (const particle of this.ambientParticles) {
      particle.y += particle.speed * (this.speed + 0.35);
      particle.x +=
        particle.drift * (this.speed + 0.2) +
        (this.weather === "snow" ? 0.08 : 0.02);
      if (particle.y > this.height + 6) {
        particle.y = -6;
        particle.x = Math.random() * this.width;
      }
      if (particle.x > this.width + 6) particle.x = -6;
    }
  }

  drawAmbient() {
    const graphics = this.ambientGraphics;
    if (!graphics) return;
    graphics.clear();
    const time = this.scene?.time?.now || performance.now();
    for (const particle of this.ambientParticles) {
      const flicker =
        0.72 + Math.sin(time * 0.0013 + particle.phase) * 0.28;
      graphics.fillStyle(0xe9f0e8, particle.alpha * flicker);
      graphics.fillCircle(
        particle.x + Math.sin(time * 0.001 + particle.phase) * 1.8,
        particle.y,
        particle.size,
      );
    }
  }

  attackProgress(time = this.scene?.time?.now || performance.now()) {
    if (!this.attack) return null;
    const elapsed = Math.max(0, time - this.attack.startedAt);
    const progress = clamp(elapsed / Math.max(1, this.attack.duration), 0, 1);
    if (elapsed > this.attack.duration + 90) {
      this.attack = null;
      return null;
    }
    return {
      elapsed,
      progress,
      kind: this.attack.kind,
      tone: TONES[this.attack.tone] || TONES.cinnabar,
      actor: this.actors.get(this.attack.actorUid),
      target: this.actors.get(this.attack.targetUids?.[0]),
      profile: this.attack,
    };
  }

  updateActorSprites(time) {
    const graphics = this.shadowGraphics;
    if (!graphics || !this.actorSprites.size) return;
    graphics.clear();
    const attack = this.attackProgress(time);
    const mobile = this.width < 600;
    for (const [uid, actor] of this.actors) {
      const sprite = this.actorSprites.get(uid);
      if (!sprite) continue;
      const position = actor.position;
      const artHeight = actorArtHeight(actor, mobile);
      const groundY = position.y + 34;
      let x = position.x;
      let y = groundY;
      let rotation = 0;
      let scaleX = 1;
      let alpha = 1;
      const breathing = this.reducedMotion
        ? 0
        : Math.sin(time * 0.00145 + actor.phase) * 1.8;
      y += breathing;

      if (actor.defeated) {
        rotation = 0;
        alpha = 0.28;
        y += 17;
        actor.deathProgress = 1;
      }
      if (actor.deathEffect) {
        actor.deathEffect.active = actor.defeated;
        actor.deathEffect.alpha = actor.defeated ? 1 : 0;
      }
      if (actor.hitAt && time >= actor.hitAt) {
        const hit = clamp((time - actor.hitAt) / 320, 0, 1);
        if (hit < 1) {
          x += Math.sin(hit * Math.PI * 3) * 8 * (1 - hit);
          actor.flash = Math.max(actor.flash, 0.9 * (1 - hit));
        }
      }
      if (actor.dodgeAt && time >= actor.dodgeAt) {
        const dodge = clamp((time - actor.dodgeAt) / 340, 0, 1);
        if (dodge < 1) {
          x +=
            (position.side === "hero" ? -1 : 1) *
            Math.sin(dodge * Math.PI) *
            22;
        }
      }
      if (attack?.actor === actor) {
        const direction = position.side === "hero" ? 1 : -1;
        const lunge = Math.sin(
          Math.PI * clamp(attack.progress / 0.62, 0, 1),
        );
        if (["blade", "impact", "ultimate"].includes(attack.kind)) {
          const target = attack.target?.position;
          x +=
            ((target?.x || position.x) - position.x) *
            lunge *
            0.24;
          y +=
            ((target?.y || position.y) - position.y) *
            lunge *
            0.16;
        } else if (attack.kind === "volley") {
          x += direction * -4 * Math.sin(Math.PI * attack.progress);
        } else {
          scaleX += 0.028 * Math.sin(Math.PI * attack.progress);
        }
      }
      actor.flash = Math.max(0, actor.flash - 0.045);
      sprite.setPosition(x, y);
      sprite.setRotation(rotation);
      sprite.setAlpha(alpha);
      sprite.setScale(
        (scaleX * artHeight * (position.side === "hero" ? 0.88 : 0.75)) /
          sprite.width,
        (scaleX * artHeight) / sprite.height,
      );
      if (actor.defeated && !actor.deathEffect) {
        sprite.setTint(0x8a8a8a);
      } else if (actor.flash > 0) sprite.setTintFill(0xf0d2ae);
      else if (actor.recoverAt && time >= actor.recoverAt) {
        sprite.setTint(0x9fd8b6);
      } else sprite.clearTint();
      sprite.setDepth(100 + groundY);

      graphics.fillStyle(0x020606, actor.defeated ? 0.18 : 0.42);
      graphics.fillEllipse(
        position.x,
        groundY + 2,
        position.width * 0.7,
        Math.max(5, position.width * 0.1),
      );
      if (actor.active) {
        const pulse =
          0.58 + Math.sin(time * 0.004 + actor.phase) * 0.16;
        graphics.lineStyle(1.4, 0xd7bc7d, pulse);
        graphics.strokeEllipse(
          position.x,
          groundY + 1,
          position.width * 0.74,
          Math.max(8, position.width * 0.12),
        );
      }
      if (actor.targetable) {
        const pulse =
          0.72 + Math.sin(time * 0.006 + actor.phase) * 0.18;
        const reticleY = groundY - Math.min(artHeight * 0.6, 138);
        graphics.lineStyle(1.8, 0xd7bc7d, pulse);
        graphics.strokeCircle(position.x, reticleY, 22);
        graphics.lineBetween(position.x - 34, reticleY, position.x - 25, reticleY);
        graphics.lineBetween(position.x + 25, reticleY, position.x + 34, reticleY);
        graphics.lineBetween(position.x, reticleY - 34, position.x, reticleY - 25);
        graphics.lineBetween(position.x, reticleY + 25, position.x, reticleY + 34);
        graphics.fillStyle(0xd7bc7d, pulse);
        graphics.fillCircle(position.x, reticleY, 2.2);
      }
      if (actor.unit?.uid === this.focusedUid) {
        graphics.lineStyle(2, 0xe3c987, 0.88);
        graphics.strokeEllipse(
          position.x,
          groundY + 1,
          position.width * 0.8,
          Math.max(9, position.width * 0.14),
        );
      }
    }
  }

  drawEffects(time) {
    const graphics = this.effectGraphics;
    if (!graphics) return;
    graphics.clear();
    const state = this.attackProgress(time);
    if (!state) return;
    const { progress, kind, tone, actor, target, profile } = state;
    if (!actor?.position) return;
    const origin = actor.position;
    const focus = target?.position || origin;
    const motion = this.reducedMotion ? 0.2 : 1;
    const random = seededRandom(profile.seed || 2026);

    if (progress < 0.16) {
      graphics.lineStyle(1.2, tone.main, 0.5 * (1 - progress / 0.16));
      graphics.strokeEllipse(
        origin.x,
        origin.y + 42,
        34 + progress * 90,
        10 + progress * 22,
      );
    }

    if (["blade", "impact", "ultimate"].includes(kind)) {
      const travel = easeOutCubic(
        clamp((progress - 0.12) / 0.28, 0, 1),
      );
      const fade = 1 - clamp((progress - 0.5) / 0.34, 0, 1);
      if (fade > 0 && travel > 0) {
        graphics.lineStyle(
          this.width < 600 ? 2 : 3.5,
          tone.main,
          fade * 0.7,
        );
        graphics.lineBetween(
          origin.x,
          origin.y - 44,
          origin.x + (focus.x - origin.x) * travel,
          origin.y - 44 + (focus.y - origin.y) * travel,
        );
      }
    }

    if (
      progress >= 0.37 &&
      progress <= 0.88 &&
      ["blade", "impact", "ultimate"].includes(kind)
    ) {
      const local = clamp((progress - 0.37) / 0.42, 0, 1);
      const alpha = Math.sin(Math.PI * local) * 0.82;
      for (let index = 0; index < 3; index += 1) {
        const offset = (index - 1) * 13 * motion;
        graphics.lineStyle(2.4 - index * 0.35, tone.light, alpha);
        graphics.lineBetween(
          focus.x - 76 * motion,
          focus.y - 44 + offset,
          focus.x + 76 * motion,
          focus.y - 70 + offset * 0.7,
        );
      }
      graphics.fillStyle(tone.main, alpha * 0.55);
      const count = kind === "impact" ? 14 : 9;
      for (let index = 0; index < count; index += 1) {
        const angle = (Math.PI * 2 * index) / count + local * 0.45;
        const distance = (22 + local * 108) * motion;
        graphics.fillCircle(
          focus.x + Math.cos(angle) * distance,
          focus.y - 42 + Math.sin(angle) * distance * 0.54,
          (1.5 + (index % 3)) * (1 - local * 0.4),
        );
      }
    }

    if (kind === "volley") {
      const launch = easeOutCubic(
        clamp((progress - 0.12) / 0.38, 0, 1),
      );
      const fade = 1 - clamp((progress - 0.65) / 0.2, 0, 1);
      if (fade > 0) {
        for (let index = 0; index < 8; index += 1) {
          const startX = origin.x + (random() - 0.5) * 22;
          const startY = origin.y - 82 - random() * 14;
          const x = startX + (focus.x - startX) * launch;
          const y =
            startY +
            (focus.y - 44 - startY) * launch -
            Math.sin(Math.PI * launch) * (22 + random() * 20);
          graphics.lineStyle(1.4, tone.light, fade * 0.82);
          graphics.lineBetween(x - 11, y + 3, x + 8, y - 2);
        }
      }
    }

    if (kind === "guard" || (kind === "ultimate" && target)) {
      const local = clamp((progress - 0.24) / 0.5, 0, 1);
      if (local > 0 && local < 1) {
        graphics.lineStyle(1.5, tone.light, (1 - local) * 0.52);
        graphics.strokeEllipse(
          focus.x,
          focus.y + 18,
          48 + local * 105 * motion,
          16 + local * 32 * motion,
        );
      }
    }

    if (kind === "restore") {
      const amount = clamp((progress - 0.12) / 0.72, 0, 1);
      for (let index = 0; index < 14; index += 1) {
        graphics.fillStyle(tone.light, (1 - amount) * 0.72);
        graphics.fillCircle(
          focus.x + (random() - 0.5) * 94,
          focus.y + 12 - amount * (44 + random() * 92),
          1.2 + random() * 2,
        );
      }
    }

    if (kind === "ultimate") {
      const amount = clamp((progress - 0.08) / 0.72, 0, 1);
      graphics.lineStyle(1.2, tone.main, (1 - amount) * 0.58);
      graphics.strokeCircle(
        origin.x,
        origin.y - 54,
        24 + amount * 108 * motion,
      );
      for (let index = 0; index < 14; index += 1) {
        const angle = (Math.PI * 2 * index) / 14 + amount;
        graphics.fillStyle(tone.light, (1 - amount) * 0.55);
        graphics.fillCircle(
          focus.x + Math.cos(angle) * (38 + amount * 84),
          focus.y - 38 + Math.sin(angle) * (24 + amount * 52),
          1.4 + (index % 3),
        );
      }
    }

    if (
      !profile.shakePlayed &&
      progress >= 0.42 &&
      ["blade", "impact", "ultimate"].includes(kind)
    ) {
      profile.shakePlayed = true;
      this.scene?.cameras?.main?.shake(95, 0.0024 * motion);
    }
  }

  spawnOpenSourceVfx(attack) {
    if (!this.scene || !this.engine) return;
    const actor = this.actors.get(attack.actorUid);
    const target = this.actors.get(attack.targetUids?.[0]);
    const origin = actor?.position;
    const focus = target?.position || origin;
    if (!origin || !focus) return;
    const tone = TONES[attack.tone] || TONES.cinnabar;
    const direction = focus.x >= origin.x ? 1 : -1;
    const targetX = focus.x;
    const targetY = focus.y - 42;
    const impactDelay = this.ticks(240);
    const common = {
      tint: tone.light,
      duration: this.ticks(520),
      depth: 2100,
    };

    switch (attack.kind) {
      case "volley": {
        const angle =
          (Math.atan2(targetY - (origin.y - 62), targetX - origin.x) * 180) /
            Math.PI +
          90;
        this.spawnOpenSourceEffect("volley_trace", targetX, targetY, {
          ...common,
          angle,
          startScaleX: 0.22,
          startScaleY: 0.55,
          endScaleX: 0.34,
          endScaleY: 1.25,
          alpha: 0.72,
          tint: tone.main,
        });
        this.spawnOpenSourceEffect("impact_spark", targetX, targetY, {
          ...common,
          delay: impactDelay,
          startScale: 0.18,
          endScale: 0.58,
          alpha: 0.92,
        });
        break;
      }
      case "impact": {
        this.spawnOpenSourceEffect("heavy_dust", focus.x, focus.y + 30, {
          ...common,
          startScale: 0.42,
          endScale: 1.55,
          alpha: 0.36,
          tint: tone.main,
          duration: this.ticks(720),
        });
        this.spawnOpenSourceEffect("impact_spark", targetX, targetY, {
          ...common,
          delay: impactDelay,
          startScale: 0.22,
          endScale: 0.9,
          alpha: 0.95,
          angle: direction * 8,
        });
        this.spawnOpenSourceEffect("hit_spark", targetX, targetY + 8, {
          ...common,
          delay: impactDelay + 45,
          startScale: 0.12,
          endScale: 0.5,
          alpha: 0.72,
        });
        break;
      }
      case "guard": {
        this.spawnOpenSourceEffect("restore_glow", origin.x, origin.y + 16, {
          ...common,
          startScale: 0.3,
          endScale: 1.2,
          alpha: 0.48,
          tint: tone.main,
          duration: this.ticks(680),
        });
        this.spawnOpenSourceEffect("hit_spark", origin.x, origin.y - 42, {
          ...common,
          delay: this.ticks(120),
          startScale: 0.1,
          endScale: 0.46,
          alpha: 0.62,
        });
        break;
      }
      case "restore": {
        this.spawnOpenSourceEffect("restore_glow", targetX, targetY, {
          ...common,
          startScale: 0.24,
          endScale: 1.28,
          alpha: 0.62,
          tint: tone.light,
          duration: this.ticks(780),
        });
        this.spawnOpenSourceEffect("blade_cut", targetX, targetY - 20, {
          ...common,
          delay: this.ticks(140),
          angle: direction * 14,
          startScale: 0.12,
          endScale: 0.72,
          alpha: 0.46,
          duration: this.ticks(620),
        });
        break;
      }
      case "ultimate": {
        this.spawnOpenSourceEffect("ultimate_star", targetX, targetY, {
          ...common,
          startScale: 0.28,
          endScale: 1.35,
          alpha: 0.76,
          tint: tone.light,
          duration: this.ticks(880),
        });
        this.spawnOpenSourceEffect("impact_spark", targetX, targetY, {
          ...common,
          delay: impactDelay,
          startScale: 0.2,
          endScale: 1.05,
          alpha: 0.88,
          tint: tone.main,
          duration: this.ticks(680),
        });
        this.spawnOpenSourceEffect("blade_cut", targetX, targetY - 24, {
          ...common,
          delay: impactDelay + 30,
          angle: direction * 22,
          startScale: 0.2,
          endScale: 0.98,
          alpha: 0.72,
          duration: this.ticks(620),
        });
        break;
      }
      default: {
        this.spawnOpenSourceEffect("blade_arc", targetX, targetY, {
          ...common,
          angle: direction * 24,
          startScale: 0.22,
          endScale: 0.72,
          alpha: 0.72,
        });
        this.spawnOpenSourceEffect("hit_spark", targetX, targetY + 6, {
          ...common,
          delay: impactDelay,
          startScale: 0.1,
          endScale: 0.5,
          alpha: 0.8,
        });
      }
    }
  }

  spawnOpenSourceEffect(name, x, y, options = {}) {
    const scene = this.scene;
    const textureKey = `${OPEN_SOURCE_VFX_KEY}${name}`;
    if (!scene?.textures?.exists?.(textureKey)) return null;
    const image = scene.add
      .image(x, y, textureKey)
      .setDepth(options.depth || 2100)
      .setTint(options.tint ?? 0xffffff)
      .setAlpha(0)
      .setAngle(options.angle || 0)
      .setScale(options.startScale ?? 0.2);
    image.setScale(
      options.startScaleX ?? options.startScale ?? 0.2,
      options.startScaleY ?? options.startScale ?? 0.2,
    );
    image.setBlendMode(
      this.engine?.BlendModes?.ADD ?? this.engine?.BlendModes?.SCREEN ?? 1,
    );
    this.effectSprites.add(image);
    this.openSourceVfxPlays += 1;
    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
      this.effectSprites.delete(image);
      image.destroy();
    };
    scene.tweens.add({
      targets: image,
      alpha: { from: 0, to: options.alpha ?? 0.7 },
      scaleX: options.endScaleX ?? options.endScale ?? 0.8,
      scaleY: options.endScaleY ?? options.endScale ?? 0.8,
      angle: (options.angle || 0) + (options.spin || 0),
      delay: options.delay || 0,
      duration: options.duration || this.ticks(520),
      hold: Math.max(45, (options.duration || this.ticks(520)) * 0.18),
      yoyo: true,
      ease: "Cubic.Out",
      onComplete: remove,
      onStop: remove,
    });
    return image;
  }

  setBattleUi(ui = null) {
    this.ui = ui;
    if (ui?.targetableUids) {
      this.targetableUids = new Set(ui.targetableUids);
      for (const actor of this.actors.values()) {
        actor.targetable = this.targetableUids.has(actor.uid);
      }
    }
    this.renderBattleInterface();
  }

  clearBattleInterface() {
    this.interfaceHitRects.clear();
    this.contextRect = null;
    this.chainRect = null;
    this.tutorialRect = null;
    this.commandRect = null;
    this.uiLayer?.removeAll?.(true);
    this.interfaceGraphics?.clear?.();
  }

  addInterfaceText(x, y, value, style = {}) {
    if (!this.scene?.add || !this.uiLayer) return null;
    const text = this.scene.add
      .text(x, y, String(value ?? ""), {
        fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
        fontSize: "13px",
        color: "#f0e8d7",
        ...style,
      })
      .setResolution?.(1);
    this.uiLayer.add(text);
    return text;
  }

  fitInterfaceText(value, maxWidth, style = {}) {
    const text = String(value ?? "");
    if (!this.scene?.add || !text || maxWidth <= 0) return "";
    const measure = this.scene.add
      .text(-1000, -1000, text, {
        fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
        fontSize: "13px",
        ...style,
      })
      .setResolution?.(1);
    const fullWidth = measure.width;
    measure.destroy();
    if (fullWidth <= maxWidth) return text;
    let low = 0;
    let high = text.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      const candidate = `${text.slice(0, middle).trimEnd()}…`;
      const probe = this.scene.add
        .text(-1000, -1000, candidate, {
          fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
          fontSize: "13px",
          ...style,
        })
        .setResolution?.(1);
      const fits = probe.width <= maxWidth;
      probe.destroy();
      if (fits) low = middle;
      else high = middle - 1;
    }
    return low > 0 ? `${text.slice(0, low).trimEnd()}…` : "…";
  }

  addInterfaceImage(x, y, url, width, height) {
    if (!this.scene?.add || !this.uiLayer || !url) return null;
    const key = assetKey(url);
    if (!this.scene.textures.exists(key)) return null;
    const image = this.scene.add
      .image(x, y, key)
      .setDisplaySize(width, height)
      .setOrigin(0.5, 0.5);
    this.uiLayer.add(image);
    return image;
  }

  addInterfaceHitArea(id, x, y, width, height, handler) {
    if (!this.scene?.add || !this.uiLayer || typeof handler !== "function") {
      return null;
    }
    const zone = this.scene.add
      .zone(x, y, width, height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on("pointerdown", (_pointer, _localX, _localY, event) => {
      event?.stopPropagation?.();
      handler();
    });
    this.uiLayer.add(zone);
    this.interfaceHitRects.set(id, { x, y, width, height });
    return zone;
  }

  drawInterfaceGlyph(graphics, kind, x, y, size, color, alpha = 1) {
    if (!graphics) return;
    const half = size / 2;
    graphics.lineStyle(Math.max(1.2, size * 0.09), color, alpha);
    graphics.fillStyle(color, alpha);
    if (kind === "shield") {
      graphics.beginPath();
      graphics.moveTo(x, y - half);
      graphics.lineTo(x + half * 0.82, y - half * 0.55);
      graphics.lineTo(x + half * 0.62, y + half * 0.5);
      graphics.lineTo(x, y + half);
      graphics.lineTo(x - half * 0.62, y + half * 0.5);
      graphics.lineTo(x - half * 0.82, y - half * 0.55);
      graphics.closePath();
      graphics.strokePath();
      graphics.lineBetween(x, y - half * 0.55, x, y + half * 0.48);
      return;
    }
    if (kind === "heal") {
      graphics.strokeCircle(x, y, half * 0.82);
      graphics.lineBetween(x - half * 0.42, y, x + half * 0.42, y);
      graphics.lineBetween(x, y - half * 0.42, x, y + half * 0.42);
      return;
    }
    if (kind === "ultimate" || kind === "chain") {
      const points = [];
      const spikes = kind === "ultimate" ? 8 : 6;
      for (let index = 0; index < spikes * 2; index += 1) {
        const radius = index % 2 === 0 ? half : half * 0.38;
        const angle = -Math.PI / 2 + (index * Math.PI) / spikes;
        points.push({
          x: x + Math.cos(angle) * radius,
          y: y + Math.sin(angle) * radius,
        });
      }
      graphics.beginPath();
      graphics.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
      graphics.closePath();
      graphics.strokePath();
      return;
    }
    if (kind === "target") {
      graphics.strokeCircle(x, y, half * 0.78);
      graphics.lineBetween(x - half, y, x - half * 0.45, y);
      graphics.lineBetween(x + half * 0.45, y, x + half, y);
      graphics.lineBetween(x, y - half, x, y - half * 0.45);
      graphics.lineBetween(x, y + half * 0.45, x, y + half);
      graphics.fillCircle(x, y, Math.max(1.2, size * 0.06));
      return;
    }
    if (kind === "bot") {
      graphics.strokeRoundedRect(
        x - half * 0.76,
        y - half * 0.58,
        half * 1.52,
        half * 1.18,
        3,
      );
      graphics.fillCircle(x - half * 0.3, y, half * 0.1);
      graphics.fillCircle(x + half * 0.3, y, half * 0.1);
      graphics.lineBetween(x, y - half * 0.58, x, y - half);
      return;
    }
    graphics.lineBetween(x - half * 0.62, y + half * 0.62, x + half * 0.5, y - half * 0.72);
    graphics.lineBetween(x - half * 0.72, y + half * 0.4, x + half * 0.32, y - half * 0.88);
    graphics.lineBetween(x - half * 0.15, y + half * 0.82, x + half * 0.82, y + half * 0.12);
  }

  renderBattleInterface() {
    if (!this.scene?.add || !this.phaserReady || !this.uiLayer) return;
    this.clearBattleInterface();
    if (!this.ui) {
      this.refreshProxyLayout();
      return;
    }
    const layout = this.getInterfaceLayout();
    if (this.ui.menu?.open) {
      this.drawInterfaceMenu(layout);
      this.refreshProxyLayout();
      return;
    }
    this.drawEngineHeader(layout);
    this.drawBattleContext(layout);
    if (this.ui.result?.lines?.length) this.drawInterfaceResult(layout);
    if (layout.compact) this.drawCompactCommandRail(layout);
    else this.drawDesktopCommandRail(layout);
    if (this.ui.tutorialPending) this.drawInterfaceTutorial(layout);
    this.refreshProxyLayout();
  }

  drawEngineHeader(layout) {
    const graphics = this.interfaceGraphics;
    const header = this.ui?.header || {};
    const compact = layout.compact;
    const height = compact ? 56 : 62;
    graphics.fillStyle(UI_COLORS.ink, 0.76);
    graphics.fillRect(0, 0, this.width, height);
    graphics.lineStyle(1, UI_COLORS.line, 0.48);
    graphics.lineBetween(0, height - 0.5, this.width, height - 0.5);

    const buttonSize = compact ? 32 : 36;
    const menuX = compact ? 8 : 14;
    const menuY = Math.round((height - buttonSize) / 2);
    graphics.fillStyle(UI_COLORS.panelRaised, 0.78);
    graphics.fillRoundedRect(menuX, menuY, buttonSize, buttonSize, 3);
    graphics.lineStyle(1, UI_COLORS.line, 0.8);
    graphics.strokeRoundedRect(menuX + 0.5, menuY + 0.5, buttonSize - 1, buttonSize - 1, 3);
    for (let index = -1; index <= 1; index += 1) {
      graphics.lineBetween(
        menuX + 10,
        menuY + buttonSize / 2 + index * 5,
        menuX + buttonSize - 10,
        menuY + buttonSize / 2 + index * 5,
      );
    }
    this.addInterfaceHitArea(
      "header:menu",
      menuX,
      menuY,
      buttonSize,
      buttonSize,
      this.callbacks.onMenu,
    );

    const titleX = menuX + buttonSize + 10;
    const compactControlsWidth = 218;
    const titleWidth = Math.max(
      64,
      (compact ? this.width - compactControlsWidth : this.width) - titleX - 10,
    );
    this.addInterfaceText(
      titleX,
      compact ? 7 : 8,
      compact
        ? this.fitInterfaceText(header.chapterLabel || "", titleWidth, {
            fontSize: "8px",
          })
        : header.chapterLabel || "",
      {
        fontSize: compact ? "8px" : "9px",
        color: "#8f856f",
      },
    );
    this.addInterfaceText(
      titleX,
      compact ? 20 : 23,
      compact
        ? this.fitInterfaceText(header.title || "战阵", titleWidth, {
            fontFamily: '"Songti SC", STSong, serif',
            fontSize: "13px",
            fontStyle: "bold",
          })
        : header.title || "战阵",
      {
        fontFamily: '"Songti SC", STSong, serif',
        fontSize: compact ? "13px" : "15px",
        fontStyle: "bold",
        color: "#f0e8d7",
      },
    );

    if (compact) {
      const autoX = this.width - compactControlsWidth;
      const tacticX = autoX + 37;
      const speedX = tacticX + 37;
      const soundX = speedX + 71;
      const roundX = soundX + 35;
      this.drawHeaderIconButton(
        graphics,
        autoX,
        menuY,
        32,
        "bot",
        header.autoBattle ? UI_COLORS.bronze : UI_COLORS.paperMuted,
        "header:auto",
        this.callbacks.onToggleAuto,
        header.autoBattle,
      );
      this.drawHeaderIconButton(
        graphics,
        tacticX,
        menuY,
        32,
        "tactic",
        UI_COLORS.bronze,
        "header:tactic",
        this.callbacks.onCycleTactic,
      );
      this.addInterfaceText(tacticX + 8, menuY + buttonSize - 8, header.tacticShort || "衡", {
        fontSize: "7px",
        color: "#d7bc7d",
      });
      graphics.fillStyle(UI_COLORS.panelRaised, 0.82);
      graphics.fillRoundedRect(speedX, menuY, 66, buttonSize, 3);
      graphics.lineStyle(1, UI_COLORS.line, 0.78);
      graphics.strokeRoundedRect(speedX + 0.5, menuY + 0.5, 65, buttonSize - 1, 3);
      [1, 2, 4].forEach((speed, index) => {
        const x = speedX + 2 + index * 21;
        if (header.speed === speed) {
          graphics.fillStyle(UI_COLORS.tealDim, 0.9);
          graphics.fillRoundedRect(x, menuY + 3, 19, buttonSize - 6, 2);
        }
        this.addInterfaceText(x + 3, menuY + 10, `${speed}x`, {
          fontSize: "8px",
          color: header.speed === speed ? "#f0e8d7" : "#8f856f",
        });
        this.addInterfaceHitArea(
          `header:speed:${speed}`,
          x,
          menuY + 3,
          19,
          buttonSize - 6,
          () => this.callbacks.onSetSpeed?.(speed),
        );
      });
      this.drawHeaderIconButton(
        graphics,
        soundX,
        menuY,
        30,
        "sound",
        header.sound ? UI_COLORS.paper : UI_COLORS.paperMuted,
        "header:sound",
        this.callbacks.onToggleSound,
      );
      this.addInterfaceText(roundX + 3, menuY + 5, "回", {
        fontSize: "7px",
        color: "#8f856f",
      });
      this.addInterfaceText(roundX + 3, menuY + 17, String(header.round || 1).padStart(2, "0"), {
        fontFamily: '"Songti SC", STSong, serif',
        fontSize: "13px",
        color: "#d7bc7d",
      });
      return;
    }

    const controlsWidth = 352;
    let controlsX = Math.max(titleX + 190, Math.round(this.width * 0.39));
    controlsX = Math.min(controlsX, this.width - controlsWidth - 340);
    controlsX = Math.max(titleX + 190, controlsX);
    const autoWidth = 94;
    this.drawHeaderTextButton(
      graphics,
      controlsX,
      menuY,
      autoWidth,
      buttonSize,
      "bot",
      header.autoBattle ? "自动中" : "自动战斗",
      header.autoBattle,
      "header:auto",
      this.callbacks.onToggleAuto,
    );
    controlsX += autoWidth + 7;
    this.drawHeaderIconButton(
      graphics,
      controlsX,
      menuY,
      buttonSize,
      "tactic",
      UI_COLORS.bronze,
      "header:tactic",
      this.callbacks.onCycleTactic,
    );
    this.addInterfaceText(controlsX + 7, menuY + buttonSize - 8, header.tacticShort || "衡", {
      fontSize: "7px",
      color: "#d7bc7d",
    });
    controlsX += buttonSize + 7;
    const speedWidth = 90;
    graphics.fillStyle(UI_COLORS.panelRaised, 0.8);
    graphics.fillRoundedRect(controlsX, menuY, speedWidth, buttonSize, 3);
    graphics.lineStyle(1, UI_COLORS.line, 0.78);
    graphics.strokeRoundedRect(controlsX + 0.5, menuY + 0.5, speedWidth - 1, buttonSize - 1, 3);
    [1, 2, 4].forEach((speed, index) => {
      const x = controlsX + 2 + index * 29;
      if (header.speed === speed) {
        graphics.fillStyle(UI_COLORS.tealDim, 0.9);
        graphics.fillRoundedRect(x, menuY + 3, 27, buttonSize - 6, 2);
      }
      this.addInterfaceText(x + 8, menuY + 10, `${speed}x`, {
        fontSize: "8px",
        color: header.speed === speed ? "#f0e8d7" : "#8f856f",
      });
      this.addInterfaceHitArea(
        `header:speed:${speed}`,
        x,
        menuY + 3,
        27,
        buttonSize - 6,
        () => this.callbacks.onSetSpeed?.(speed),
      );
    });
    controlsX += speedWidth + 7;
    this.drawHeaderIconButton(
      graphics,
      controlsX,
      menuY,
      buttonSize,
      "sound",
      header.sound ? UI_COLORS.paper : UI_COLORS.paperMuted,
      "header:sound",
      this.callbacks.onToggleSound,
    );

    const roundX = this.width - 320;
    this.addInterfaceText(roundX, menuY + 2, "回合", {
      fontSize: "8px",
      color: "#8f856f",
    });
    this.addInterfaceText(roundX, menuY + 14, String(header.round || 1).padStart(2, "0"), {
      fontFamily: '"Songti SC", STSong, serif',
      fontSize: "19px",
      color: "#d7bc7d",
    });
    const turnOrder = header.turnOrder || [];
    const orderStart = this.width - 258;
    this.addInterfaceText(orderStart, menuY + 11, "行动", {
      fontSize: "8px",
      color: "#8f856f",
    });
    turnOrder.slice(0, 5).forEach((unit, index) => {
      const x = orderStart + 31 + index * 32;
      const y = menuY + buttonSize / 2;
      graphics.fillStyle(UI_COLORS.panelRaised, 1);
      graphics.fillCircle(x, y, 12);
      graphics.lineStyle(
        index === 0 ? 1.5 : 1,
        index === 0 ? UI_COLORS.bronze : unit.side === "hero" ? UI_COLORS.tealDim : UI_COLORS.cinnabar,
        0.9,
      );
      graphics.strokeCircle(x, y, 12);
      this.addInterfaceImage(x, y, unit.portrait || unit.sprite, 20, 20);
    });
  }

  drawHeaderIconButton(graphics, x, y, size, kind, color, id, handler, active = false) {
    graphics.fillStyle(active ? UI_COLORS.bronzeDim : UI_COLORS.panelRaised, active ? 0.2 : 0.82);
    graphics.fillRoundedRect(x, y, size, size, 3);
    graphics.lineStyle(1, active ? UI_COLORS.bronze : UI_COLORS.line, active ? 0.86 : 0.72);
    graphics.strokeRoundedRect(x + 0.5, y + 0.5, size - 1, size - 1, 3);
    this.addInterfaceHitArea(id, x, y, size, size, handler);
    if (kind === "sound") {
      graphics.lineStyle(1.3, color, 0.9);
      graphics.beginPath();
      graphics.moveTo(x + size * 0.3, y + size * 0.43);
      graphics.lineTo(x + size * 0.42, y + size * 0.43);
      graphics.lineTo(x + size * 0.54, y + size * 0.32);
      graphics.lineTo(x + size * 0.54, y + size * 0.68);
      graphics.lineTo(x + size * 0.42, y + size * 0.57);
      graphics.lineTo(x + size * 0.3, y + size * 0.57);
      graphics.closePath();
      graphics.strokePath();
      graphics.arc(x + size * 0.55, y + size / 2, size * 0.18, -0.8, 0.8);
      graphics.strokePath();
      return;
    }
    if (kind === "tactic") {
      graphics.lineStyle(1.2, color, 0.9);
      graphics.strokeCircle(x + size / 2, y + size / 2, size * 0.22);
      graphics.lineBetween(x + size / 2, y + size * 0.23, x + size / 2, y + size * 0.33);
      graphics.lineBetween(x + size / 2, y + size * 0.67, x + size / 2, y + size * 0.77);
      graphics.lineBetween(x + size * 0.23, y + size / 2, x + size * 0.33, y + size / 2);
      graphics.lineBetween(x + size * 0.67, y + size / 2, x + size * 0.77, y + size / 2);
      return;
    }
    this.drawInterfaceGlyph(
      graphics,
      "bot",
      x + size / 2,
      y + size / 2,
      size * 0.48,
      color,
    );
  }

  drawHeaderTextButton(
    graphics,
    x,
    y,
    width,
    height,
    kind,
    label,
    active,
    id,
    handler,
  ) {
    graphics.fillStyle(active ? UI_COLORS.bronzeDim : UI_COLORS.panelRaised, active ? 0.2 : 0.82);
    graphics.fillRoundedRect(x, y, width, height, 3);
    graphics.lineStyle(1, active ? UI_COLORS.bronze : UI_COLORS.line, active ? 0.86 : 0.72);
    graphics.strokeRoundedRect(x + 0.5, y + 0.5, width - 1, height - 1, 3);
    this.drawInterfaceGlyph(
      graphics,
      kind,
      x + 18,
      y + height / 2,
      17,
      active ? UI_COLORS.bronze : UI_COLORS.paperMuted,
    );
    this.addInterfaceText(x + 33, y + 11, label, {
      fontSize: "9px",
      color: active ? "#d7bc7d" : "#c5b89e",
    });
    this.addInterfaceHitArea(id, x, y, width, height, handler);
  }

  battleContextTone(tone) {
    return (
      {
        cinnabar: UI_COLORS.cinnabar,
        teal: UI_COLORS.teal,
        gold: UI_COLORS.bronze,
        blue: UI_COLORS.blue,
      }[tone] || UI_COLORS.teal
    );
  }

  battleContextChips(context, compact) {
    const bonds = context?.bonds || [];
    const doctrines = context?.doctrines || [];
    if (compact) {
      return [
        bonds.length
          ? {
              label:
                bonds.length === 1 ? `契·${bonds[0].name}` : `契 ${bonds.length}`,
              tone: bonds[0]?.tone || "gold",
            }
          : null,
        doctrines.length
          ? {
              label:
                doctrines.length === 1
                  ? `命·${doctrines[0].name}`
                  : `命 ${doctrines.length}`,
              tone: doctrines[0]?.tone || "teal",
            }
          : null,
      ].filter(Boolean);
    }
    return [
      ...bonds.map((bond) => ({
        label: `契·${bond.name}`,
        tone: bond.tone || "gold",
      })),
      ...doctrines.map((doctrine) => ({
        label: `命·${doctrine.name}`,
        tone: doctrine.tone || "teal",
      })),
    ];
  }

  drawBattleContext(layout) {
    const graphics = this.interfaceGraphics;
    const viewport = layout.viewport;
    const compact = layout.compact;
    const context = this.ui?.context || {};
    const specialRule = context.specialRule;
    const tone = this.battleContextTone(specialRule?.tone || "teal");
    const x = compact ? 8 : viewport.x - 4;
    const y = compact ? 62 : 68;
    const width = compact ? Math.max(1, this.width - 16) : viewport.width + 8;
    const height = compact ? 58 : 48;
    const padding = compact ? 10 : 12;
    this.contextRect = { x, y, width, height };

    graphics.fillStyle(UI_COLORS.ink, 0.88);
    graphics.fillRoundedRect(x, y, width, height, 4);
    graphics.lineStyle(1, tone, 0.62);
    graphics.strokeRoundedRect(x + 0.5, y + 0.5, width - 1, height - 1, 4);
    graphics.fillStyle(tone, 0.92);
    graphics.fillRect(x, y + 1, 2, height - 2);

    const chainWidth = compact ? Math.min(104, width * 0.3) : 138;
    const chainX = x + width - chainWidth - padding;
    const chainPaths = this.ui?.chain?.paths || [];
    this.chainRect = {
      x: chainX,
      y: y + 2,
      width: chainWidth,
      height: 22,
    };
    for (let index = 0; index < 3; index += 1) {
      const path = chainPaths[index];
      const pathTone = this.battleContextTone(path?.tone || "gold");
      graphics.fillStyle(path ? pathTone : UI_COLORS.line, path ? 0.92 : 0.5);
      graphics.fillCircle(chainX + index * 14, y + 13, compact ? 3.7 : 4.2);
    }
    this.addInterfaceText(
      chainX + 47,
      y + (compact ? 6 : 7),
      this.ui?.chain?.hint || "星命未成",
      {
        fontSize: compact ? "8px" : "9px",
        color: this.ui?.chain?.ready ? "#d7bc7d" : "#9c927d",
      },
    );

    const ruleLabel = specialRule?.label || "战阵规则";
    const ruleName = specialRule?.name || "常规交锋";
    const labelText = this.addInterfaceText(x + padding, y + 6, ruleLabel, {
      fontSize: compact ? "7px" : "8px",
      color: `#${tone.toString(16).padStart(6, "0")}`,
    });
    const nameX = x + padding + (labelText?.width || 46) + 8;
    this.addInterfaceText(
      nameX,
      y + (compact ? 4 : 5),
      this.fitInterfaceText(
        ruleName,
        Math.max(42, chainX - nameX - 8),
        {
          fontFamily: '"Songti SC", STSong, serif',
          fontSize: compact ? "12px" : "13px",
          fontStyle: "bold",
        },
      ),
      {
        fontFamily: '"Songti SC", STSong, serif',
        fontSize: compact ? "12px" : "13px",
        fontStyle: "bold",
        color: "#f0e8d7",
      },
    );

    const chips = this.battleContextChips(context, compact);
    const chipAreaWidth = compact ? Math.min(92, width * 0.28) : width * 0.52;
    let chipX = x + width - padding;
    let hiddenChips = 0;
    for (let index = chips.length - 1; index >= 0; index -= 1) {
      const chip = chips[index];
      const chipWidth = Math.min(
        compact ? 88 : 138,
        20 + String(chip.label).length * (compact ? 8 : 7),
      );
      if (chipX - chipWidth < x + width - padding - chipAreaWidth) {
        hiddenChips = index + 1;
        break;
      }
      chipX -= chipWidth;
      const chipTone = this.battleContextTone(chip.tone);
      graphics.fillStyle(UI_COLORS.panelRaised, 0.92);
      graphics.fillRoundedRect(chipX, y + (compact ? 33 : 29), chipWidth, 19, 3);
      graphics.lineStyle(1, chipTone, 0.5);
      graphics.strokeRoundedRect(
        chipX + 0.5,
        y + (compact ? 33.5 : 29.5),
        chipWidth - 1,
        18,
        3,
      );
      this.addInterfaceText(
        chipX + 7,
        y + (compact ? 36 : 32),
        this.fitInterfaceText(chip.label, chipWidth - 13, {
          fontSize: compact ? "7px" : "8px",
        }),
        {
          fontSize: compact ? "7px" : "8px",
          color: `#${chipTone.toString(16).padStart(6, "0")}`,
        },
      );
      chipX -= 5;
    }
    if (hiddenChips) {
      this.addInterfaceText(
        chipX - 18,
        y + (compact ? 36 : 32),
        `+${hiddenChips}`,
        {
          fontSize: "8px",
          color: "#9c927d",
        },
      );
    }

    const descriptionX = x + padding;
    const descriptionY = y + (compact ? 37 : 31);
    const descriptionWidth = Math.max(
      compact ? 104 : 220,
      width - padding * 2 - chipAreaWidth - 12,
    );
    this.addInterfaceText(
      descriptionX,
      descriptionY,
      this.fitInterfaceText(
        specialRule?.desc || "无额外战阵规则，留意敌方护势与出手顺序。",
        descriptionWidth,
        {
          fontSize: compact ? "8px" : "9px",
        },
      ),
      {
        fontSize: compact ? "8px" : "9px",
        color: "#b9af99",
      },
    );
  }

  drawInterfaceMenu(layout) {
    const graphics = this.interfaceGraphics;
    const menu = this.ui.menu;
    const compact = layout.compact;
    const viewport = layout.viewport;
    const width = Math.min(compact ? viewport.width - 28 : 420, viewport.width - 24);
    const height = compact ? 238 : 246;
    const x = (this.width - width) / 2;
    const y = clamp(
      (this.height - height) / 2,
      76,
      Math.max(76, this.height - height - 18),
    );
    const openedAt = this.scene?.time?.now ?? performance.now();

    graphics.fillStyle(0x020505, 0.74);
    graphics.fillRect(0, 0, this.width, this.height);
    const dismissMenu = () => {
      const now = this.scene?.time?.now ?? performance.now();
      if (now - openedAt < 80) return;
      this.callbacks.onCloseMenu?.();
    };
    this.addInterfaceHitArea("menu:dismiss:top", 0, 0, this.width, y, dismissMenu);
    this.addInterfaceHitArea(
      "menu:dismiss:left",
      0,
      y,
      x,
      height,
      dismissMenu,
    );
    this.addInterfaceHitArea(
      "menu:dismiss:right",
      x + width,
      y,
      this.width - x - width,
      height,
      dismissMenu,
    );
    this.addInterfaceHitArea(
      "menu:dismiss:bottom",
      x,
      y + height,
      width,
      this.height - y - height,
      dismissMenu,
    );

    graphics.fillStyle(UI_COLORS.ink, 0.98);
    graphics.fillRoundedRect(x, y, width, height, 6);
    graphics.lineStyle(1, UI_COLORS.bronzeDim, 0.9);
    graphics.strokeRoundedRect(x + 0.5, y + 0.5, width - 1, height - 1, 6);
    graphics.fillStyle(UI_COLORS.bronze, 0.9);
    graphics.fillRect(x, y + 1, 3, height - 2);

    graphics.lineStyle(1, UI_COLORS.line, 0.7);
    graphics.strokeCircle(x + 34, y + 38, 15);
    graphics.lineBetween(x + 27, y + 38, x + 41, y + 38);
    graphics.lineBetween(x + 34, y + 31, x + 34, y + 45);
    this.addInterfaceText(x + 61, y + 18, menu.title || "战阵暂停", {
      fontFamily: '"Songti SC", STSong, serif',
      fontSize: compact ? "21px" : "24px",
      fontStyle: "bold",
      color: "#f0e8d7",
    });
    this.addInterfaceText(x + 62, y + 52, menu.note || "可稍后继续迎战", {
      fontSize: "10px",
      color: "#9c927d",
      wordWrap: { width: width - 92, useAdvancedWrap: true },
    });

    const buttonX = x + 20;
    const buttonWidth = width - 40;
    const primaryY = y + 92;
    graphics.fillStyle(UI_COLORS.tealDim, 0.92);
    graphics.fillRoundedRect(buttonX, primaryY, buttonWidth, 48, 4);
    graphics.lineStyle(1, UI_COLORS.teal, 0.72);
    graphics.strokeRoundedRect(
      buttonX + 0.5,
      primaryY + 0.5,
      buttonWidth - 1,
      47,
      4,
    );
    this.drawInterfaceGlyph(
      graphics,
      "sword",
      buttonX + 28,
      primaryY + 24,
      17,
      UI_COLORS.paper,
    );
    this.addInterfaceText(buttonX + 50, primaryY + 14, menu.resumeLabel || "继续迎战", {
      fontFamily: '"Songti SC", STSong, serif',
      fontSize: "14px",
      color: "#f0e8d7",
    });
    this.addInterfaceHitArea(
      "menu:resume",
      buttonX,
      primaryY,
      buttonWidth,
      48,
      this.callbacks.onCloseMenu,
    );

    const secondaryY = primaryY + 60;
    graphics.fillStyle(UI_COLORS.panelRaised, 0.88);
    graphics.fillRoundedRect(buttonX, secondaryY, buttonWidth, 46, 4);
    graphics.lineStyle(1, UI_COLORS.line, 0.8);
    graphics.strokeRoundedRect(
      buttonX + 0.5,
      secondaryY + 0.5,
      buttonWidth - 1,
      45,
      4,
    );
    this.addInterfaceText(buttonX + 24, secondaryY + 14, menu.retreatLabel || "退回营寨", {
      fontFamily: '"Songti SC", STSong, serif',
      fontSize: "13px",
      color: "#c5b89e",
    });
    this.addInterfaceHitArea(
      "menu:retreat",
      buttonX,
      secondaryY,
      buttonWidth,
      46,
      this.callbacks.onRetreat,
    );

    graphics.lineStyle(1, UI_COLORS.line, 0.5);
    graphics.lineBetween(buttonX, secondaryY + 66, buttonX + buttonWidth, secondaryY + 66);
    this.addInterfaceText(
      x + (width - 112) / 2,
      secondaryY + 76,
      "关闭后从战前继续",
      {
        fontSize: "9px",
        color: "#6f7569",
      },
    );
  }

  drawInterfaceResult(layout) {
    const graphics = this.interfaceGraphics;
    const ui = this.ui;
    const viewport = layout.viewport;
    const lines = ui.result.lines.slice(0, layout.compact ? 1 : 2);
    const width = Math.min(layout.compact ? viewport.width - 28 : 440, viewport.width - 24);
    const height = layout.compact ? 40 : 34 + lines.length * 18;
    const x = viewport.x + (viewport.width - width) / 2;
    const y = viewport.y + (layout.compact ? 42 : 46);
    const tone =
      ui.result.kind === "heal"
        ? UI_COLORS.teal
        : ui.result.kind === "combo"
          ? UI_COLORS.bronze
          : UI_COLORS.cinnabar;
    graphics.fillStyle(UI_COLORS.ink, 0.9);
    graphics.fillRoundedRect(x, y, width, height, 5);
    graphics.lineStyle(1, tone, 0.8);
    graphics.strokeRoundedRect(x + 0.5, y + 0.5, width - 1, height - 1, 5);
    graphics.fillStyle(tone, 0.95);
    graphics.fillRect(x, y, 3, height);
    this.drawInterfaceGlyph(
      graphics,
      ui.result.kind === "heal" ? "heal" : ui.result.kind === "combo" ? "chain" : "sword",
      x + 20,
      y + 18,
      15,
      tone,
    );
    lines.forEach((line, index) => {
      this.addInterfaceText(x + 36, y + 10 + index * 17, line, {
        fontFamily: '"Songti SC", STSong, serif',
        fontSize: layout.compact ? "10px" : "11px",
        color: index === 0 ? "#f0e8d7" : "#c5b89e",
        wordWrap: { width: width - 48, useAdvancedWrap: true },
      });
    });
  }

  drawInterfaceTutorial(layout) {
    const graphics = this.interfaceGraphics;
    const viewport = layout.viewport;
    const width = Math.min(360, viewport.width - 36);
    const height = 154;
    const x = viewport.x + (viewport.width - width) / 2;
    const y = viewport.y + Math.max(76, viewport.height * 0.24);
    this.tutorialRect = { x, y, width, height };
    graphics.fillStyle(UI_COLORS.ink, 0.95);
    graphics.fillRoundedRect(x, y, width, height, 6);
    graphics.lineStyle(1, UI_COLORS.bronzeDim, 0.9);
    graphics.strokeRoundedRect(x + 0.5, y + 0.5, width - 1, height - 1, 6);
    graphics.fillStyle(UI_COLORS.bronze, 0.9);
    graphics.fillRect(x, y, 3, height);
    this.addInterfaceText(x + 18, y + 14, "两步出手", {
      fontFamily: '"Songti SC", STSong, serif',
      fontSize: "18px",
      color: "#f0e8d7",
    });
    this.addInterfaceText(x + 18, y + 47, "1", {
      fontFamily: '"Songti SC", STSong, serif',
      fontSize: "13px",
      color: "#d7bc7d",
    });
    this.addInterfaceText(x + 39, y + 45, "选择招式", {
      fontSize: "12px",
      color: "#dfd3bb",
    });
    this.addInterfaceText(x + 18, y + 72, "2", {
      fontFamily: '"Songti SC", STSong, serif',
      fontSize: "13px",
      color: "#d7bc7d",
    });
    this.addInterfaceText(x + 39, y + 70, "点击发亮的目标", {
      fontSize: "12px",
      color: "#dfd3bb",
    });
    graphics.lineStyle(1, UI_COLORS.tealDim, 0.6);
    graphics.lineBetween(x + 18, y + 96, x + width - 18, y + 96);
    this.addInterfaceText(x + 18, y + 104, "路数克制会提高伤害与破势", {
      fontSize: "10px",
      color: "#9c927d",
    });
    const buttonX = x + width - 100;
    const buttonY = y + 113;
    graphics.fillStyle(UI_COLORS.tealDim, 0.9);
    graphics.fillRoundedRect(buttonX, buttonY, 82, 27, 3);
    this.addInterfaceText(buttonX + 14, buttonY + 6, "开始迎敌", {
      fontFamily: '"Songti SC", STSong, serif',
      fontSize: "11px",
      color: "#f0e8d7",
    });
    this.addInterfaceHitArea(
      "tutorial-start",
      buttonX,
      buttonY,
      82,
      27,
      this.callbacks.onDismissTutorial,
    );
  }

  drawDesktopCommandRail(layout) {
    const graphics = this.interfaceGraphics;
    const rail = layout.rail;
    const ui = this.ui;
    this.commandRect = { ...rail };
    graphics.fillStyle(UI_COLORS.ink, 0.82);
    graphics.fillRect(rail.x, rail.y, rail.width, rail.height);
    graphics.lineStyle(1, UI_COLORS.line, 0.5);
    graphics.lineBetween(rail.x + 0.5, rail.y, rail.x + 0.5, rail.y + rail.height);
    graphics.lineBetween(
      rail.x + 12,
      rail.y + 0.5,
      rail.x + rail.width,
      rail.y + 0.5,
    );
    graphics.fillStyle(UI_COLORS.bronze, 0.86);
    graphics.fillRect(rail.x, rail.y, 2, Math.min(126, rail.height));

    const actor = ui.actor;
    const padding = 14;
    const portraitSize = 58;
    if (actor) {
      graphics.fillStyle(UI_COLORS.panelRaised, 1);
      graphics.fillRoundedRect(rail.x + padding, rail.y + padding, portraitSize, 66, 3);
      graphics.lineStyle(1, actor.side === "hero" ? UI_COLORS.tealDim : UI_COLORS.cinnabar, 0.8);
      graphics.strokeRoundedRect(
        rail.x + padding + 0.5,
        rail.y + padding + 0.5,
        portraitSize - 1,
        65,
        3,
      );
      this.addInterfaceImage(
        rail.x + padding + portraitSize / 2,
        rail.y + padding + 33,
        actor.portrait || actor.sprite,
        portraitSize - 6,
        60,
      );
      const actorX = rail.x + padding + portraitSize + 12;
      this.addInterfaceText(actorX, rail.y + 14, actor.name || "战阵", {
        fontFamily: '"Songti SC", STSong, serif',
        fontSize: "18px",
        fontStyle: "bold",
        color: "#f0e8d7",
      });
      this.addInterfaceText(
        actorX,
        rail.y + 41,
        `${actor.rowName || "战阵"} · ${actor.pathName || "未知"} · Lv.${actor.level || 1}`,
        {
          fontSize: "10px",
          color: "#9c927d",
        },
      );
      graphics.fillStyle(UI_COLORS.bronze, 0.92);
      graphics.fillCircle(rail.x + rail.width - 45, rail.y + 30, 12);
      this.addInterfaceText(rail.x + rail.width - 52, rail.y + 22, "气", {
        fontFamily: '"Songti SC", STSong, serif',
        fontSize: "11px",
        color: "#07100f",
      });
      this.addInterfaceText(
        rail.x + rail.width - 34,
        rail.y + 22,
        String(actor.yiqi ?? 0),
        {
          fontFamily: '"Songti SC", STSong, serif',
          fontSize: "13px",
          color: "#d7bc7d",
        },
      );
    }

    const stepY = rail.y + 92;
    this.drawInterfaceStep(graphics, rail.x + padding, stepY, 1, "选招", ui.step === 1);
    this.drawInterfaceStep(
      graphics,
      rail.x + padding + (rail.width - padding * 2) / 2,
      stepY,
      2,
      "选目标",
      ui.step === 2,
    );
    if (ui.step === 2) {
      this.addInterfaceText(rail.x + padding, stepY + 30, "选择发亮目标", {
        fontFamily: '"Songti SC", STSong, serif',
        fontSize: "12px",
        color: "#d7bc7d",
      });
      const cancelX = rail.x + rail.width - padding - 54;
      graphics.lineStyle(1, UI_COLORS.line, 0.8);
      graphics.strokeRoundedRect(cancelX, stepY + 27, 54, 22, 3);
      this.addInterfaceText(cancelX + 14, stepY + 31, "取消", {
        fontSize: "9px",
        color: "#9c927d",
      });
      this.addInterfaceHitArea(
        "cancel-target",
        cancelX,
        stepY + 27,
        54,
        22,
        this.callbacks.onCancelTarget,
      );
    }

    let cursorY = stepY + 62;
    if (ui.chain?.ready) {
      const chainHeight = 50;
      graphics.fillStyle(UI_COLORS.bronzeDim, 0.17);
      graphics.fillRoundedRect(
        rail.x + padding,
        cursorY,
        rail.width - padding * 2,
        chainHeight,
        4,
      );
      graphics.lineStyle(1, UI_COLORS.bronze, 0.76);
      graphics.strokeRoundedRect(
        rail.x + padding + 0.5,
        cursorY + 0.5,
        rail.width - padding * 2 - 1,
        chainHeight - 1,
        4,
      );
      this.drawInterfaceGlyph(
        graphics,
        "chain",
        rail.x + padding + 26,
        cursorY + 27,
        22,
        UI_COLORS.bronze,
      );
      this.addInterfaceText(rail.x + padding + 48, cursorY + 10, ui.chain.name || "星命合击", {
        fontFamily: '"Songti SC", STSong, serif',
        fontSize: "13px",
        color: "#d7bc7d",
      });
      this.addInterfaceText(rail.x + padding + 48, cursorY + 30, "三路星火同发", {
        fontSize: "9px",
        color: "#9c927d",
      });
      this.addInterfaceText(rail.x + rail.width - padding - 28, cursorY + 19, "发动", {
        fontSize: "10px",
        color: "#f0e8d7",
      });
      this.addInterfaceHitArea(
        "chain-attack",
        rail.x + padding,
        cursorY,
        rail.width - padding * 2,
        chainHeight,
        this.callbacks.onChainAttack,
      );
      cursorY += chainHeight + 10;
    }

    const skills = ui.skills || [];
    if (ui.autoBattle) {
      this.drawInterfaceAutoState(graphics, rail.x + padding, cursorY, rail.width - padding * 2);
      cursorY += 44;
    } else if (!skills.length) {
      graphics.fillStyle(UI_COLORS.panel, 0.86);
      graphics.fillRoundedRect(
        rail.x + padding,
        cursorY,
        rail.width - padding * 2,
        Math.min(120, rail.height - (cursorY - rail.y) - 90),
        4,
      );
      this.addInterfaceText(
        rail.x + padding + 16,
        cursorY + 18,
        ui.kind === "enemy" ? "敌方正在行动" : "正在整理战阵",
        {
          fontFamily: '"Songti SC", STSong, serif',
          fontSize: "14px",
          color: "#c5b89e",
        },
      );
    }
    if (skills.length) {
      const columns = skills.length > 1 ? 2 : 1;
      const gap = 6;
      const rows = Math.ceil(skills.length / columns);
      const skillAreaBottom = rail.y + rail.height - 78;
      const skillAreaHeight = Math.max(56, skillAreaBottom - cursorY);
      const tileHeight = clamp(
        Math.floor((skillAreaHeight - gap * (rows - 1)) / Math.max(1, rows)),
        56,
        72,
      );
      const tileWidth =
        (rail.width - padding * 2 - gap * (columns - 1)) / columns;
      skills.forEach((skill, index) => {
        const row = Math.floor(index / columns);
        const column = index % columns;
        const x = rail.x + padding + column * (tileWidth + gap);
        const y = cursorY + row * (tileHeight + gap);
        if (y + tileHeight > skillAreaBottom) return;
        this.drawSkillTile(graphics, skill, x, y, tileWidth, tileHeight);
      });
    }

    const footerY = rail.y + rail.height - 70;
    graphics.lineStyle(1, UI_COLORS.line, 0.5);
    graphics.lineBetween(
      rail.x + padding,
      footerY,
      rail.x + rail.width - padding,
      footerY,
    );
    const tags = (ui.statusTags || []).slice(0, 3);
    let tagX = rail.x + padding;
    if (!tags.length) {
      this.addInterfaceText(tagX, footerY + 12, "无异常状态", {
        fontSize: "9px",
        color: "#6f7569",
      });
    }
    tags.forEach((tag) => {
      const width = Math.min(94, 30 + String(tag.label || "").length * 10);
      graphics.fillStyle(UI_COLORS.panelRaised, 0.92);
      graphics.fillRoundedRect(tagX, footerY + 8, width, 22, 3);
      graphics.lineStyle(1, tag.tone === "bad" ? UI_COLORS.cinnabar : UI_COLORS.tealDim, 0.55);
      graphics.strokeRoundedRect(tagX + 0.5, footerY + 8.5, width - 1, 21, 3);
      this.addInterfaceText(tagX + 8, footerY + 12, tag.label || "状态", {
        fontSize: "9px",
        color: tag.tone === "bad" ? "#df8877" : "#91b4ae",
      });
      tagX += width + 5;
    });
    if (ui.autoBattle) {
      this.addInterfaceText(rail.x + rail.width - padding - 72, footerY + 12, "自动交战中", {
        fontSize: "9px",
        color: "#d7bc7d",
      });
    }
  }

  drawInterfaceStep(graphics, x, y, number, label, active) {
    graphics.fillStyle(active ? UI_COLORS.bronze : UI_COLORS.panelRaised, active ? 0.94 : 0.8);
    graphics.fillCircle(x + 10, y + 10, 10);
    graphics.lineStyle(1, active ? UI_COLORS.bronze : UI_COLORS.line, 0.9);
    graphics.strokeCircle(x + 10, y + 10, 10);
    this.addInterfaceText(x + 7, y + 3, String(number), {
      fontFamily: '"Songti SC", STSong, serif',
      fontSize: "11px",
      color: active ? "#07100f" : "#9c927d",
    });
    this.addInterfaceText(x + 26, y + 2, label, {
      fontSize: "11px",
      color: active ? "#d7bc7d" : "#6f7569",
    });
  }

  drawInterfaceAutoState(graphics, x, y, width) {
    graphics.fillStyle(UI_COLORS.bronzeDim, 0.13);
    graphics.fillRoundedRect(x, y, width, 38, 4);
    graphics.lineStyle(1, UI_COLORS.bronzeDim, 0.55);
    graphics.strokeRoundedRect(x + 0.5, y + 0.5, width - 1, 37, 4);
    this.drawInterfaceGlyph(graphics, "bot", x + 22, y + 19, 18, UI_COLORS.bronze);
    this.addInterfaceText(x + 40, y + 10, "战阵自动出招", {
      fontFamily: '"Songti SC", STSong, serif',
      fontSize: "11px",
      color: "#d7bc7d",
    });
  }

  drawSkillButton(graphics, skill, x, y, width, height) {
    const enabled = !skill.disabled;
    const selected = Boolean(skill.selected);
    const alpha = enabled ? 1 : 0.38;
    graphics.fillStyle(selected ? UI_COLORS.bronzeDim : UI_COLORS.panelRaised, selected ? 0.22 : 0.9);
    graphics.fillRoundedRect(x, y, width, height, 4);
    graphics.lineStyle(
      selected ? 1.5 : 1,
      selected ? UI_COLORS.bronze : UI_COLORS.line,
      selected ? 0.92 : 0.62,
    );
    graphics.strokeRoundedRect(x + 0.5, y + 0.5, width - 1, height - 1, 4);
    if (selected) {
      graphics.fillStyle(UI_COLORS.bronze, 0.95);
      graphics.fillRect(x, y + 1, 2, height - 2);
    }
    graphics.fillStyle(skill.ultimate ? UI_COLORS.bronzeDim : UI_COLORS.tealDim, 0.45 * alpha);
    graphics.fillCircle(x + 25, y + height / 2, 16);
    graphics.lineStyle(1, skill.ultimate ? UI_COLORS.bronze : UI_COLORS.teal, 0.72 * alpha);
    graphics.strokeCircle(x + 25, y + height / 2, 16);
    this.drawInterfaceGlyph(
      graphics,
      skill.ultimate ? "ultimate" : skill.kind === "heal" ? "heal" : skill.kind === "guard" ? "shield" : "sword",
      x + 25,
      y + height / 2,
      17,
      skill.ultimate ? UI_COLORS.bronze : UI_COLORS.teal,
      alpha,
    );
    this.addInterfaceText(x + 49, y + (height >= 60 ? 10 : 7), skill.name || "招式", {
      fontFamily: '"Songti SC", STSong, serif',
      fontSize: height >= 60 ? "13px" : "12px",
      color: enabled ? "#f0e8d7" : "#6f7569",
    });
    this.addInterfaceText(x + width - 46, y + 10, skill.costLabel || "", {
      fontSize: "9px",
      color: skill.cooling ? "#df8877" : "#d7bc7d",
    });
    if (enabled) {
      this.addInterfaceHitArea(
        `skill:${skill.id}`,
        x,
        y,
        width,
        height,
        () => this.callbacks.onSelectSkill?.(skill.id),
      );
    }
  }

  drawSkillTile(graphics, skill, x, y, width, height) {
    const enabled = !skill.disabled;
    const selected = Boolean(skill.selected);
    const alpha = enabled ? 1 : 0.36;
    const tone = skill.ultimate ? UI_COLORS.bronze : UI_COLORS.teal;
    graphics.fillStyle(
      selected ? UI_COLORS.bronzeDim : UI_COLORS.panelRaised,
      selected ? 0.3 : 0.88,
    );
    graphics.fillRoundedRect(x, y, width, height, 4);
    graphics.lineStyle(
      selected ? 1.5 : 1,
      selected ? UI_COLORS.bronze : UI_COLORS.line,
      selected ? 0.92 : 0.6,
    );
    graphics.strokeRoundedRect(x + 0.5, y + 0.5, width - 1, height - 1, 4);
    graphics.fillStyle(tone, 0.14 * alpha);
    graphics.fillCircle(x + 22, y + height / 2, 15);
    graphics.lineStyle(1, tone, 0.72 * alpha);
    graphics.strokeCircle(x + 22, y + height / 2, 15);
    this.drawInterfaceGlyph(
      graphics,
      skill.ultimate
        ? "ultimate"
        : skill.kind === "heal"
          ? "heal"
          : skill.kind === "guard"
            ? "shield"
            : "sword",
      x + 22,
      y + height / 2,
      15,
      tone,
      alpha,
    );
    const textX = x + 42;
    const textWidth = Math.max(32, width - 50);
    this.addInterfaceText(textX, y + (height >= 66 ? 13 : 10), skill.name || "招式", {
      fontFamily: '"Songti SC", STSong, serif',
      fontSize: width >= 124 ? "12px" : "11px",
      color: enabled ? "#f2ead8" : "#6f7569",
      wordWrap: { width: textWidth, useAdvancedWrap: true },
      maxLines: 1,
    });
    if (height >= 62) {
      this.addInterfaceText(textX, y + 34, skill.costLabel || "", {
        fontSize: "8px",
        color: skill.cooling ? "#df8877" : enabled ? "#d8b970" : "#62685f",
        wordWrap: { width: textWidth, useAdvancedWrap: true },
        maxLines: 1,
      });
    }
    if (!enabled) {
      graphics.fillStyle(UI_COLORS.ink, 0.38);
      graphics.fillRoundedRect(x, y, width, height, 4);
    }
    if (enabled) {
      this.addInterfaceHitArea(
        `skill:${skill.id}`,
        x,
        y,
        width,
        height,
        () => this.callbacks.onSelectSkill?.(skill.id),
      );
    }
  }

  drawCompactCommandRail(layout) {
    const graphics = this.interfaceGraphics;
    const rail = layout.rail;
    const ui = this.ui;
    this.commandRect = { ...rail };
    graphics.fillStyle(UI_COLORS.ink, 0.96);
    graphics.fillRoundedRect(rail.x, rail.y, rail.width, rail.height, 6);
    graphics.lineStyle(1, UI_COLORS.line, 0.76);
    graphics.strokeRoundedRect(
      rail.x + 0.5,
      rail.y + 0.5,
      rail.width - 1,
      rail.height - 1,
      6,
    );
    const actor = ui.actor;
    const headerY = rail.y + 8;
    if (actor) {
      graphics.fillStyle(UI_COLORS.panelRaised, 1);
      graphics.fillRoundedRect(rail.x + 9, headerY, 40, 44, 3);
      this.addInterfaceImage(
        rail.x + 29,
        headerY + 22,
        actor.portrait || actor.sprite,
        35,
        41,
      );
      this.addInterfaceText(rail.x + 58, headerY + 1, actor.name || "战阵", {
        fontFamily: '"Songti SC", STSong, serif',
        fontSize: "15px",
        color: "#f0e8d7",
      });
      this.addInterfaceText(
        rail.x + 58,
        headerY + 23,
        `${actor.pathName || "未知"} · 气 ${actor.yiqi ?? 0}`,
        {
          fontSize: "9px",
          color: "#9c927d",
        },
      );
    }
    const promptY = rail.y + 57;
    this.addInterfaceText(rail.x + 12, promptY, ui.prompt || "选择招式", {
      fontFamily: '"Songti SC", STSong, serif',
      fontSize: "11px",
      color: ui.step === 2 ? "#d7bc7d" : "#c5b89e",
    });
    if (ui.step === 2) {
      const cancelX = rail.x + rail.width - 62;
      graphics.lineStyle(1, UI_COLORS.line, 0.8);
      graphics.strokeRoundedRect(cancelX, promptY - 3, 50, 22, 3);
      this.addInterfaceText(cancelX + 13, promptY + 1, "取消", {
        fontSize: "9px",
        color: "#9c927d",
      });
      this.addInterfaceHitArea(
        "cancel-target",
        cancelX,
        promptY - 3,
        50,
        22,
        this.callbacks.onCancelTarget,
      );
    }
    if (ui.chain?.ready) {
      const chainX = rail.x + rail.width - 126;
      graphics.fillStyle(UI_COLORS.bronzeDim, 0.22);
      graphics.fillRoundedRect(chainX, promptY - 4, 64, 23, 3);
      graphics.lineStyle(1, UI_COLORS.bronze, 0.72);
      graphics.strokeRoundedRect(chainX + 0.5, promptY - 3.5, 63, 22, 3);
      this.addInterfaceText(chainX + 10, promptY + 1, "合击", {
        fontSize: "9px",
        color: "#d7bc7d",
      });
      this.addInterfaceHitArea(
        "chain-attack",
        chainX,
        promptY - 4,
        64,
        23,
        this.callbacks.onChainAttack,
      );
    }
    const skills = (ui.skills || []).slice(0, 3);
    const gap = 5;
    const buttonX = rail.x + 8;
    const buttonY = rail.y + 86;
    const buttonWidth = (rail.width - 16 - gap * Math.max(0, skills.length - 1)) / Math.max(1, skills.length);
    const buttonHeight = Math.min(70, rail.height - 94);
    skills.forEach((skill, index) => {
      const x = buttonX + index * (buttonWidth + gap);
      const enabled = !skill.disabled;
      graphics.fillStyle(skill.selected ? UI_COLORS.bronzeDim : UI_COLORS.panelRaised, skill.selected ? 0.24 : 0.92);
      graphics.fillRoundedRect(x, buttonY, buttonWidth, buttonHeight, 4);
      graphics.lineStyle(
        skill.selected ? 1.5 : 1,
        skill.selected ? UI_COLORS.bronze : UI_COLORS.line,
        enabled ? 0.78 : 0.35,
      );
      graphics.strokeRoundedRect(x + 0.5, buttonY + 0.5, buttonWidth - 1, buttonHeight - 1, 4);
      graphics.fillStyle(UI_COLORS.tealDim, 0.42);
      graphics.fillCircle(x + buttonWidth / 2, buttonY + 22, 14);
      this.drawInterfaceGlyph(
        graphics,
        skill.ultimate ? "ultimate" : skill.kind === "heal" ? "heal" : skill.kind === "guard" ? "shield" : "sword",
        x + buttonWidth / 2,
        buttonY + 22,
        15,
        skill.ultimate ? UI_COLORS.bronze : UI_COLORS.teal,
        enabled ? 1 : 0.35,
      );
      const name = this.scene.add
        .text(x + buttonWidth / 2, buttonY + 44, skill.name || "招式", {
          fontFamily: '"Songti SC", STSong, serif',
          fontSize: "11px",
          color: enabled ? "#f0e8d7" : "#6f7569",
          align: "center",
        })
        .setOrigin(0.5, 0)
        .setResolution?.(1);
      this.uiLayer.add(name);
      if (enabled) {
        this.addInterfaceHitArea(
          `skill:${skill.id}`,
          x,
          buttonY,
          buttonWidth,
          buttonHeight,
          () => this.callbacks.onSelectSkill?.(skill.id),
        );
      }
    });
    if (!skills.length) {
      this.addInterfaceText(
        rail.x + rail.width / 2 - 52,
        buttonY + 20,
        ui.kind === "enemy" ? "敌方正在行动" : "正在整理战阵",
        {
          fontFamily: '"Songti SC", STSong, serif',
          fontSize: "13px",
          color: "#c5b89e",
        },
      );
    }
  }

  syncActorHud(actor) {
    if (!this.scene?.add || !actor?.position || this.destroyed) return;
    const unit = actor.unit;
    const mobile = this.width < 760;
    const width = Math.max(
      mobile ? 94 : 146,
      Math.round(actor.position.width * (mobile ? 1.05 : 1)),
    );
    const height = mobile ? 62 : 68;
    if (!actor.hud) {
      const container = this.scene.add.container(0, 0);
      const graphics = this.scene.add.graphics();
      const textStyle = {
        fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
        fontSize: "10px",
        color: "#f0e8d7",
      };
      const level = this.scene.add.text(0, 0, "", {
        ...textStyle,
        fontSize: "9px",
        color: "#8f856f",
      });
      const name = this.scene.add.text(0, 0, "", {
        ...textStyle,
        fontFamily: '"Songti SC", STSong, serif',
        fontSize: "12px",
        fontStyle: "bold",
      });
      const path = this.scene.add.text(0, 0, "", {
        ...textStyle,
        fontSize: "9px",
        fontStyle: "bold",
      }).setOrigin(1, 0);
      const values = this.scene.add.text(0, 0, "", {
        ...textStyle,
        fontSize: "8px",
        color: "#c5b89e",
      }).setOrigin(1, 0);
      const status = this.scene.add.text(0, 0, "", {
        ...textStyle,
        fontSize: "8px",
        color: "#bd9c59",
      });
      container.add([graphics, level, name, path, values, status]);
      actor.hud = {
        container,
        graphics,
        level,
        name,
        path,
        values,
        status,
        width,
        height,
      };
    }

    const hud = actor.hud;
    const pathStyle =
      PATH_PRESENTATION[unit.path] || PATH_PRESENTATION.gang;
    const widthChanged = hud.width !== width;
    hud.width = width;
    hud.height = height;
    hud.container.setPosition(
      actor.position.x - width / 2,
      actor.position.y + 38,
    );
    hud.container.setDepth(2600 + actor.position.y);
    hud.container.setAlpha(actor.defeated ? 0.28 : 1);
    hud.level.setText(`Lv.${unit.level || 1}`);
    hud.name.setText(String(unit.name || ""));
    hud.path.setText(pathStyle.name).setColor(
      `#${pathStyle.color.toString(16).padStart(6, "0")}`,
    );
    hud.values.setText(
      `${Math.max(0, Number(unit.hp) || 0)}/${Math.max(1, Number(unit.maxHp) || 1)}`,
    );
    const statuses = Object.entries(unit.statuses || {})
      .filter(([key, duration]) => duration > 0 && STATUS_LABELS[key])
      .map(([key, duration]) => `${STATUS_LABELS[key]}${duration}`)
      .join(" · ");
    hud.status.setText(statuses);

    const borderColor = actor.active
      ? 0xd7bc7d
      : actor.targetable
        ? 0xe3c987
        : unit.side === "hero"
          ? 0x3c625f
          : 0x6e2927;
    const barWidth = width - 16;
    const hpRatio = clamp(
      (Number(unit.hp) || 0) / Math.max(1, Number(unit.maxHp) || 1),
      0,
      1,
    );
    const secondValue =
      unit.side === "hero" ? Number(unit.yiqi) || 0 : Number(unit.poise) || 0;
    const secondMax =
      unit.side === "hero"
        ? 100
        : Math.max(1, Number(unit.poiseMax) || 1);
    const secondRatio = clamp(secondValue / secondMax, 0, 1);
    hud.graphics.clear();
    hud.level.setVisible(!mobile);
    hud.path.setVisible(!mobile);
    hud.graphics
      .fillStyle(0x07100f, 0.94)
      .fillRoundedRect(0, 0, width, height, 4)
      .lineStyle(actor.active || actor.targetable ? 1.5 : 1, borderColor, 0.9)
      .strokeRoundedRect(0.5, 0.5, width - 1, height - 1, 4)
      .fillStyle(0x182324, 1)
      .fillRect(mobile ? 6 : 8, mobile ? 23 : 28, barWidth, mobile ? 5 : 6)
      .fillStyle(unit.side === "hero" ? 0x79b2a8 : 0xc76554, 1)
      .fillRect(
        mobile ? 6 : 8,
        mobile ? 23 : 28,
        barWidth * hpRatio,
        mobile ? 5 : 6,
      )
      .fillStyle(0x182324, 1)
      .fillRect(mobile ? 6 : 8, mobile ? 34 : 40, barWidth, 4)
      .fillStyle(0x8dafc6, 1)
      .fillRect(mobile ? 6 : 8, mobile ? 34 : 40, barWidth * secondRatio, 4);
    if (mobile) {
      hud.name.setFontSize(9);
      hud.values.setFontSize(7);
      hud.status.setFontSize(7);
      hud.name.setPosition(6, 4);
      hud.values.setPosition(width - 6, 13);
      hud.status.setPosition(6, 45);
    } else {
      hud.name.setFontSize(12);
      hud.values.setFontSize(8);
      hud.status.setFontSize(8);
      hud.level.setPosition(8, 7);
      hud.name.setPosition(widthChanged ? 40 : 40, 4);
      hud.path.setPosition(width - 8, 7);
      hud.values.setPosition(width - 8, 17);
      hud.status.setPosition(8, 50);
    }
  }

  spawnCombatFeedback(profile, events = []) {
    if (!this.scene?.add || this.reducedMotion) return;
    for (const event of events) {
      const actor = this.actors.get(event.targetUid);
      if (!actor?.position || !event?.type) continue;
      let text = "";
      let color = "#f0d2ae";
      let size = 19;
      if (event.type === "damage" || event.type === "combo") {
        text = `-${Number(event.damage) || 0}${
          event.critical ? " 暴击" : event.pathAdvantage ? " 克制" : ""
        }`;
        color = event.critical ? "#ffe4a8" : "#ef9b84";
        size = event.critical ? 25 : 20;
      } else if (event.type === "heal") {
        text = `+${Number(event.healing) || 0}`;
        color = "#9fd8b6";
      } else if (event.type === "evade") {
        text = "闪避";
        color = "#91b4ae";
        size = 18;
      }
      if (!text) continue;
      const label = this.scene.add
        .text(
          actor.position.x,
          actor.position.y - 48,
          text,
          {
            fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
            fontSize: `${size}px`,
            fontStyle: "bold",
            color,
            stroke: "#07100f",
            strokeThickness: 4,
          },
        )
        .setOrigin(0.5, 1)
        .setDepth(4200);
      this.scene.tweens.add({
        targets: label,
        y: label.y - 58,
        alpha: { from: 1, to: 0 },
        duration: this.ticks(760),
        ease: "Cubic.Out",
        onComplete: () => label.destroy(),
      });
    }
  }

  play(profile, options = {}) {
    if (!profile || typeof profile !== "object") return null;
    const now = this.scene?.time?.now ?? performance.now();
    const duration = this.ticks(SKILL_DURATIONS[profile.template] || 900);
    const targets = [
      ...new Set([
        ...(profile.targetUids || []),
        ...(options.events || []).map((event) => event.targetUid),
      ].filter(Boolean)),
    ];
    const impactAt = now + duration * 0.44;
    for (const uid of targets) {
      const actor = this.actors.get(uid);
      if (!actor) continue;
      const event = (options.events || []).find(
        (candidate) => candidate.targetUid === uid,
      );
      if (event?.type === "evade") actor.dodgeAt = impactAt;
      else if (event?.type === "heal") actor.recoverAt = impactAt;
      else actor.hitAt = impactAt;
    }
    this.attack = {
      ...profile,
      kind: battlePerformanceKind(profile),
      startedAt: now,
      duration,
      targetUids: targets,
      seed: hashSeed(
        `${profile.skillName}-${profile.actorUid}-${targets[0]}-${now}`,
      ),
      shakePlayed: false,
    };
    this.spawnOpenSourceVfx(this.attack);
    this.spawnCombatFeedback(this.attack, options.events || []);
    return this.attack;
  }

  replay(profile, options = {}) {
    const attack = this.play(profile, options);
    if (attack) attack.duration = 2400;
    return attack;
  }

  reset(units = this.lastUnits, activeUid = this.activeUid) {
    this.attack = null;
    this.renderedVfx = null;
    this.prepareActors(units, activeUid);
    this.syncSprites();
    this.refreshProxyLayout();
  }

  ticks(duration) {
    const scale = this.reducedMotion ? 0.16 : this.speed;
    return Math.max(90, Math.round(duration / scale));
  }

  syncProxyHud(units = this.lastUnits) {
    if (units !== this.lastUnits) this.prepareActors(units, this.activeUid);
    this.refreshProxyLayout();
  }

  refreshProxyLayout() {
    if (
      typeof document === "undefined" ||
      typeof document.querySelector !== "function"
    ) {
      return;
    }
    const buttons = document.querySelectorAll(".stage-proxy");
    if (!buttons.length) return;
    const mobile = this.width < 600;
    for (const button of buttons) {
      const uid = button.dataset.uid;
      const actor = this.actors.get(uid);
      if (!actor?.position) continue;
      const artHeight = actorArtHeight(actor, mobile);
      const hud = button.querySelector(".unit-hud");
      const hudHeight = Math.max(
        48,
        Math.round(hud?.getBoundingClientRect?.().height || (mobile ? 76 : 82)),
      );
      const groundY = actor.position.y + 34;
      button.style.left = `${actor.position.x}px`;
      button.style.right = "auto";
      button.style.top = `${groundY - artHeight}px`;
      button.style.bottom = "auto";
      button.style.width = `${Math.round(actor.position.width)}px`;
      button.style.height = `${Math.round(artHeight + hudHeight)}px`;
      button.style.transform = "translateX(-50%)";
      button.style.setProperty("--actor-art-height", `${artHeight}px`);
    }
  }

  bindFocus(uid) {
    if (!this.actors.has(uid)) return;
    this.focusedUid = uid;
    for (const button of document.querySelectorAll(".stage-proxy.is-targetable")) {
      button.classList.toggle(
        "is-target-focused",
        button.dataset.uid === uid,
      );
    }
  }

  renderPreview() {
    return {
      rendered: Boolean(this.phaserReady),
      engine: this.mode,
      reason: this.phaserReady ? null : "scene-not-ready",
    };
  }

  getSnapshot() {
    return {
      engine: this.mode,
      width: Math.round(this.width),
      height: Math.round(this.height),
      fps: this.fps,
      attacking: Boolean(this.attack),
      template: this.attack?.kind || null,
      mobile: this.width < 600,
      actors: this.actorSprites.size,
      openSourceVfx: {
        loaded: Object.keys(OPEN_SOURCE_VFX).filter((name) =>
          this.scene?.textures?.exists?.(`${OPEN_SOURCE_VFX_KEY}${name}`),
        ).length,
        active: this.effectSprites.size,
        plays: this.openSourceVfxPlays,
      },
      ui: {
        active: Boolean(this.ui),
        step: this.ui?.step || null,
        selectedSkillId: this.ui?.selectedSkillId || null,
        menuOpen: Boolean(this.ui?.menu?.open),
        chapterTactic: this.ui?.context?.specialRule?.name || null,
        tacticShort: this.ui?.header?.tacticShort || null,
        tacticName: this.ui?.header?.tacticName || null,
        autoBattle: Boolean(this.ui?.header?.autoBattle),
        speed: this.ui?.header?.speed || 1,
        sound: Boolean(this.ui?.header?.sound),
        targetable: this.targetableUids.size,
        hitAreas: this.interfaceHitRects.size,
      },
    };
  }

  getUiSnapshot() {
    const camera = this.scene?.cameras?.main;
    return {
      context: structuredClone(this.ui?.context || null),
      chain: structuredClone(this.ui?.chain || null),
      chainSlots: 3,
      result: structuredClone(this.ui?.result || null),
      contextRect: this.contextRect ? { ...this.contextRect } : null,
      chainRect: this.chainRect ? { ...this.chainRect } : null,
      tutorialRect: this.tutorialRect ? { ...this.tutorialRect } : null,
      commandRect: this.commandRect ? { ...this.commandRect } : null,
      hitAreas: Object.fromEntries(
        [...this.interfaceHitRects].map(([id, rect]) => [
          id,
          {
            ...rect,
            screen: camera
              ? {
                  x: rect.x - camera.scrollX,
                  y: rect.y - camera.scrollY,
                  width: rect.width,
                  height: rect.height,
                }
              : rect,
          },
        ]),
      ),
      actors: Object.fromEntries(
        [...this.actors].map(([uid, actor]) => [
          uid,
          {
            x: actor.position?.x || 0,
            y: actor.position?.y || 0,
            width: actor.position?.width || 0,
            height: actorArtHeight(actor, this.width < 600),
            side: actor.unit?.side || "",
            targetable: Boolean(actor.targetable),
            defeated: Boolean(actor.defeated),
          },
        ]),
      ),
    };
  }

  destroy() {
    this.destroyed = true;
    this.mode = "destroyed";
    this.attack = null;
    this.actors.clear();
    this.actorSprites.clear();
    if (this.scene && this.resizeHandler) {
      this.scene.scale?.off?.("resize", this.resizeHandler);
    }
    this.resizeHandler = null;
    if (this.contextLostHandler) {
      this.canvas.removeEventListener(
        "webglcontextlost",
        this.contextLostHandler,
      );
      this.contextLostHandler = null;
    }
    this.phaserGame?.destroy?.(true);
    this.phaserGame = null;
    this.scene = null;
    this.phaserReady = false;
  }
}

export function createBattleStage(canvas, options) {
  return new BattleStageScene(canvas, options);
}
