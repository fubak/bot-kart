// Procedural music engine — WebAudio pattern sequencer, no assets.
// Per-track grooves (setTheme, keyed by TRACKS index):
//   0 PROVING GROUNDS — bright C-major bounce, fast square-lead arps
//   1 SWITCHBACK RIDGE — driving E-minor mid-tempo, syncopated bass
//   2 NEON NIGHT — slow A-minor synthwave, saw lead, dark hats
// Intensity scales with race position (behind = tenser). The lookahead
// scheduler is theme-agnostic — a theme swap only changes the tables the
// NEXT steps read, so the pattern pivots with no gap or restart.
// Wired into Audio by Game; call setIntensity(positionFrac) each frame.

interface MusicTheme {
  bpm: number;
  root: number; // Hz of scale degree 0
  bass: readonly number[]; // 32 semitone offsets from root
  lead: readonly number[]; // 32 semitone offsets from root
  bassWave: OscillatorType;
  leadWave: OscillatorType;
  arpWave: OscillatorType;
  bassOct: number; // semitone shift applied to bass notes
  leadOct: number; // semitone shift applied to lead notes
  hatFreq: number; // hat highpass — lower reads darker
}

const STEPS = 32; // 2 bars of 16ths

const THEMES: readonly MusicTheme[] = [
  {
    // Proving Grounds — pastoral day. C major, quickest tempo, chiptune-bright
    // square lead over a I–IV–V–vi bounce.
    bpm: 146,
    root: 261.63, // C4
    bass: [
      0, 0, 0, 0, 5, 5, 5, 5, 7, 7, 7, 7, 5, 5, 5, 5,
      9, 9, 9, 9, 5, 5, 5, 5, 7, 7, 7, 7, 12, 12, 7, 7,
    ],
    lead: [
      0, 4, 7, 9, 12, 9, 7, 4, 0, 4, 7, 9, 14, 12, 9, 7,
      0, 4, 7, 9, 12, 9, 7, 4, 2, 4, 7, 9, 14, 12, 9, 7,
    ],
    bassWave: 'square',
    leadWave: 'square',
    arpWave: 'triangle',
    bassOct: -24,
    leadOct: 12,
    hatFreq: 7500,
  },
  {
    // Switchback Ridge — golden-hour technical course. E minor, mid tempo,
    // syncopated driving bass (root–fifth kicks) under a sparser saw lead.
    bpm: 134,
    root: 164.81, // E3
    bass: [
      0, 0, 7, 0, 0, 0, 7, 0, 3, 3, 10, 3, 5, 5, 12, 5,
      0, 0, 7, 0, 0, 0, 7, 0, 10, 10, 8, 10, 12, 12, 10, 7,
    ],
    lead: [
      0, 3, 7, 10, 12, 10, 7, 3, 0, 3, 7, 10, 14, 12, 10, 7,
      0, 3, 7, 10, 15, 12, 10, 7, 3, 5, 7, 10, 12, 10, 7, 5,
    ],
    bassWave: 'square',
    leadWave: 'sawtooth',
    arpWave: 'square',
    bassOct: -12,
    leadOct: 12,
    hatFreq: 7000,
  },
  {
    // Neon Night — synthwave. A minor, slow pulse, i–VI–III–VII held-root
    // bass, moody saw lead an octave down, darker hats.
    bpm: 114,
    root: 110, // A2
    bass: [
      0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 8, 8, 8, 8,
      3, 3, 3, 3, 3, 3, 3, 3, 10, 10, 10, 10, 10, 10, 10, 10,
    ],
    lead: [
      0, 3, 7, 12, 10, 7, 3, 0, 8, 7, 3, 7, 10, 7, 3, 0,
      0, 3, 7, 12, 15, 12, 10, 7, 10, 12, 10, 7, 5, 7, 3, 0,
    ],
    bassWave: 'sawtooth',
    leadWave: 'sawtooth',
    arpWave: 'sawtooth',
    bassOct: 0,
    leadOct: 12,
    hatFreq: 5200,
  },
];

export class Music {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private timer = 0;
  private step = 0;
  private nextT = 0;
  private intensity = 0.5; // 0 = relaxed, 1 = last-lap frenzy
  private playing = false;
  private theme: MusicTheme = THEMES[0];
  /** QA introspection — which TRACKS-index groove is armed. */
  themeIdx = 0;

  attach(ctx: AudioContext, master: GainNode): void {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.16;
    this.out.connect(master);
  }

  start(): void {
    if (!this.ctx || this.playing) return;
    this.playing = true;
    this.step = 0;
    this.nextT = this.ctx.currentTime + 0.05;
    this.schedule();
  }

  stop(): void {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = 0;
  }

  /** 0..1 — how hard the race is pushing (call each frame). */
  setIntensity(v: number): void {
    this.intensity = Math.min(1, Math.max(0, v));
  }

  /** Swap the groove tables. Already-queued steps (≤0.12 s) finish on the
   *  old theme; everything scheduled after pivots — no silence, no restart. */
  setTheme(idx: number): void {
    this.themeIdx = idx;
    this.theme = THEMES[idx] ?? THEMES[0];
  }

  private stepDur(): number {
    return 60 / this.theme.bpm / 4; // 16th note
  }

  private st(n: number): number {
    return this.theme.root * Math.pow(2, n / 12);
  }

  private schedule(): void {
    // Lookahead scheduler: queue ~0.12 s of steps every 30 ms.
    this.timer = window.setInterval(() => {
      if (!this.ctx || !this.playing) return;
      while (this.nextT < this.ctx.currentTime + 0.12) {
        this.playStep(this.step, this.nextT);
        this.nextT += this.stepDur();
        this.step = (this.step + 1) % STEPS;
      }
    }, 30);
  }

  private playStep(s: number, t: number): void {
    const th = this.theme;
    const step = this.stepDur();
    // Kick on beats; hat on 8ths (denser at high intensity).
    if (s % 4 === 0) this.kick(t);
    if (s % 2 === 1 && (this.intensity > 0.4 || s % 4 === 1)) this.hat(t);
    // Bass on 8ths.
    if (s % 2 === 0) {
      this.tone(this.st(th.bass[s] + th.bassOct), t, step * 0.9, th.bassWave, 0.5);
    }
    // Lead arps — more notes when intensity high.
    if (this.intensity > 0.25 && s % 2 === 0) {
      this.tone(this.st(th.lead[s] + th.leadOct), t, step * 0.6, th.leadWave, 0.22);
    }
    if (this.intensity > 0.7 && s % 2 === 1) {
      this.tone(this.st(th.lead[(s + 1) % STEPS] + th.leadOct + 12), t, step * 0.4, th.arpWave, 0.18);
    }
  }

  private kick(t: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.09);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g).connect(this.out!);
    o.start(t);
    o.stop(t + 0.18);
  }

  private hat(t: number): void {
    const ctx = this.ctx!;
    const n = ctx.createBufferSource();
    const len = Math.floor(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    n.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = this.theme.hatFreq;
    const g = ctx.createGain();
    g.gain.value = 0.25;
    n.connect(f).connect(g).connect(this.out!);
    n.start(t);
  }

  private tone(
    freq: number,
    t: number,
    dur: number,
    type: OscillatorType,
    vol: number,
  ): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}
