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
    this.generatedSfxPlays = 0;
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
        generatedPlays: this.generatedSfxPlays,
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

  loadCombatSfx(cue) {
    const source = combatSfxAsset(cue);
    const context = this.ensureContext();
    if (!source || !context) return Promise.resolve(null);
    if (this.sfxBuffers.has(cue)) {
      return Promise.resolve(this.sfxBuffers.get(cue));
    }
    if (this.sfxLoads.has(cue)) return this.sfxLoads.get(cue);
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
        this.sfxBuffers.set(cue, buffer);
        this.sfxLoadFailures.delete(cue);
        return buffer;
      })
      .catch((error) => {
        this.sfxLoadFailures.set(cue, String(error?.message || error));
        return null;
      })
      .finally(() => {
        this.sfxLoads.delete(cue);
      });
    this.sfxLoads.set(cue, load);
    return load;
  }

  preloadCombatSfx() {
    if (!this.enabled) return Promise.resolve([]);
    return Promise.all(COMBAT_SFX_CUES.map((cue) => this.loadCombatSfx(cue)));
  }

  playGeneratedCombatSfx(cue) {
    const context = this.ensureContext();
    const buffer = this.sfxBuffers.get(cue);
    if (!context || !buffer || this.sfxVolume <= 0) return false;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = cue === "battle-start" ? 0.92 : 0.8;
    source.connect(gain);
    gain.connect(this.sfxCompressor || this.masterGain);
    source.start();
    this.generatedSfxPlays += 1;
    return true;
  }

  noise(duration, options = {}) {
    const context = this.ensureContext();
    if (!context || this.sfxVolume <= 0) return;
    const start = Math.max(0, options.delay || 0);
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const frameCount = Math.max(1, Math.ceil(context.sampleRate * (duration + start)));
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let noise = 0;
    for (let index = 0; index < frameCount; index += 1) {
      noise = noise * 0.72 + (Math.random() * 2 - 1) * 0.28;
      samples[index] = noise;
    }
    source.buffer = buffer;
    filter.type = options.filter || "bandpass";
    filter.frequency.setValueAtTime(options.frequency || 1600, context.currentTime);
    if (options.endFrequency) {
      filter.frequency.exponentialRampToValueAtTime(
        options.endFrequency,
        context.currentTime + start + duration,
      );
    }
    filter.Q.value = options.q || 0.8;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.linearRampToValueAtTime(
      options.volume || 0.1,
      context.currentTime + start + (options.attack || 0.008),
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + start + duration,
    );
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxCompressor || this.masterGain);
    source.start(context.currentTime + start);
    source.stop(context.currentTime + start + duration + 0.03);
  }

  tone(frequency, duration, options = {}) {
    const context = this.ensureContext();
    if (!context || this.sfxVolume <= 0) return;
    const start = Math.max(0, options.delay || 0);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = options.type || "sine";
    oscillator.frequency.setValueAtTime(frequency, context.currentTime + start);
    if (options.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, options.endFrequency),
        context.currentTime + start + duration,
      );
    }
    gain.gain.setValueAtTime(0.0001, context.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(
      options.volume || 0.025,
      context.currentTime + start + 0.012,
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + start + duration,
    );
    oscillator.connect(gain);
    gain.connect(this.sfxCompressor || this.masterGain);
    oscillator.start(context.currentTime + start);
    oscillator.stop(context.currentTime + start + duration + 0.02);
  }

  click() {
    this.tone(420, 0.06, { type: "triangle", volume: 0.018 });
  }

  confirm() {
    this.tone(310, 0.12, {
      type: "triangle",
      endFrequency: 520,
      volume: 0.025,
    });
  }

  hit(heavy = false) {
    this.noise(heavy ? 0.24 : 0.12, {
      frequency: heavy ? 650 : 1600,
      endFrequency: heavy ? 120 : 650,
      volume: heavy ? 0.16 : 0.07,
    });
    this.tone(heavy ? 86 : 150, heavy ? 0.2 : 0.1, {
      type: "sine",
      endFrequency: heavy ? 38 : 72,
      volume: heavy ? 0.16 : 0.06,
    });
  }

  blade() {
    this.noise(0.16, {
      filter: "highpass",
      frequency: 2200,
      volume: 0.075,
    });
    this.noise(0.16, {
      frequency: 4500,
      endFrequency: 1400,
      volume: 0.1,
      delay: 0.04,
    });
  }

  volley() {
    this.noise(0.2, {
      filter: "highpass",
      frequency: 1100,
      endFrequency: 3200,
      volume: 0.045,
    });
    this.tone(950, 0.08, {
      type: "triangle",
      endFrequency: 250,
      volume: 0.02,
    });
    this.hit(false);
  }

  guard() {
    this.hit(false);
    this.tone(340, 0.16, {
      type: "square",
      endFrequency: 270,
      volume: 0.04,
    });
    this.tone(680, 0.12, { type: "sine", volume: 0.03 });
  }

  evade() {
    this.noise(0.16, {
      filter: "highpass",
      frequency: 2500,
      volume: 0.035,
    });
    this.tone(820, 0.1, {
      type: "sine",
      endFrequency: 1350,
      volume: 0.02,
    });
  }

  restore() {
    [520, 654, 784].forEach((frequency, index) => {
      this.tone(frequency, 0.3, {
        type: "sine",
        delay: index * 0.07,
        volume: 0.025,
      });
    });
  }

  ultimate() {
    this.noise(0.32, {
      filter: "highpass",
      frequency: 1800,
      volume: 0.08,
    });
    [196, 294, 392, 587].forEach((frequency, index) => {
      this.tone(frequency, 0.25, {
        type: "triangle",
        delay: index * 0.055,
        volume: 0.03,
      });
    });
    this.hit(true);
  }

  battleStart() {
    this.hit(true);
    this.tone(98, 0.45, {
      type: "triangle",
      endFrequency: 62,
      delay: 0.04,
      volume: 0.06,
    });
  }

  victory() {
    [262, 330, 392, 523].forEach((frequency, index) => {
      this.tone(frequency, 0.28, {
        type: "triangle",
        delay: index * 0.095,
        volume: 0.035,
      });
    });
  }

  defeat() {
    [220, 174, 130].forEach((frequency, index) => {
      this.tone(frequency, 0.42, {
        type: "sine",
        endFrequency: frequency * 0.76,
        delay: index * 0.13,
        volume: 0.032,
      });
    });
  }

  playCombatCue(cue) {
    if (!COMBAT_SFX_CUES.includes(cue)) return false;
    this.lastCue = cue;
    this.ensureContext();
    this.loadCombatSfx(cue);
    if (this.playGeneratedCombatSfx(cue)) return true;
    const actions = {
      "battle-start": () => this.battleStart(),
      blade: () => this.blade(),
      impact: () => this.hit(true),
      volley: () => this.volley(),
      guard: () => this.guard(),
      evade: () => this.evade(),
      restore: () => this.restore(),
      ultimate: () => this.ultimate(),
      victory: () => this.victory(),
      defeat: () => this.defeat(),
    };
    actions[cue]();
    return true;
  }
}

export const sound = new SoundEngine();
