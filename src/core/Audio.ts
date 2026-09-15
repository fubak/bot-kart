import type { Kart } from '../game/Kart';
import type { Race } from '../game/Race';
import type { ItemKind } from '../game/Items';
import { Music } from './Music';

// Procedural audio — Web Audio oscillators/noise, no samples. Engine pitch
// tracks speed, drift band-noise tracks slip, boost is a filtered whoosh,
// wall hits thump, countdown/lap/finish are chime blips. Items get one-shot
// cues (pickup chime, launch whooshes, spin-out wail, shield pop, splats),
// menus get move/confirm/back blips, and each circuit runs a low ambience
// bed (crowd+birds / ridge wind / neon hum) on its own bus. Context unlocks
// on the first real user gesture; every call no-ops while suspended so
// headless QA never crashes.

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private ambienceBus: GainNode | null = null;
  private engine: { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private skid: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private boost: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private lastCd = -1;
  private lastWallT = -1;
  private lastLap = 1;
  private lastPhase = 'countdown';
  private readonly music = new Music();
  private rivalEngines: { osc: OscillatorNode; gain: GainNode }[] = [];
  // Ambience bed: looping sources + a sparse-event timer, rebuilt per track.
  private ambSrcs: AudioScheduledSourceNode[] = [];
  private ambTimer = 0;
  private trackIdx = 0;
  /** QA introspection: one-shot SFX fired since unlock + the last one's tag. */
  sfxCount = 0;
  lastSfx = '';

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

    // Ambience bus — continuous per-track bed under SFX+music, scaled by
    // the master volume only (it isn't part of the music mix).
    this.ambienceBus = ctx.createGain();
    this.ambienceBus.gain.value = 1;
    this.ambienceBus.connect(this.master);
    this.startAmbience();

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
    this.tag('fanfare');
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.blip(f, 0.35, 0.4, 'triangle'), i * 140),
    );
  }

  // ------------------------------------------------------------------
  // One-shot SFX (items / UI / GP). All gate on a RUNNING context so a
  // suspended tab can't pile nodes onto a frozen currentTime, and all take
  // a vol multiplier so AI-side events fade with distance (Items computes
  // it). Node creation per shot is fine — these are event-rate, not
  // per-frame.

  private live(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  private tag(name: string): void {
    this.sfxCount++;
    this.lastSfx = name;
  }

  /** Osc with a freq glide f0→f1 and an instant-attack/exp-decay envelope. */
  private sweep(
    f0: number,
    f1: number,
    dur: number,
    gain = 0.3,
    type: OscillatorType = 'square',
    delay = 0,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || gain <= 0.001) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Filtered noise burst; freq optionally glides toward f1 over dur. */
  private noiseHit(
    dur: number,
    gain: number,
    type: BiquadFilterType,
    freq: number,
    q = 1,
    f1?: number,
    delay = 0,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.skid || gain <= 0.001) return;
    const t = ctx.currentTime + delay;
    const n = ctx.createBufferSource();
    n.buffer = this.skid.src.buffer!;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f).connect(g).connect(this.master);
    n.start(t);
    n.stop(t + dur + 0.02);
  }

  /** Item-box pickup: rolling tick, then a two-note acquire ding. */
  itemPickup(vol = 1): void {
    if (!this.live()) return;
    this.tag('pickup');
    this.sweep(1500, 1500, 0.05, 0.2 * vol, 'square');
    this.sweep(880, 880, 0.12, 0.26 * vol, 'triangle', 0.07);
    this.sweep(1318, 1318, 0.2, 0.22 * vol, 'triangle', 0.13);
  }

  /** Firing a held item — a distinct signature per kind. */
  itemLaunch(kind: ItemKind, vol = 1): void {
    if (!this.live()) return;
    this.tag(`launch:${kind}`);
    switch (kind) {
      case 'missile': // rocket launch — noise swell up + body pitch drop
        this.noiseHit(0.4, 0.4 * vol, 'bandpass', 500, 0.8, 3200);
        this.sweep(500, 160, 0.32, 0.16 * vol, 'sawtooth');
        break;
      case 'boost': // ignition chirp under the continuous boost loop
        this.sweep(240, 980, 0.22, 0.28 * vol, 'square');
        this.noiseHit(0.18, 0.18 * vol, 'highpass', 2400);
        break;
      case 'shield': // glassy raise
        this.sweep(520, 1500, 0.3, 0.24 * vol, 'triangle');
        this.sweep(1040, 2600, 0.3, 0.1 * vol, 'sine', 0.02);
        break;
      case 'ink': // wet forward toss — the victim splats land via inkHit
        this.noiseHit(0.18, 0.4 * vol, 'lowpass', 900);
        this.sweep(240, 70, 0.15, 0.26 * vol, 'sine');
        break;
      case 'swap': // teleport shimmer — fast up then sparkle down
        this.sweep(700, 2600, 0.16, 0.22 * vol, 'triangle');
        this.sweep(2600, 500, 0.22, 0.18 * vol, 'triangle', 0.14);
        break;
      case 'slick': // dropped hazard — short wet blub
        this.sweep(300, 80, 0.16, 0.3 * vol, 'square');
        this.noiseHit(0.1, 0.16 * vol, 'lowpass', 1400, 1, undefined, 0.03);
        break;
    }
  }

  /** Kart spun by missile/slick — descending siren wail + tire screech. */
  spinOut(vol = 1): void {
    if (!this.live()) return;
    this.tag('spinout');
    this.sweep(760, 170, 0.7, 0.32 * vol, 'sawtooth');
    this.noiseHit(0.3, 0.18 * vol, 'bandpass', 1600, 1.2, 700);
  }

  /** Shield consumed by a hit — glassy collapse + sparkle. */
  shieldPop(vol = 1): void {
    if (!this.live()) return;
    this.tag('shieldPop');
    this.sweep(1500, 480, 0.22, 0.24 * vol, 'triangle');
    this.noiseHit(0.12, 0.18 * vol, 'highpass', 3000);
  }

  /** Ink landing on a victim — wet splat at their position. */
  inkHit(vol = 1): void {
    if (!this.live()) return;
    this.tag('inkHit');
    this.noiseHit(0.16, 0.42 * vol, 'lowpass', 800);
    this.sweep(300, 90, 0.14, 0.22 * vol, 'sine');
  }

  /** Boost pad drive-over — quick zap (fires on a 1 s pad cooldown). */
  padBoost(vol = 1): void {
    if (!this.live()) return;
    this.tag('pad');
    this.sweep(480, 1400, 0.12, 0.18 * vol, 'square');
  }

  /** Menu cursor move — short quiet blip. */
  uiMove(): void {
    if (!this.live()) return;
    this.tag('uiMove');
    this.sweep(700, 700, 0.045, 0.15, 'square');
  }

  /** Menu value nudge / minor toggle — shortest tick. */
  uiTick(): void {
    if (!this.live()) return;
    this.tag('uiTick');
    this.sweep(540, 540, 0.035, 0.11, 'square');
  }

  /** Menu confirm / race start — two-note rising ack. */
  uiConfirm(): void {
    if (!this.live()) return;
    this.tag('uiConfirm');
    this.sweep(660, 660, 0.07, 0.18, 'triangle');
    this.sweep(990, 990, 0.12, 0.16, 'triangle', 0.06);
  }

  /** Menu back / pause / quit — short falling blip. */
  uiBack(): void {
    if (!this.live()) return;
    this.tag('uiBack');
    this.sweep(560, 330, 0.1, 0.17, 'triangle');
  }

  /** Grand Prix final standings — longer champion fanfare than the per-leg
   *  finish arpeggio: full ascent then a held major triad. */
  gpChampion(): void {
    if (!this.live()) return;
    this.tag('champion');
    const seq = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    seq.forEach((f, i) => this.sweep(f, f, 0.22, 0.3, 'triangle', i * 0.13));
    [1046.5, 1318.51, 1567.98].forEach((f) =>
      this.sweep(f, f, 1.5, 0.18, 'triangle', 0.7),
    );
  }

  // ------------------------------------------------------------------
  // Ambience bed — one low continuous loop per circuit on its own bus.
  // PG: crowd murmur + soft wind + sparse bird chirps. SR: exposed ridge
  // wind with random gust swells. NN: detuned mains hum + city hiss +
  // sparse electric crackle. All gains sit at bed level (≤~0.08).

  /** Retune the groove + swap the ambience bed for TRACKS[idx]. Safe before
   *  unlock — the index is stored and the bed builds when the ctx comes up. */
  setTrack(idx: number): void {
    this.trackIdx = idx;
    this.music.setTheme(idx);
    this.startAmbience();
  }

  private startAmbience(): void {
    if (this.ambTimer) {
      clearInterval(this.ambTimer);
      this.ambTimer = 0;
    }
    for (const s of this.ambSrcs) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.ambSrcs = [];
    const ctx = this.ctx;
    const bus = this.ambienceBus;
    if (!ctx || !bus || !this.skid) return;
    const noise = this.skid.src.buffer!;

    // Looped noise → filter → gain. Returns the gain for gust modulation.
    const bed = (
      type: BiquadFilterType,
      freq: number,
      q: number,
      gain: number,
    ): GainNode => {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(f).connect(g).connect(bus);
      src.start();
      this.ambSrcs.push(src);
      return g;
    };
    const hum = (freq: number, gain: number): void => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 240;
      const g = ctx.createGain();
      g.gain.value = gain;
      o.connect(f).connect(g).connect(bus);
      o.start();
      this.ambSrcs.push(o);
    };
    const chirp = (f0: number, f1: number, dur: number, gain: number, delay = 0): void => {
      const t = ctx.currentTime + delay;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(bus);
      o.start(t);
      o.stop(t + dur + 0.02);
    };
    const crackle = (gain: number): void => {
      const t = ctx.currentTime;
      const n = ctx.createBufferSource();
      n.buffer = noise;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 2800 + Math.random() * 2400;
      f.Q.value = 6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
      n.connect(f).connect(g).connect(bus);
      n.start(t);
      n.stop(t + 0.05);
    };

    if (this.trackIdx === 0) {
      bed('lowpass', 260, 0.7, 0.05); // crowd murmur
      bed('bandpass', 520, 0.5, 0.022); // light breeze
      this.ambTimer = window.setInterval(() => {
        if (ctx.state !== 'running' || Math.random() > 0.16) return;
        const f = 2300 + Math.random() * 1400;
        chirp(f, f * 0.72, 0.09, 0.045); // bird: quick down-chirp…
        if (Math.random() < 0.5) chirp(f * 1.2, f * 0.85, 0.07, 0.035, 0.1); // …sometimes doubled
      }, 480);
    } else if (this.trackIdx === 1) {
      bed('lowpass', 130, 0.7, 0.045); // ground rumble
      const gust = bed('bandpass', 640, 0.6, 0.03); // wind, gust-modulated
      this.ambTimer = window.setInterval(() => {
        if (ctx.state !== 'running') return;
        gust.gain.setTargetAtTime(0.02 + Math.random() * 0.055, ctx.currentTime, 0.5);
      }, 900);
    } else {
      hum(55, 0.05); // mains hum, detuned pair for a slow beat
      hum(55.7, 0.04);
      bed('bandpass', 1400, 0.4, 0.012); // faint city hiss
      this.ambTimer = window.setInterval(() => {
        if (ctx.state !== 'running' || Math.random() > 0.12) return;
        crackle(0.05); // neon transformer snap
      }, 520);
    }
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
