export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.ambienceGain = null;
    this.sfxGain = null;

    this.volume = 0.7;
    this.muted = false;
    this.isPlaying = false;
    this.lowEnergyMode = false;

    this._musicTimer = null;
    this._ambienceTimer = null;
    this._stepIndex = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.ambienceGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();

    this.musicGain.connect(this.masterGain);
    this.ambienceGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this._applyVolumes();
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, Number(val)));
    this._applyVolumes();
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this._applyVolumes();
  }

  setLowEnergyMode(isLow) {
    if (this.lowEnergyMode === isLow) return;
    this.lowEnergyMode = isLow;
    this._applyVolumes();
  }

  _applyVolumes() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const effective = this.muted ? 0 : this.volume;
    this.masterGain.gain.setTargetAtTime(effective, now, 0.08);
    this.musicGain.gain.setTargetAtTime(this.lowEnergyMode ? 0.16 : 0.24, now, 0.25);
    this.ambienceGain.gain.setTargetAtTime(this.lowEnergyMode ? 0.28 : 0.15, now, 0.3);
    this.sfxGain.gain.setTargetAtTime(0.45, now, 0.05);
  }

  startAtmosphere() {
    this.init();
    if (!this.ctx || this.isPlaying) return;
    this.isPlaying = true;
    this._scheduleMusicLoop();
    this._scheduleAmbienceLoop();
  }

  stopAtmosphere() {
    this.isPlaying = false;
    if (this._musicTimer) clearTimeout(this._musicTimer);
    if (this._ambienceTimer) clearTimeout(this._ambienceTimer);
    this._musicTimer = null;
    this._ambienceTimer = null;
  }

  _scheduleMusicLoop() {
    if (!this.isPlaying || !this.ctx) return;

    // Gentle slendro-inspired pentatonic notes (Hz)
    const motif = [261.63, 293.66, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66, 261.63, 220.0, 261.63, 329.63];
    const freq = motif[this._stepIndex % motif.length];

    if (this.ctx.state === "running") {
      this._playKecapiNote(freq, this.lowEnergyMode ? 1.8 : 1.3);
      if (this._stepIndex % 4 === 0) {
        // Soft suling breath tone an octave up or fifth
        this._playSulingNote(freq * 1.5, this.lowEnergyMode ? 2.4 : 1.7);
      }
    }

    this._stepIndex += 1;
    const baseInterval = this.lowEnergyMode ? 1450 : 950;
    const jitter = Math.random() * 220;
    this._musicTimer = setTimeout(() => this._scheduleMusicLoop(), baseInterval + jitter);
  }

  _scheduleAmbienceLoop() {
    if (!this.isPlaying || !this.ctx) return;

    if (this.ctx.state === "running") {
      this._playCricketChirp();
      if (!this.lowEnergyMode && Math.random() < 0.12) {
        this._playDistantFowl();
      }
    }

    const interval = this.lowEnergyMode ? 1600 + Math.random() * 1400 : 2800 + Math.random() * 2600;
    this._ambienceTimer = setTimeout(() => this._scheduleAmbienceLoop(), interval);
  }

  _playKecapiNote(freq, duration) {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now);

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(freq * 2, now);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(420, now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + duration + 0.05);
    osc2.stop(now + duration + 0.05);
  }

  _playSulingNote(freq, duration) {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);

    lfo.type = "sine";
    lfo.frequency.setValueAtTime(4.2, now);
    lfoGain.gain.setValueAtTime(3.2, now);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.055, now + duration * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(now);
    lfo.start(now);
    osc.stop(now + duration + 0.05);
    lfo.stop(now + duration + 0.05);
  }

  _playCricketChirp() {
    const now = this.ctx.currentTime;
    const pulses = 3 + Math.floor(Math.random() * 2);
    const baseFreq = 3950 + Math.random() * 250;

    for (let i = 0; i < pulses; i++) {
      const t = now + i * 0.075;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(baseFreq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(this.lowEnergyMode ? 0.045 : 0.025, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      osc.connect(gain);
      gain.connect(this.ambienceGain);
      osc.start(t);
      osc.stop(t + 0.055);
    }
  }

  _playDistantFowl() {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.linearRampToValueAtTime(640, now + 0.14);
    osc.frequency.linearRampToValueAtTime(430, now + 0.34);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.02, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

    osc.connect(gain);
    gain.connect(this.ambienceGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  playDialogTick() {
    this.init();
    if (!this.ctx || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(340 + Math.random() * 40, now);
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.035);
  }

  playWrite() {
    this.init();
    if (!this.ctx || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.18);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.sin((i / bufferSize) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env * 0.22;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(2200, now);
    filter.Q.setValueAtTime(1.8, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.26, now);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start(now);
  }

  playCorrect() {
    this.init();
    if (!this.ctx || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.48);
    });
    setTimeout(() => this.playWrite(), 110);
  }

  playWrong() {
    this.init();
    if (!this.ctx || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    // Soft gentle low woodblock tap, never a harsh buzzer
    [196.0, 164.81].forEach((freq, idx) => {
      const t = now + idx * 0.14;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.82, t + 0.16);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  playQuestion() {
    this.init();
    if (!this.ctx || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    [392.0, 523.25].forEach((freq, idx) => {
      const t = now + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  playCough() {
    this.init();
    if (!this.ctx || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    [0, 0.2].forEach((offset) => {
      const t = now + offset;
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.14);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const env = Math.sin((i / bufferSize) * Math.PI);
        data[i] = (Math.random() * 2 - 1) * env * 0.4;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(420, t);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.32, t);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      src.start(t);
    });
  }

  playEnding(isWin) {
    this.init();
    if (!this.ctx || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    const notes = isWin ? [261.63, 329.63, 392.0, 523.25, 659.25] : [329.63, 293.66, 261.63, 196.0];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.18;
      this._playKecapiNote(freq, 1.8);
      if (isWin && idx >= 2) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.11, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 1.45);
      }
    });
  }
}
