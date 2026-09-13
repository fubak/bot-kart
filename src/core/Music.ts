// Procedural music engine — WebAudio pattern sequencer, no assets.
// Upbeat kart-racing groove: driving kick + hats, bass line, bright lead
// arpeggio. Intensity scales with race position (behind = tenser).
// Wired into Audio by Game; call setIntensity(positionFrac) each frame.

const BPM = 138;
const STEP = 60 / BPM / 4; // 16th note
const STEPS = 32; // 2 bars

// A-minor-ish groove. Bass: root motion; lead: pentatonic arps.
const BASS = [0, 0, 0, 0, 5, 5, 5, 5, 3, 3, 3, 3, 7, 7, 7, 7,
              0, 0, 0, 0, 5, 5, 5, 5, 3, 3, 3, 3, 10, 10, 7, 7];
const LEAD = [0, 3, 5, 7, 12, 7, 5, 3, 0, 3, 7, 10, 12, 10, 7, 5,
              0, 3, 5, 7, 15, 12, 7, 5, 3, 5, 7, 10, 14, 12, 10, 7];
const ROOT = 220; // A3
const st = (n: number) => ROOT * Math.pow(2, n / 12);

export class Music {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private timer = 0;
  private step = 0;
  private nextT = 0;
  private intensity = 0.5; // 0 = relaxed, 1 = last-lap frenzy
  private playing = false;

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

  private schedule(): void {
    // Lookahead scheduler: queue ~0.12 s of steps every 30 ms.
    this.timer = window.setInterval(() => {
      if (!this.ctx || !this.playing) return;
      while (this.nextT < this.ctx.currentTime + 0.12) {
        this.playStep(this.step, this.nextT);
        this.nextT += STEP;
        this.step = (this.step + 1) % STEPS;
      }
    }, 30);
  }

  private playStep(s: number, t: number): void {
    const ctx = this.ctx!;
    const out = this.out!;
    // Kick on beats; hat on 8ths (denser at high intensity).
    if (s % 4 === 0) this.kick(t);
    if (s % 2 === 1 && (this.intensity > 0.4 || s % 4 === 1)) this.hat(t);
    // Bass on 8ths.
    if (s % 2 === 0) this.tone(st(BASS[s] - 24), t, STEP * 0.9, 'square', 0.5);
    // Lead arps — more notes when intensity high.
    if (this.intensity > 0.25 && s % 2 === 0) {
      this.tone(st(LEAD[s] + 12), t, STEP * 0.6, 'sawtooth', 0.22);
    }
    if (this.intensity > 0.7 && s % 2 === 1) {
      this.tone(st(LEAD[(s + 1) % STEPS] + 24), t, STEP * 0.4, 'triangle', 0.18);
    }
    void out;
    void ctx;
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
    f.frequency.value = 7000;
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
