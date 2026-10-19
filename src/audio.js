class SoundEngine {
  constructor() {
    this.context = null;
    this.enabled = true;
    this.unlocked = false;
    this.musicVolume = 0.65;
    this.sfxVolume = 0.8;
    this.currentMusic = null;
    this.musicLayers = [this.createMusicLayer(), this.createMusicLayer()];
    this.activeMusicLayer = 0;
    this.musicFadeTimer = null;
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
    document.documentElement.dataset.audio = this.enabled ? "on" : "off";
    if (!this.enabled) {
      this.musicLayers.forEach((layer) => layer.pause());
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
    document.documentElement.dataset.musicVolume = String(this.musicVolume);
    document.documentElement.dataset.sfxVolume = String(this.sfxVolume);

    const activeLayer = this.musicLayers[this.activeMusicLayer];
    if (this.musicVolume <= 0) {
      this.musicLayers.forEach((layer) => layer.pause());
      return;
    }
    if (this.enabled && this.unlocked && this.currentMusic) {
      if (activeLayer.dataset.track === this.currentMusic) {
        activeLayer.volume = this.musicTargetVolume();
        if (activeLayer.paused) {
          const playAttempt = activeLayer.play();
          if (playAttempt?.catch) playAttempt.catch(() => {});
        }
      } else {
        this.playMusic(this.currentMusic);
      }
    }
  }

  musicTargetVolume() {
    return 0.36 * this.musicVolume;
  }

  createMusicLayer() {
    const layer = new Audio();
    layer.loop = true;
    layer.preload = "auto";
    layer.volume = 0;
    return layer;
  }

  unlock() {
    this.unlocked = true;
    this.ensureContext();
    if (this.currentMusic) this.playMusic(this.currentMusic);
  }

  setSceneMusic(scene, context = {}) {
    const sceneTracks = {
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
    let nextTrack = sceneTracks[scene] || "jianghu_theme";
    const isRecruitmentScene =
      ["story", "battle", "reward"].includes(scene) &&
      String(context.chapterId || "").startsWith("recruitment-");
    if (isRecruitmentScene) {
      nextTrack = "recruitment_theme";
    } else if (scene === "story" && context.chapterId === "liangshan") {
      nextTrack = "ending_theme";
    } else if (scene === "story" && context.chapterId === "qingfeng") {
      nextTrack = "qingfeng_theme";
    } else if (scene === "story" && context.chapterId === "jiangzhou") {
      nextTrack = "jiangzhou_theme";
    } else if (scene === "story" && context.chapterId === "zhujiazhuang") {
      nextTrack = "zhujiazhuang_theme";
    } else if (scene === "story" && context.chapterId === "damingfu") {
      nextTrack = "damingfu_theme";
    } else if (scene === "battle" && context.boss) {
      nextTrack = "boss_theme";
    } else if (scene === "battle" && context.chapterId === "jiangzhou") {
      nextTrack = "jiangzhou_theme";
    } else if (scene === "battle" && context.chapterId === "zhujiazhuang") {
      nextTrack = "zhujiazhuang_theme";
    } else if (scene === "battle" && context.chapterId === "damingfu") {
      nextTrack = "damingfu_theme";
    }
    if (nextTrack === this.currentMusic) {
      if (this.enabled && this.unlocked) this.playMusic(nextTrack);
      return;
    }
    this.currentMusic = nextTrack;
    if (this.enabled && this.unlocked) this.playMusic(nextTrack);
  }

  playMusic(trackId) {
    if (!this.enabled || !this.unlocked || !trackId) return;
    document.documentElement.dataset.music = trackId;
    const currentLayer = this.musicLayers[this.activeMusicLayer];
    const source = `/assets/audio/${trackId}.mp3`;
    if (currentLayer.dataset.track === trackId && !currentLayer.paused) {
      return;
    }

    const nextIndex = 1 - this.activeMusicLayer;
    const nextLayer = this.musicLayers[nextIndex];
    nextLayer.dataset.track = trackId;
    nextLayer.src = source;
    nextLayer.currentTime = 0;
    nextLayer.volume = 0;
    const playAttempt = nextLayer.play();
    if (playAttempt?.catch) playAttempt.catch(() => {});
    this.activeMusicLayer = nextIndex;
    this.crossfadeMusic(currentLayer, nextLayer);
  }

  crossfadeMusic(previous, next) {
    if (this.musicFadeTimer) window.clearInterval(this.musicFadeTimer);
    const targetVolume = this.musicTargetVolume();
    let progress = 0;
    const steps = 24;
    this.musicFadeTimer = window.setInterval(() => {
      progress += 1;
      const ratio = Math.min(1, progress / steps);
      next.volume = targetVolume * ratio;
      previous.volume = Math.max(0, previous.volume * (1 - ratio));
      if (ratio >= 1) {
        window.clearInterval(this.musicFadeTimer);
        this.musicFadeTimer = null;
        previous.pause();
        previous.removeAttribute("src");
        previous.load();
      }
    }, 45);
  }

  ensureContext() {
    if (!this.enabled) return null;
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      this.context = new AudioContext();
    }
    if (this.context.state === "suspended") this.context.resume();
    return this.context;
  }

  tone(frequency, duration, options = {}) {
    if (this.sfxVolume <= 0) return;
    const context = this.ensureContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = options.type || "sine";
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    if (options.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, options.endFrequency),
        context.currentTime + duration,
      );
    }
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      (options.volume || 0.025) * this.sfxVolume,
      context.currentTime + 0.012,
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + duration,
    );
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.02);
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
    this.tone(heavy ? 88 : 120, heavy ? 0.22 : 0.13, {
      type: "sawtooth",
      endFrequency: heavy ? 42 : 68,
      volume: heavy ? 0.045 : 0.03,
    });
  }

  heal() {
    this.tone(520, 0.22, {
      type: "sine",
      endFrequency: 760,
      volume: 0.02,
    });
    window.setTimeout(
      () => this.tone(680, 0.18, { type: "sine", volume: 0.012 }),
      80,
    );
  }

  victory() {
    [262, 330, 392, 523].forEach((frequency, index) => {
      window.setTimeout(
        () =>
          this.tone(frequency, 0.28, {
            type: "triangle",
            volume: 0.024,
          }),
        index * 95,
      );
    });
  }

  defeat() {
    [220, 174, 130].forEach((frequency, index) => {
      window.setTimeout(
        () =>
          this.tone(frequency, 0.4, {
            type: "sine",
            endFrequency: frequency * 0.78,
            volume: 0.02,
          }),
        index * 130,
      );
    });
  }
}

export const sound = new SoundEngine();
