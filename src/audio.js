import { battleVfxTemplate } from "./battle-vfx.js";

const SCENE_TRACKS = {
  title: "title_theme",
  battle: "battle_theme",
  ending: "ending_theme",
  "final-choice": "ending_theme",
  story: "jianghu_theme",
  map: "jianghu_theme",
  camp: "jianghu_theme",
  roster: "jianghu_theme",
  formation: "jianghu_theme",
  equipment: "jianghu_theme",
  codex: "jianghu_theme",
  settings: "jianghu_theme",
  reward: "ending_theme",
  arena: "battle_theme",
  "arena-briefing": "battle_theme",
  "arena-reward": "jianghu_theme",
};

const CHAPTER_TRACKS = {
  qingfeng: "qingfeng_theme",
  jiangzhou: "jiangzhou_theme",
  zhujiazhuang: "zhujiazhuang_theme",
  damingfu: "damingfu_theme",
};

export const COMBAT_SFX_CUES = [
  "battle-start",
  "blade",
  "impact",
  "volley",
  "guard",
  "evade",
  "restore",
  "ultimate",
  "victory",
  "defeat",
];

export const COMBAT_SFX_ASSETS = Object.freeze(
  Object.fromEntries(
    COMBAT_SFX_CUES.map((cue) => [cue, `/assets/audio/sfx/${cue}.mp3`]),
  ),
);

const UI_SFX_ASSETS = Object.freeze({
  click: "/assets/audio/ui/click.mp3",
  confirm: "/assets/audio/sfx/actions/battle-open-01.mp3",
});

const COMBAT_SFX_GAINS = Object.freeze({
  "battle-start": 0.86,
  blade: 0.72,
  impact: 0.82,
  volley: 0.7,
  guard: 0.7,
  evade: 0.54,
  restore: 0.62,
  ultimate: 0.84,
  victory: 0.74,
  defeat: 0.68,
});

export function combatSfxAsset(cue) {
  return COMBAT_SFX_ASSETS[cue] || null;
}

export function sceneMusicTrack(scene, context = {}) {
  const chapterId = String(context.chapterId || "");
  if (
    ["story", "battle", "reward"].includes(scene) &&
    chapterId.startsWith("recruitment-")
  ) {
    return "recruitment_theme";
  }
  if (scene === "story" && chapterId === "liangshan") return "ending_theme";
  if (
    ["battle", "arena", "arena-briefing", "arena-reward"].includes(scene) &&
    context.boss
  ) {
    return "boss_theme";
  }
  let track = SCENE_TRACKS[scene] || "jianghu_theme";
  if (scene === "story" && CHAPTER_TRACKS[chapterId]) {
    track = CHAPTER_TRACKS[chapterId];
  }
  if (
    chapterId !== "qingfeng" &&
    ["battle", "arena-briefing", "arena-reward"].includes(scene) &&
    CHAPTER_TRACKS[chapterId]
  ) {
    track = CHAPTER_TRACKS[chapterId];
  }
  return track;
}

export function combatSfxCue({ skill, result }) {
  if (result?.phase === "victory") return "victory";
  if (result?.phase === "defeat") return "defeat";
  const events = Array.isArray(result?.events) ? result.events : [];
  if (events.some((event) => event.type === "combo")) return "ultimate";
  if (events.some((event) => event.type === "heal")) return "restore";
  const evaded = events.some((event) => event.type === "evade");
  if (evaded) return "evade";
  if (!skill) return "guard";
  return battleVfxTemplate({ skill, result }) || "blade";
}

class SoundEngine {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.enabled = true;
    this.unlocked = false;
    this.musicVolume = 0.65;
    this.sfxVolume = 0.8;
    this.currentMusic = null;
    this.musicLayers = [this.createMusicLayer(), this.createMusicLayer()];
    this.activeMusicLayer = 0;
    this.musicFadeTimer = null;
    this.sfxBuffers = new Map();
    this.sfxLoads = new Map();
    this.sfxLoadFailures = new Map();
    this.openSourceSfxPlays = 0;
    this.uiAudio = this.createUiAudio();
    this.lastCue = null;
    if (globalThis.window && globalThis.document) {
      globalThis.__shuihuAudioElements = () =>
        this.musicLayers.filter((layer) => layer instanceof globalThis.Audio)
          .length;
      globalThis.__shuihuAudioPlayAttempts = (trackId) =>
        this.musicLayers.filter(
          (layer) => layer.dataset?.track === trackId && layer.playAttempted,
        ).length;
      globalThis.__shuihuCombatSfxStatus = () => ({
        loaded: [...this.sfxBuffers.keys()],
        loading: [...this.sfxLoads.keys()],
        failures: [...this.sfxLoadFailures.keys()],
        openSourcePlays: this.openSourceSfxPlays,
      });
      globalThis.__shuihuCombatSfxPreload = () => this.preloadCombatSfx();
      globalThis.__shuihuSound = this;
    }
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
    globalThis.document?.documentElement.setAttribute(
      "data-audio",
      this.enabled ? "on" : "off",
    );
    if (!this.enabled) {
      if (this.musicFadeTimer) globalThis.window?.clearInterval(this.musicFadeTimer);
      this.musicFadeTimer = null;
      this.musicLayers.forEach((layer) => {
        layer.pause();
        layer.removeAttribute("src");
      });
      this.context?.suspend().catch(() => {});
      return;
    }
    if (this.unlocked && this.currentMusic) this.playMusic(this.currentMusic);
  }

  setVolumes({ musicVolume, sfxVolume } = {}) {
    if (musicVolume !== undefined) {
      this.musicVolume = Math.max(0, Math.min(1, Number(musicVolume)));
    }
    if (sfxVolume !== undefined) {
      this.sfxVolume = Math.max(0, Math.min(1, Number(sfxVolume)));
    }
    const root = globalThis.document?.documentElement;
    if (root) {
      root.setAttribute("data-music-volume", String(this.musicVolume));
      root.setAttribute("data-sfx-volume", String(this.sfxVolume));
    }
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        Math.pow(this.sfxVolume, 1.35) * 0.7,
        this.context.currentTime,
        0.015,
      );
    }
    const activeLayer = this.musicLayers[this.activeMusicLayer];
    if (this.musicVolume <= 0) {
      this.musicLayers.forEach((layer) => layer.pause());
    } else if (this.enabled && this.unlocked && this.currentMusic) {
      if (activeLayer.dataset.track !== this.currentMusic) {
        this.playMusic(this.currentMusic);
      } else {
        activeLayer.volume = this.musicTargetVolume();
        if (activeLayer.paused) {
          this.catchPlayback(activeLayer);
        }
      }
    }
    if (this.enabled && this.unlocked && this.context?.state === "suspended") {
      this.context.resume().catch(() => {});
    }
  }

  musicTargetVolume() {
    return 0.36 * this.musicVolume;
  }

  createMusicLayer() {
    const AudioElement = globalThis.Audio || globalThis.window?.Audio;
    if (!AudioElement) return {};
    const layer = new AudioElement();
    layer.loop = true;
    layer.preload = "auto";
    layer.volume = 0;
    layer.dataset.track = "";
    return layer;
  }

  createUiAudio() {
    const AudioElement = globalThis.Audio || globalThis.window?.Audio;
    if (!AudioElement) return new Map();
    return new Map(
      Object.entries(UI_SFX_ASSETS).map(([cue, source]) => {
        const audio = new AudioElement(source);
        audio.preload = "auto";
        audio.volume = cue === "click" ? 0.28 : 0.34;
        return [cue, audio];
      }),
    );
  }

  playUiAudio(cue) {
    if (!this.enabled || this.sfxVolume <= 0) return false;
    const audio = this.uiAudio.get(cue);
    if (!audio) return false;
    audio.volume = (cue === "click" ? 0.28 : 0.34) * this.sfxVolume;
    audio.currentTime = 0;
    const attempt = audio.play?.();
    attempt?.catch?.(() => {});
    return true;
  }

  unlock() {
    this.unlocked = true;
    this.ensureContext();
    if (this.currentMusic) this.playMusic(this.currentMusic);
    this.preloadCombatSfx();
  }

  catchPlayback(layer) {
    const attempt = layer.play?.();
    if (attempt?.catch) attempt.catch(() => {});
    return attempt;
  }

  setSceneMusic(scene, context = {}) {
    const nextTrack = sceneMusicTrack(scene, context);
    if (nextTrack === this.currentMusic) {
      if (this.enabled && this.unlocked) {
        const activeLayer = this.musicLayers[this.activeMusicLayer];
        if (activeLayer.paused) this.playMusic(nextTrack);
      }
      return;
    }
    this.currentMusic = nextTrack;
    if (this.enabled && this.unlocked) this.playMusic(nextTrack);
  }

  playMusic(trackId) {
    if (!this.enabled || !this.unlocked || !trackId) return;
    globalThis.document?.documentElement.setAttribute("data-music", trackId);
    const currentLayer = this.musicLayers[this.activeMusicLayer];
    const source = `/assets/audio/${trackId}.mp3`;
    if (currentLayer.dataset?.track === trackId && !currentLayer.paused) return;
    const nextIndex = 1 - this.activeMusicLayer;
    const nextLayer = this.musicLayers[nextIndex];
    nextLayer.dataset.track = trackId;
    nextLayer.src = source;
    nextLayer.currentTime = 0;
    nextLayer.volume = 0;
    nextLayer.playAttempted = true;
    this.catchPlayback(nextLayer);
    this.activeMusicLayer = nextIndex;
    this.crossfadeMusic(currentLayer, nextLayer);
  }

  crossfadeMusic(previous, next) {
    if (this.musicFadeTimer) globalThis.window?.clearInterval(this.musicFadeTimer);
    const targetVolume = this.musicTargetVolume();
    let progress = 0;
    const steps = 24;
    this.musicFadeTimer = globalThis.window?.setInterval(() => {
      progress += 1;
      const ratio = Math.min(1, progress / steps);
      next.volume = targetVolume * ratio;
      previous.volume = Math.max(0, previous.volume * (1 - ratio));
      if (ratio >= 1) {
        globalThis.window?.clearInterval(this.musicFadeTimer);
        this.musicFadeTimer = null;
        previous.pause();
        previous.removeAttribute("src");
      }
    }, 45);
  }

  ensureContext() {
    if (!this.enabled) return null;
    if (!this.context) {
      const AudioContextClass =
        globalThis.window?.AudioContext || globalThis.window?.webkitAudioContext;
      if (!AudioContextClass) return null;
      this.context = new AudioContextClass();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = Math.pow(this.sfxVolume, 1.35) * 0.7;
      this.masterGain.connect(this.context.destination);
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 12;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.12;
      compressor.connect(this.masterGain);
      this.sfxCompressor = compressor;
    }
    if (this.context.state === "suspended") this.context.resume().catch(() => {});
    return this.context;
  }

  loadSfxAsset(key, source) {
    const context = this.ensureContext();
    if (!source || !context) return Promise.resolve(null);
    if (this.sfxBuffers.has(key)) {
      return Promise.resolve(this.sfxBuffers.get(key));
    }
    if (this.sfxLoads.has(key)) return this.sfxLoads.get(key);
    const load = globalThis
      .fetch(source, { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Combat SFX request failed: ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then((payload) => context.decodeAudioData(payload))
      .then((buffer) => {
        this.sfxBuffers.set(key, buffer);
        this.sfxLoadFailures.delete(key);
        return buffer;
      })
      .catch((error) => {
        this.sfxLoadFailures.set(key, String(error?.message || error));
        return null;
      })
      .finally(() => {
        this.sfxLoads.delete(key);
      });
    this.sfxLoads.set(key, load);
    return load;
  }

  loadCombatSfx(cue) {
    return this.loadSfxAsset(cue, combatSfxAsset(cue));
  }

  preloadCombatSfx() {
    if (!this.enabled) return Promise.resolve([]);
    return Promise.all(COMBAT_SFX_CUES.map((cue) => this.loadCombatSfx(cue)));
  }

  playCombatSample(cue) {
    const context = this.ensureContext();
    const buffer = this.sfxBuffers.get(cue);
    if (!context || !buffer || this.sfxVolume <= 0) return false;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = COMBAT_SFX_GAINS[cue] || 0.72;
    source.connect(gain);
    gain.connect(this.sfxCompressor || this.masterGain);
    source.start();
    this.openSourceSfxPlays += 1;
    return true;
  }

  click() {
    return this.playUiAudio("click");
  }

  confirm() {
    return this.playUiAudio("confirm");
  }

  victory() {
    return this.playCombatCue("victory");
  }

  defeat() {
    return this.playCombatCue("defeat");
  }

  playCombatCue(cue) {
    if (!COMBAT_SFX_CUES.includes(cue)) return false;
    this.lastCue = cue;
    this.ensureContext();
    if (this.playCombatSample(cue)) return true;
    this.loadCombatSfx(cue).then((buffer) => {
      if (buffer) this.playCombatSample(cue);
    });
    return true;
  }
}

export const sound = new SoundEngine();
