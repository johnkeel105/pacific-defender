type Bus = "master" | "sfx" | "music";

export class GameAudio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  sfx: GainNode | null = null;
  music: GainNode | null = null;
  volumes = { master: 0.85, sfx: 0.9, music: 0.45 };
  muted = false;
  private drone: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private ambient: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private lastShot = 0;
  private titleBuf: AudioBuffer | null = null;
  private titleSrc: AudioBufferSourceNode | null = null;
  private titleGain: GainNode | null = null;
  private titleWanted = false;
  private titleLoading = false;

  unlock() {
    this.ensureGraph();
    if (this.ctx?.state === "suspended") void this.ctx.resume();
    void this.preloadTitle();
  }

  ensureGraph() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC({ latencyHint: "interactive" });
    this.master = this.ctx.createGain();
    this.sfx = this.ctx.createGain();
    this.music = this.ctx.createGain();
    this.sfx.connect(this.master);
    this.music.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.applyVolumes();
    this.noiseBuf = this.makeNoise(1.2);
  }

  async preloadTitle() {
    this.ensureGraph();
    const ctx = this.ctx;
    if (!ctx || this.titleBuf || this.titleLoading) return;
    this.titleLoading = true;
    const urls = ["/audio/title-theme.mp3", "/audio/title-theme.ogg"];
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const raw = await res.arrayBuffer();
        this.titleBuf = await ctx.decodeAudioData(raw.slice(0));
        this.titleLoading = false;
        if (this.titleWanted) this.playTitle();
        return;
      } catch {
        /* try next format */
      }
    }
    this.titleLoading = false;
  }

  setMenuMusic(on: boolean) {
    this.titleWanted = on;
    if (on) this.playTitle();
    else this.stopTitle();
    if (this.ctx && this.ambientGain) {
      this.ambientGain.gain.setTargetAtTime(on ? 0.014 : 0.05, this.ctx.currentTime, 0.35);
    }
  }

  private playTitle() {
    if (!this.ctx || !this.music || !this.titleBuf || !this.titleWanted) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (this.titleSrc) return;
    const g = this.ctx.createGain();
    g.gain.value = 0.0001;
    const src = this.ctx.createBufferSource();
    src.buffer = this.titleBuf;
    src.loop = true;
    src.connect(g);
    g.connect(this.music);
    src.start();
    g.gain.setTargetAtTime(0.95, this.ctx.currentTime, 0.45);
    this.titleSrc = src;
    this.titleGain = g;
    src.onended = () => {
      if (this.titleSrc === src) this.titleSrc = null;
    };
  }

  private stopTitle() {
    if (!this.ctx || !this.titleSrc || !this.titleGain) {
      this.titleSrc = null;
      this.titleGain = null;
      return;
    }
    const src = this.titleSrc;
    const g = this.titleGain;
    const t = this.ctx.currentTime;
    g.gain.setTargetAtTime(0.0001, t, 0.25);
    try {
      src.stop(t + 0.9);
    } catch {
      /* already stopped */
    }
    this.titleSrc = null;
    this.titleGain = null;
  }

  debugTitle() {
    return {
      ctx: this.ctx?.state ?? "none",
      wanted: this.titleWanted,
      loaded: !!this.titleBuf,
      playing: !!this.titleSrc,
      dur: this.titleBuf?.duration ?? 0,
    };
  }

  setVolumes(v: { master: number; sfx: number; music: number }) {
    this.volumes = v;
    this.applyVolumes();
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx || !this.master || !this.sfx || !this.music) return;
    const mute = this.muted ? 0 : 1;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.master * this.volumes.master * mute, t, 0.03);
    this.sfx.gain.setTargetAtTime(this.volumes.sfx * this.volumes.sfx, t, 0.03);
    this.music.gain.setTargetAtTime(this.volumes.music * this.volumes.music, t, 0.03);
  }

  private bus(name: Bus): GainNode | null {
    if (name === "master") return this.master;
    if (name === "music") return this.music;
    return this.sfx;
  }

  private makeNoise(seconds: number) {
    if (!this.ctx) return null;
    const n = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private noiseBurst(duration: number, gain: number, freq: number, q: number, rate = 1) {
    if (!this.ctx || !this.sfx || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = rate;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfx);
    src.start(t);
    src.stop(t + duration + 0.05);
  }

  private tone(freq: number, duration: number, gain: number, type: OscillatorType = "sine", slide = 0) {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + duration + 0.02);
  }

  shot(kind: "m2" | "oerlikon" | "bofors" | "fiveinch") {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (kind === "m2" && now - this.lastShot < 0.018) return;
    this.lastShot = now;
    const jitter = 0.92 + Math.random() * 0.16;
    if (kind === "m2") {
      this.noiseBurst(0.045, 0.22, 1800 * jitter, 1.2, 1.4);
      this.tone(220 * jitter, 0.04, 0.08, "square");
    } else if (kind === "oerlikon") {
      this.noiseBurst(0.07, 0.32, 900 * jitter, 0.9, 1.1);
      this.tone(140 * jitter, 0.07, 0.14, "sawtooth", -80);
    } else if (kind === "bofors") {
      this.noiseBurst(0.12, 0.42, 420 * jitter, 0.7, 0.8);
      this.tone(90 * jitter, 0.14, 0.22, "sine", -50);
    } else {
      this.noiseBurst(0.28, 0.55, 220 * jitter, 0.5, 0.55);
      this.tone(62 * jitter, 0.32, 0.32, "sine", -30);
      this.tone(180, 0.18, 0.08, "triangle");
    }
  }

  explosion(size: number, pan = 0) {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25 + size * 0.35, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4 + size * 0.5);
    if (this.noiseBuf) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 400 + size * 500;
      src.connect(lp);
      lp.connect(g);
      src.start(t);
      src.stop(t + 0.8);
    }
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(120 + size * 40, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.4);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.45);
    g.connect(p);
    p.connect(this.sfx);
  }

  splash() {
    this.noiseBurst(0.25, 0.16, 700, 0.5, 0.9);
  }

  hit() {
    this.tone(420, 0.05, 0.07, "square");
    this.noiseBurst(0.04, 0.1, 2400, 2, 1.6);
  }

  hullHit() {
    this.tone(70, 0.3, 0.2, "sine", -20);
    this.noiseBurst(0.3, 0.28, 180, 0.6, 0.5);
  }

  empty() {
    this.tone(180, 0.04, 0.05, "square");
  }

  reload() {
    this.noiseBurst(0.12, 0.08, 500, 1.4, 0.7);
    this.tone(140, 0.08, 0.05, "triangle");
  }

  alarm() {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = this.ctx.createOscillator();
      o.type = "square";
      o.frequency.value = 620;
      const g = this.ctx.createGain();
      const start = t + i * 0.22;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.07, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      o.connect(g);
      g.connect(this.sfx);
      o.start(start);
      o.stop(start + 0.18);
    }
  }

  startAmbience() {
    if (!this.ctx || !this.music || this.ambient) return;
    this.ambient = this.ctx.createOscillator();
    this.ambient.type = "sine";
    this.ambient.frequency.value = 48;
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.05;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 6;
    lfo.connect(lfoGain);
    lfoGain.connect(this.ambient.frequency);
    this.ambient.connect(this.ambientGain);
    this.ambientGain.connect(this.music);
    this.ambient.start();
    lfo.start();
  }

  setDrone(amount: number) {
    if (!this.ctx || !this.sfx) return;
    if (amount <= 0.02) {
      if (this.droneGain) this.droneGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
      return;
    }
    if (!this.drone) {
      this.drone = this.ctx.createOscillator();
      this.drone.type = "sawtooth";
      this.drone.frequency.value = 78;
      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.value = 0.0001;
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 320;
      this.drone.connect(f);
      f.connect(this.droneGain);
      this.droneGain.connect(this.sfx);
      this.drone.start();
    }
    this.drone.frequency.setTargetAtTime(70 + amount * 40, this.ctx.currentTime, 0.08);
    this.droneGain?.gain.setTargetAtTime(Math.min(0.07, amount * 0.08), this.ctx.currentTime, 0.08);
  }

  resume() {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  dispose() {
    try {
      this.drone?.stop();
      this.ambient?.stop();
      this.titleSrc?.stop();
      void this.ctx?.close();
    } catch {
      /* already closed */
    }
    this.ctx = null;
    this.drone = null;
    this.ambient = null;
    this.titleSrc = null;
    this.titleGain = null;
  }
}
