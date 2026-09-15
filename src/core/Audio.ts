import type { Kart } from '../game/Kart';
import type { Race } from '../game/Race';
import { ROULETTE_S, type ItemKind, type Items } from '../game/Items';
import { AUDIO, KART } from '../config/tuning';
import { Music } from './Music';

// Procedural audio — Web Audio oscillators/noise, no samples. Engine pitch
// tracks speed, drift band-noise tracks slip, boost is a filtered whoosh,
// wall hits thump, countdown/lap/finish are chime blips. Items get one-shot
// cues (pickup chime, launch whooshes, spin-out wail, shield pop, splats),
// menus get move/confirm/back blips, and each circuit runs a low ambience
// bed (crowd+birds / ridge wind / neon hum) on its own bus. Context unlocks
// on the first real user gesture; every call no-ops while suspended so
// headless QA never crashes.
//
// SFX-DEEP layer: per-frame state diffs turn gameplay events into cues —
// roulette slot ticks, drift-charge tier blips, tier-colored mini-turbo
// release, slipstream wind rush, drift-entry hop chirp, landing thuds,
// kart-kart thocks, wall-grind scrape + gravel rumble + draft wind loops,
// position-change arps, final-lap flourish, GO chord, respawn riser, and a
// crowd swell under the finish fanfare. Continuous cues are looped
// source→filter→gain chains built once in unlock() and gain-driven per
// frame (no retriggering, no per-frame node allocation); one-shots build
// nodes per event only. Every AudioParam write is finite-guarded — a NaN
// throws, so kart/race inputs are sanitized before reaching a param.

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private ambienceBus: GainNode | null = null;
  private engine: { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private skid: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private boost: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  // SFX-DEEP continuous loops (all share the noise buffer, gain-driven):
  // slipstream wind layer, wall-grind scrape, off-road gravel rumble.
  private wind: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private scrape: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private rumble: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private lastCd = -1;
  private lastWallT = -1;
  private lastLap = 1;
  private lastPhase = 'countdown';
  // SFX-DEEP state-diff memory — each mirrors the gameplay channel it
  // watches so update() can fire a one-shot exactly on the transition.
  private lastRouletteTick = 0;
  private rouletteWasSpinning = false;
  private lastDriftDir = 0;
  private lastDriftCharge = 0;
  private lastDriftTier = -1;
  private lastDrafts = 0;
  private wasGrounded = true;
  private airPeak = 0; // longest airborne streak before this landing (s)
  private lastBumps = 0;
  private bumpAudioAt = -10; // ctx.currentTime of last thock (rate limit)
  private lastPos = 1;
  private lastResetCount = 0; // kart.reset() bumps — re-seeds every diff
  private readonly music = new Music();
  private rivalEngines: { osc: OscillatorNode; gain: GainNode }[] = [];
  // Ambience bed: looping sources + a sparse-event timer, rebuilt per track.
  private ambSrcs: AudioScheduledSourceNode[] = [];
  private ambTimer = 0;
  private trackIdx = 0;
  /** QA introspection: one-shot SFX fired since unlock + the last one's tag. */
  sfxCount = 0;
  lastSfx = '';
  /** Per-tag fire tally — QA counts each cue type separately. */
  readonly sfxByTag: Record<string, number> = {};

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

    // Slipstream wind layer: bandpassed noise sustained while the draft
    // burst is on — under the one-shot whoosh that marks the trigger.
    const wSrc = ctx.createBufferSource();
    wSrc.buffer = noiseBuf;
    wSrc.loop = true;
    const wFilter = ctx.createBiquadFilter();
    wFilter.type = 'bandpass';
    wFilter.frequency.value = 800;
    wFilter.Q.value = 0.8;
    const wGain = ctx.createGain();
    wGain.gain.value = 0;
    wSrc.connect(wFilter).connect(wGain).connect(this.master);
    wSrc.start();
    this.wind = { src: wSrc, gain: wGain, filter: wFilter };

    // Wall-grind scrape: tighter bandpass than the skid loop (~1.1-2.5 kHz)
    // so rail-grinding reads as a rough scrape, not a tire slide.
    const gSrc = ctx.createBufferSource();
    gSrc.buffer = noiseBuf;
    gSrc.loop = true;
    const gFilter = ctx.createBiquadFilter();
    gFilter.type = 'bandpass';
    gFilter.frequency.value = 1600;
    gFilter.Q.value = 2.6;
    const gGain = ctx.createGain();
    gGain.gain.value = 0;
    gSrc.connect(gFilter).connect(gGain).connect(this.master);
    gSrc.start();
    this.scrape = { src: gSrc, gain: gGain, filter: gFilter };

    // Off-road rumble: lowpassed noise bed while on gravel aprons at speed.
    const rSrc = ctx.createBufferSource();
    rSrc.buffer = noiseBuf;
    rSrc.loop = true;
    const rFilter = ctx.createBiquadFilter();
    rFilter.type = 'lowpass';
    rFilter.frequency.value = 210;
    const rGain = ctx.createGain();
    rGain.gain.value = 0;
    rSrc.connect(rFilter).connect(rGain).connect(this.master);
    rSrc.start();
    this.rumble = { src: rSrc, gain: rGain, filter: rFilter };

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

  /** Wall/item impact body-hit — gain and pitch scale with impact severity
   *  (0 = graze, 1 = full-speed shunt) via kart.lastWallImpact. */
  private thump(sev = 0.6): void {
    if (!this.ctx || !this.master) return;
    this.tag('wallHit');
    const s = Number.isFinite(sev) ? Math.min(1, Math.max(0, sev)) : 0.6;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(95 + s * 45, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22 + s * 0.3, t);
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
    ng.gain.setValueAtTime(0.12 + s * 0.2, t);
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
    this.sfxByTag[name] = (this.sfxByTag[name] ?? 0) + 1;
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

  /** Filtered noise SWELL: gain attacks over `atk` s before decaying —
   *  wind rushes and crowd swells need a rise, not noiseHit's instant hit. */
  private noiseSwell(
    dur: number,
    atk: number,
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
    f.frequency.setValueAtTime(Math.max(10, freq), t);
    if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.max(0.01, atk));
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f).connect(g).connect(this.master);
    n.start(t);
    n.stop(t + dur + 0.02);
  }
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

  // ------------------------------------------------------------------
  // SFX-DEEP cues — fired by the state diffs in update() (or by Game for
  // respawn). All quiet on purpose: they sit under the engine and music.

  /** Item roulette icon flip — short tick; pitch climbs as the spin slows
   *  (classic slot feel: fast flat ticks → slower, slightly higher taps). */
  private rouletteTickSfx(progress: number): void {
    if (!this.live()) return;
    this.tag('rouletteTick');
    const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
    const f = 640 + p * 320;
    this.sweep(f, f, 0.032, 0.13, 'square');
  }

  /** Roulette stops on the rolled item — bright two-note "item landed". */
  private rouletteLand(): void {
    if (!this.live()) return;
    this.tag('rouletteLand');
    this.sweep(988, 988, 0.08, 0.2, 'triangle');
    this.sweep(1480, 1480, 0.17, 0.18, 'triangle', 0.07);
  }

  /** Drift charge crossing tier `t` while sliding — soft rising "charge
   *  up" blip; the violet ultra tier gets a distinctive shimmer. */
  private chargeTier(tier: number): void {
    if (!this.live()) return;
    this.tag(`charge:${tier}`);
    if (tier === 0) {
      this.sweep(660, 1150, 0.12, 0.15, 'triangle');
    } else if (tier === 1) {
      this.sweep(820, 1450, 0.14, 0.17, 'triangle');
      this.sweep(1640, 2900, 0.12, 0.06, 'sine', 0.02);
    } else {
      this.sweep(920, 1950, 0.2, 0.19, 'triangle');
      this.sweep(1380, 2900, 0.22, 0.09, 'sine', 0.03);
      this.noiseHit(0.24, 0.07, 'highpass', 5200);
    }
  }

  /** Mini-turbo release — a deeper whoosh than pad/item boosts with a
   *  tier-colored chord (blue=root, orange=+fifth, violet=+octave). */
  private turboRelease(tier: number): void {
    if (!this.live()) return;
    this.tag(`turbo:${tier}`);
    this.noiseHit(0.4, 0.28, 'lowpass', 420, 0.8, 2100);
    const base = [330, 415, 494][tier] ?? 330;
    this.sweep(base * 0.5, base, 0.32, 0.2, 'sawtooth');
    if (tier >= 1) this.sweep(base * 0.75, base * 1.5, 0.32, 0.11, 'sawtooth', 0.02);
    if (tier >= 2) this.sweep(base, base * 2, 0.36, 0.09, 'triangle', 0.05);
  }

  /** Slipstream burst fires — ~0.6 s wind-rush swell under the sustained
   *  wind layer that runs for the burst duration. */
  private draftWhoosh(): void {
    if (!this.live()) return;
    this.tag('draft');
    this.noiseSwell(0.6, 0.14, 0.26, 'bandpass', 500, 0.8, 2600);
    this.sweep(160, 430, 0.45, 0.07, 'sine', 0.05);
  }

  /** Drift-entry hop — small chirp as the kart pops into the slide. */
  private hopChirp(): void {
    if (!this.live()) return;
    this.tag('hop');
    this.sweep(430, 900, 0.09, 0.13, 'triangle');
  }

  /** Touchdown — soft low thud, body + noise bed, scaled by fall time. */
  private landThud(sev: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.live()) return;
    const s = Number.isFinite(sev) ? Math.min(1, Math.max(0, sev)) : 0;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.13);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.1 + s * 0.26, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.2);
    this.noiseHit(0.09, 0.04 + s * 0.1, 'lowpass', 640);
  }

  /** Kart-vs-kart contact — mid "thock" (rate-limited at the call path). */
  private thock(sev: number): void {
    if (!this.live()) return;
    this.tag('bump');
    const s = Number.isFinite(sev) ? Math.min(1, Math.max(0, sev)) : 0;
    this.sweep(230, 120, 0.1, 0.2 + s * 0.14, 'sine');
    this.noiseHit(0.06, 0.13 + s * 0.1, 'lowpass', 1600);
  }

  /** Race position changed mid-race — quiet 3-note arp: rising = gained a
   *  place, falling = lost one. */
  private posStinger(up: boolean): void {
    if (!this.live()) return;
    this.tag(up ? 'posUp' : 'posDown');
    const seq = up ? [660, 880, 1108] : [620, 494, 392];
    seq.forEach((f, i) =>
      this.sweep(f, f, i === seq.length - 1 ? 0.16 : 0.08, 0.14, 'triangle', i * 0.08),
    );
  }

  /** Entering the last lap — a hotter flourish than the per-lap blip so
   *  "FINAL LAP" reads with real urgency. */
  private finalLap(): void {
    if (!this.live()) return;
    this.tag('finalLap');
    [784, 988, 1175, 1568].forEach((f, i) =>
      this.sweep(f, f, 0.11, 0.24, 'square', i * 0.085),
    );
    this.noiseHit(0.45, 0.09, 'highpass', 4200, 1, undefined, 0.12);
  }

  /** GO! — a brighter start chord than the countdown beeps. */
  private goHorn(): void {
    if (!this.live()) return;
    this.tag('go');
    [523, 659, 784].forEach((f) => this.sweep(f, f, 0.45, 0.16, 'sawtooth'));
    this.sweep(1046, 1046, 0.5, 0.2, 'square', 0.02);
    this.noiseHit(0.28, 0.1, 'highpass', 3200);
  }

  /** Lakitu/Backspace respawn — materialize riser matching the FX burst. */
  respawn(vol = 1): void {
    if (!this.live()) return;
    this.tag('respawn');
    this.sweep(260, 1650, 0.34, 0.18 * vol, 'sine');
    this.sweep(520, 2500, 0.3, 0.08 * vol, 'triangle', 0.04);
    this.noiseHit(0.22, 0.1 * vol, 'highpass', 2600, 1, 6200, 0.06);
  }

  /** Player crosses the line — crowd cheer swell layered under the
   *  finish fanfare (~1.5 s filtered-noise rise). */
  private crowdSwell(): void {
    if (!this.live()) return;
    this.tag('crowd');
    this.noiseSwell(1.5, 0.35, 0.2, 'bandpass', 800, 0.55, 1500);
    this.noiseSwell(1.3, 0.5, 0.11, 'bandpass', 1700, 0.7, 2600, 0.12);
  }

  /** QA probe: current continuous-loop output gains — the scrape/rumble/
   *  wind loops are gain-driven so the one-shot counters never see them. */
  loopLevels(): { scrape: number; rumble: number; wind: number } {
    return {
      scrape: this.scrape?.gain.gain.value ?? 0,
      rumble: this.rumble?.gain.gain.value ?? 0,
      wind: this.wind?.gain.gain.value ?? 0,
    };
  }

  /** QA dump: counters + per-tag tally + live loop levels in one shot. */
  sfxSnapshot(): {
    count: number;
    last: string;
    byTag: Record<string, number>;
    loops: { scrape: number; rumble: number; wind: number };
  } {
    return {
      count: this.sfxCount,
      last: this.lastSfx,
      byTag: { ...this.sfxByTag },
      loops: this.loopLevels(),
    };
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

  /** Per-frame update: reads kart + race state, drives continuous sources.
   *  `items` feeds the player-slot roulette ticks, `bumps` is Game's
   *  kart-vs-kart contact counter, `paused` ducks the new grind loops (a
   *  frozen kart state would otherwise sustain them under the pause menu). */
  update(
    kart: Kart,
    race: Race,
    simTime: number,
    rivals: Kart[] = [],
    items?: Items,
    bumps = 0,
    paused = false,
  ): void {
    if (!this.ctx || this.ctx.state === 'suspended') return;
    const now = this.ctx.currentTime;

    // Kart resets (respawn/restart/quit/swap-regrid) teleport state — every
    // transition memory re-seeds so no phantom cue fires off the jump.
    if (kart.resetCount !== this.lastResetCount) {
      this.lastResetCount = kart.resetCount;
      this.wasGrounded = kart.grounded;
      this.airPeak = 0;
      this.lastWallT = kart.lastWallHit;
      this.lastDriftDir = kart.driftDir;
      this.lastDriftCharge = kart.driftCharge;
      this.lastDriftTier = -1;
      this.lastDrafts = kart.draftsFired;
      this.lastBumps = bumps;
      this.rouletteWasSpinning = (items?.rouletteT[0] ?? 0) > 0;
      this.lastRouletteTick = items?.rouletteTick[0] ?? 0;
    }

    // --- countdown beeps → GO chord ---
    if (race.phase === 'countdown') {
      const c = Math.ceil(race.countdownLeft);
      if (c !== this.lastCd && c > 0) {
        this.lastCd = c;
        this.tag('beep');
        this.blip(440, 0.12);
      }
    } else if (this.lastCd !== 0) {
      // Transitioned out of countdown → GO! (gated on racing so quitting
      // to the title mid-countdown doesn't blast the start chord).
      this.lastCd = 0;
      if (race.phase === 'racing') this.goHorn();
    }

    // --- lap / finish ---
    if (race.phase === 'racing' && race.lap !== this.lastLap) {
      if (race.lap >= race.totalLaps) {
        this.finalLap();
      } else {
        this.tag('lap');
        this.blip(660, 0.15, 0.4, 'triangle');
        setTimeout(() => this.blip(990, 0.2, 0.4, 'triangle'), 120);
      }
    }
    this.lastLap = race.lap;
    if (race.phase === 'finished' && this.lastPhase !== 'finished') {
      this.fanfare();
      this.crowdSwell();
    }
    this.lastPhase = race.phase;

    // --- impact channel: lastWallHit carries walls, kart bumps, landings,
    // and item hits — the parallel bump counter + grounded edge tell them
    // apart so each gets its own voice (thock / soft thud / body thump). ---
    const bumped = bumps !== this.lastBumps;
    this.lastBumps = bumps;
    const impacted = kart.lastWallHit !== this.lastWallT && kart.lastWallHit >= 0;
    if (impacted) this.lastWallT = kart.lastWallHit;
    const landed = !this.wasGrounded && kart.grounded;
    const sev = Number.isFinite(kart.lastWallImpact)
      ? Math.min(1, Math.max(0, kart.lastWallImpact))
      : 0;
    if (impacted) {
      if (bumped) {
        if (now - this.bumpAudioAt >= AUDIO.bumpMinInterval) {
          this.bumpAudioAt = now;
          this.thock(0.35 + 0.65 * sev);
        }
      } else if (landed) {
        this.tag('land');
        this.landThud(sev);
      } else {
        this.thump(sev);
      }
    } else if (landed && this.airPeak > 0.2) {
      // Short hop below the kart's own 0.22 s feedback channel — soft tap.
      this.tag('land');
      this.landThud(Math.min(0.4, this.airPeak * 0.5));
    }
    if (!kart.grounded) {
      this.airPeak = Math.max(this.airPeak, kart.airTime);
    } else {
      this.airPeak = 0;
    }
    this.wasGrounded = kart.grounded;

    // --- drift events: entry hop chirp, charge-tier blips, release whoosh ---
    const dDir = kart.driftDir;
    const dChg = Number.isFinite(kart.driftCharge) ? kart.driftCharge : 0;
    if (this.lastDriftDir === 0 && dDir !== 0 && kart.grounded) this.hopChirp();
    if (dDir !== 0) {
      const tiers = KART.driftChargeTier;
      let tier = -1;
      for (let t = tiers.length - 1; t >= 0; t--) {
        if (dChg >= tiers[t]) {
          tier = t;
          break;
        }
      }
      if (tier > this.lastDriftTier) this.chargeTier(tier);
      this.lastDriftTier = tier;
    } else {
      // Drift released: a turbo fired only when the charge had reached a
      // tier (lastDriftCharge is the pre-reset sample — release zeroes it).
      if (
        this.lastDriftDir !== 0 &&
        !kart.isSpinning && // spin-out clears drift but isn't a release
        kart.boostTimer > 0 &&
        this.lastDriftCharge >= KART.driftChargeTier[0]
      ) {
        let tier = 0;
        for (let t = KART.driftChargeTier.length - 1; t >= 0; t--) {
          if (this.lastDriftCharge >= KART.driftChargeTier[t]) {
            tier = t;
            break;
          }
        }
        this.turboRelease(tier);
      }
      this.lastDriftTier = -1;
    }
    this.lastDriftDir = dDir;
    this.lastDriftCharge = dChg;

    // --- slipstream: wind-rush one-shot on the burst + sustained layer ---
    // (increment-only — a reset to 0 isn't a draft).
    if (kart.draftsFired > this.lastDrafts) {
      this.draftWhoosh();
    }
    this.lastDrafts = kart.draftsFired;
    const slipT = Number.isFinite(kart.slipstreamT) ? kart.slipstreamT : 0;
    const windT =
      !paused && slipT > 0 ? Math.min(AUDIO.windGain, 0.04 + slipT * 0.06) : 0;
    this.wind!.gain.gain.setTargetAtTime(windT, now, 0.1);
    this.wind!.filter.frequency.setTargetAtTime(700 + slipT * 500, now, 0.12);

    // --- wall-grind scrape + gravel-apron rumble (speed-following loops) ---
    const spd = Number.isFinite(kart.speed) ? kart.speed : 0;
    const scrapeT =
      !paused && kart.onWall && spd > AUDIO.scrapeMinSpeed
        ? Math.min(
            AUDIO.scrapeGain,
            0.02 + ((spd - AUDIO.scrapeMinSpeed) / 24) * AUDIO.scrapeGain,
          )
        : 0;
    this.scrape!.gain.gain.setTargetAtTime(scrapeT, now, 0.05);
    this.scrape!.filter.frequency.setTargetAtTime(1100 + spd * 55, now, 0.08);
    const rumbleT =
      !paused && kart.onGravel && kart.grounded && spd > AUDIO.rumbleMinSpeed
        ? Math.min(AUDIO.rumbleGain, 0.04 + (spd / KART.maxSpeed) * AUDIO.rumbleGain)
        : 0;
    this.rumble!.gain.gain.setTargetAtTime(rumbleT, now, 0.08);
    this.rumble!.filter.frequency.setTargetAtTime(160 + spd * 4, now, 0.1);

    // --- item roulette: a tick per icon flip on the player's slot + a
    // landing ding when the spin resolves (rivals' slots stay silent).
    // Racing-gated like the HUD — post-finish pickups spin silently. ---
    if (items && race.phase === 'racing') {
      const spinning = items.rouletteT[0] > 0;
      if (spinning) {
        const tick = items.rouletteTick[0] ?? 0;
        if (tick !== this.lastRouletteTick) {
          this.lastRouletteTick = tick;
          const progress = 1 - Math.max(0, items.rouletteT[0]) / ROULETTE_S;
          this.rouletteTickSfx(progress);
        }
      } else {
        // Ding only when the spin resolved naturally into a held item —
        // a reset mid-spin (restart/quit) clears the slot silently.
        if (this.rouletteWasSpinning && items.held[0]) this.rouletteLand();
        this.lastRouletteTick = 0;
      }
      this.rouletteWasSpinning = spinning;
    }

    // --- position-change stinger: seed while not racing so the GO
    // transition can't fire a phantom move, then arp on every swap. ---
    if (race.phase === 'racing') {
      const pos = race.positionOf(0);
      if (pos !== this.lastPos) {
        this.posStinger(pos < this.lastPos);
        this.lastPos = pos;
      }
    } else {
      this.lastPos = race.positionOf(0);
    }

    // --- engine: pitch tracks forward speed, boosted while boosting ---
    // Guard non-finite kart state (teleport/reset races can briefly NaN
    // speed) — setTargetAtTime throws on NaN and would spam the console.
    const sp = Number.isFinite(kart.speed) ? kart.speed / 28 : 0;
    const boost = kart.boostTimer > 0;
    const freq = 60 + sp * 190 + (boost ? 60 : 0);
    this.engine!.osc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
    this.engine!.filter.frequency.setTargetAtTime(600 + sp * 1600, this.ctx.currentTime, 0.1);
    const eGain = race.allowsDrive ? 0.05 + sp * 0.11 : 0.03;
    this.engine!.gain.gain.setTargetAtTime(eGain, this.ctx.currentTime, 0.08);

    // --- skid while drifting (louder with slip) ---
    const slip = Number.isFinite(kart.slipAngle) ? Math.abs(kart.slipAngle) : 0;
    const skidTarget =
      kart.state === 'drift' ? Math.min(0.4, slip * 1.4) : 0;
    this.skid!.gain.gain.setTargetAtTime(skidTarget, this.ctx.currentTime, 0.06);
    this.skid!.filter.frequency.setTargetAtTime(
      900 + slip * 2200,
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
      const rsp = Number.isFinite(rk.speed) ? rk.speed / 28 : 0;
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
