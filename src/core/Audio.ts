import type { Kart } from '../game/Kart';
import type { Race } from '../game/Race';
import { Music } from './Music';

// Procedural audio — Web Audio oscillators/noise, no samples. Engine pitch
// tracks speed, drift band-noise tracks slip, boost is a filtered whoosh,
// wall hits thump, countdown/lap/finish are chime blips. Context unlocks on
// the first real user gesture; every call no-ops while suspended so headless
// QA never crashes.

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private engine: { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private skid: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private boost: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private lastCd = -1;
  private lastWallT = -1;
  private lastLap = 1;
  private lastPhase = 'countdown';
  private readonly music = new Music();
  private rivalEngines: { osc: OscillatorNode; gain: GainNode }[] = [];

  /** Call once on a trusted user gesture (keydown/pointerdown). */
  unlock(): void {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);

    // Engine: saw → lowpass → gain. Pitch = speed-driven.
    const eOsc = ctx.createOscillator();
    eOsc.type = 'sawtooth';
    const eFilter = ctx.createBiquadFilter();
    eFilter.type = 'lowpass';
    eFilter.frequency.value = 900;
    const eGain = ctx.createGain();
    eGain.gain.value = 0;
    eOsc.connect(eFilter).connect(eGain).connect(this.master);
    eOsc.start();
    this.engine = { osc: eOsc, gain: eGain, filter: eFilter };

    const noiseBuf = this.makeNoise();

    // Skid: bandpassed noise, gain driven by drift/slip.
    const sSrc = ctx.createBufferSource();
    sSrc.buffer = noiseBuf;
    sSrc.loop = true;
    const sFilter = ctx.createBiquadFilter();
    sFilter.type = 'bandpass';
    sFilter.frequency.value = 1400;
    sFilter.Q.value = 1.2;
    const sGain = ctx.createGain();
    sGain.gain.value = 0;
    sSrc.connect(sFilter).connect(sGain).connect(this.master);
    sSrc.start();
    this.skid = { src: sSrc, gain: sGain, filter: sFilter };

    // Boost: lowpassed noise whoosh.
    const bSrc = ctx.createBufferSource();
    bSrc.buffer = noiseBuf;
    bSrc.loop = true;
    const bFilter = ctx.createBiquadFilter();
    bFilter.type = 'lowpass';
    bFilter.frequency.value = 400;
    const bGain = ctx.createGain();
    bGain.gain.value = 0;
    bSrc.connect(bFilter).connect(bGain).connect(this.master);
    bSrc.start();
    this.boost = { src: bSrc, gain: bGain, filter: bFilter };

    // Music gets its own bus so options can mix it vs SFX independently.
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.8;
    this.musicBus.connect(this.master);
    this.music.attach(ctx, this.musicBus);
    this.music.start();

    // Rival engines: one quiet saw per AI kart, gain tracks distance so
    // nearby racers are audible — sells the pack-racing fantasy.
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = 90;
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(g).connect(this.master);
      o.start();
      this.rivalEngines.push({ osc: o, gain: g });
    }
  }

  /** Options sliders — 0..1. Master scales the 0.55 headroom ceiling. */
  setMasterVolume(v: number): void {
    if (this.master) this.master.gain.value = 0.55 * v;
  }
  setMusicVolume(v: number): void {
    if (this.musicBus) this.musicBus.gain.value = v;
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private blip(freq: number, dur: number, gain = 0.35, type: OscillatorType = 'square'): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur);
  }

  private thump(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.25);
    // Plus a short noise clap.
    const n = this.ctx.createBufferSource();
    n.buffer = this.skid!.src.buffer!;
    const nf = this.ctx.createBiquadFilter();
    nf.type = 'highpass';
    nf.frequency.value = 1800;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.3, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    n.connect(nf).connect(ng).connect(this.master);
    n.start(t);
    n.stop(t + 0.12);
  }

  private fanfare(): void {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.blip(f, 0.35, 0.4, 'triangle'), i * 140),
    );
  }

  /** Per-frame update: reads kart + race state, drives continuous sources. */
  update(kart: Kart, race: Race, simTime: number, rivals: Kart[] = []): void {
    if (!this.ctx || this.ctx.state === 'suspended') return;

    // --- countdown beeps ---
    if (race.phase === 'countdown') {
      const c = Math.ceil(race.countdownLeft);
      if (c !== this.lastCd && c > 0) {
        this.lastCd = c;
        this.blip(440, 0.12);
      }
    } else if (this.lastCd !== 0) {
      // Transitioned out of countdown → GO!
      this.lastCd = 0;
      this.blip(880, 0.3, 0.4);
    }

    // --- lap / finish ---
    if (race.phase === 'racing' && race.lap !== this.lastLap) {
      this.blip(660, 0.15, 0.4, 'triangle');
      setTimeout(() => this.blip(990, 0.2, 0.4, 'triangle'), 120);
    }
    this.lastLap = race.lap;
    if (race.phase === 'finished' && this.lastPhase !== 'finished') this.fanfare();
    this.lastPhase = race.phase;

    // --- wall impact ---
    if (kart.lastWallHit !== this.lastWallT && kart.lastWallHit >= 0) {
      this.lastWallT = kart.lastWallHit;
      this.thump();
    }

    // --- engine: pitch tracks forward speed, boosted while boosting ---
    const sp = kart.speed / 28;
    const boost = kart.boostTimer > 0;
    const freq = 60 + sp * 190 + (boost ? 60 : 0);
    this.engine!.osc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
    this.engine!.filter.frequency.setTargetAtTime(600 + sp * 1600, this.ctx.currentTime, 0.1);
    const eGain = race.allowsDrive ? 0.05 + sp * 0.11 : 0.03;
    this.engine!.gain.gain.setTargetAtTime(eGain, this.ctx.currentTime, 0.08);

    // --- skid while drifting (louder with slip) ---
    const skidTarget =
      kart.state === 'drift' ? Math.min(0.4, Math.abs(kart.slipAngle) * 1.4) : 0;
    this.skid!.gain.gain.setTargetAtTime(skidTarget, this.ctx.currentTime, 0.06);
    this.skid!.filter.frequency.setTargetAtTime(
      900 + Math.abs(kart.slipAngle) * 2200,
      this.ctx.currentTime,
      0.08,
    );

    // --- boost whoosh ---
    this.boost!.gain.gain.setTargetAtTime(boost ? 0.28 : 0, this.ctx.currentTime, 0.07);
    this.boost!.filter.frequency.setTargetAtTime(
      boost ? 2400 : 400,
      this.ctx.currentTime,
      0.12,
    );

    // --- rival engines: distance-attenuated hum ---
    for (let i = 0; i < this.rivalEngines.length; i++) {
      const rk = rivals[i];
      const e = this.rivalEngines[i];
      if (!rk) continue;
      const d = kart.position.distanceTo(rk.position);
      const near = Math.max(0, 1 - d / 26); // audible within ~26 m
      const rsp = rk.speed / 28;
      e.osc.frequency.setTargetAtTime(70 + rsp * 150, this.ctx.currentTime, 0.08);
      e.gain.gain.setTargetAtTime(near * 0.05, this.ctx.currentTime, 0.1);
    }

    // Music intensity: sparse countdown → full race groove, hottest on the
    // last lap, drops out after the flag.
    this.music.setIntensity(
      race.phase === 'racing'
        ? 0.35 + 0.4 * (race.lap / race.totalLaps)
        : race.phase === 'finished'
          ? 0.2
          : 0.1,
    );
    void simTime;
  }
}
