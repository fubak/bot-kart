import type * as THREE from 'three';
import type { Track } from './Track';
import { RACE } from '../config/tuning';

// Race rules: countdown → ordered checkpoint gates → lap counting → finish.
// Kart progress is an unwrapped centerline index (monotonic forward); gates
// are progress thresholds, so passes can't be skipped at any sane speed.
// Each racer (player + AI) gets a RacerProgress tracker; positions rank by
// lap+progress. Race phase follows the PLAYER (racer 0).

export type RacePhase = 'countdown' | 'racing' | 'finished';

const GATE_FRACTIONS = [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0];

/** Per-kart lap/gate/progress state. */
export class RacerProgress {
  lap = 1;
  progressIdx = 0;
  lapStart = 0;
  lapTimes: number[] = [];
  lastLapTime = 0;
  bestLapTime = 0;
  wrongWay = false;
  finished = false;
  finishTime = 0;

  private nextGate = 0;
  private lastIdx = -1;
  private backwardAccum = 0;

  constructor(
    private readonly track: Track,
    private readonly gates: number[],
    private readonly totalLaps: number,
  ) {}

  reset(spawnPos: THREE.Vector3, simTime: number): void {
    this.lap = 1;
    this.lapTimes = [];
    this.lastLapTime = 0;
    this.bestLapTime = 0;
    this.wrongWay = false;
    this.finished = false;
    this.finishTime = 0;
    this.nextGate = 0;
    this.backwardAccum = 0;
    this.lastIdx = this.track.nearestIndex(spawnPos);
    this.progressIdx = this.lastIdx;
    this.lapStart = simTime;
  }

  /** Advance progress; returns true when a lap completes. */
  update(pos: THREE.Vector3, simTime: number): boolean {
    if (this.finished) return false;
    const n = this.track.sampleCount;
    const i = this.track.nearestIndex(pos);
    if (this.lastIdx < 0) {
      this.lastIdx = i;
      this.progressIdx = i;
    } else {
      const delta = (i - this.lastIdx + n) % n;
      if (delta > 0 && delta < n / 2) {
        this.progressIdx += delta;
        this.backwardAccum = 0;
      } else if (delta > n / 2) {
        this.backwardAccum += n - delta;
      }
      this.lastIdx = i;
    }
    this.wrongWay = this.backwardAccum > n * 0.01;

    let lapped = false;
    while (this.nextGate < this.gates.length && this.progressIdx >= this.gates[this.nextGate]) {
      if (this.nextGate === this.gates.length - 1) lapped = true;
      this.nextGate++;
    }
    if (lapped) {
      const t = simTime - this.lapStart;
      this.lastLapTime = t;
      this.lapTimes.push(t);
      if (!this.bestLapTime || t < this.bestLapTime) this.bestLapTime = t;
      this.lapStart = simTime;
      if (this.lap >= this.totalLaps) {
        this.finished = true;
        this.finishTime = simTime;
        return true;
      }
      this.lap++;
      this.progressIdx -= n;
      this.nextGate = 0;
      return true;
    }
    return false;
  }

  /** Sortable race distance — higher = further along. */
  get score(): number {
    return this.lap * this.track.sampleCount + this.progressIdx;
  }
}

export class Race {
  phase: RacePhase = 'countdown';
  countdownLeft = RACE.countdown;
  goFlash = 0; // brief "GO!" display window after countdown
  raceStart = 0;

  readonly racers: RacerProgress[] = [];
  private readonly gates: number[];

  constructor(private readonly track: Track, readonly totalLaps = RACE.laps, racerCount = 1) {
    this.gates = GATE_FRACTIONS.map((f) => Math.floor(f * track.sampleCount));
    for (let i = 0; i < racerCount; i++) {
      this.racers.push(new RacerProgress(track, this.gates, totalLaps));
    }
  }

  get allowsDrive(): boolean {
    return this.phase === 'racing' || this.phase === 'finished';
  }

  /** Human-readable countdown label: '3' | '2' | '1' | 'GO!' | '' */
  get countdownLabel(): string {
    if (this.phase === 'countdown') return String(Math.ceil(this.countdownLeft));
    if (this.goFlash > 0) return 'GO!';
    return '';
  }

  // Player-facing accessors (racer 0).
  get player(): RacerProgress {
    return this.racers[0];
  }
  get lap(): number {
    return this.player.lap;
  }
  get lapTimes(): number[] {
    return this.player.lapTimes;
  }
  get lastLapTime(): number {
    return this.player.lastLapTime;
  }
  get bestLapTime(): number {
    return this.player.bestLapTime;
  }
  get lapStart(): number {
    return this.player.lapStart;
  }
  get wrongWay(): boolean {
    return this.player.wrongWay;
  }
  get raceTime(): number {
    if (this.phase === 'countdown') return 0;
    const end = this.player.finished ? this.player.finishTime : this.lastSimTime;
    return end - this.raceStart;
  }

  /** 1-based position of racer `i` by (lap, progress). */
  positionOf(racerIdx: number): number {
    const me = this.racers[racerIdx].score;
    let pos = 1;
    for (const r of this.racers) if (r.score > me) pos++;
    return pos;
  }

  private lastSimTime = 0;

  update(positions: THREE.Vector3[], simTime: number, dt: number): void {
    this.lastSimTime = simTime;
    if (this.phase === 'countdown') {
      this.countdownLeft -= dt;
      if (this.countdownLeft <= 0) {
        this.phase = 'racing';
        this.goFlash = 0.9;
        this.raceStart = simTime;
        for (const r of this.racers) r.lapStart = simTime;
      }
      return;
    }
    this.goFlash = Math.max(0, this.goFlash - dt);
    for (let i = 0; i < this.racers.length; i++) {
      if (positions[i]) this.racers[i].update(positions[i], simTime);
    }
    if (this.phase === 'racing' && this.player.finished) this.phase = 'finished';
  }

  restart(spawnPositions: THREE.Vector3[], simTime: number): void {
    this.phase = 'countdown';
    this.countdownLeft = RACE.countdown;
    this.goFlash = 0;
    this.raceStart = 0;
    for (let i = 0; i < this.racers.length; i++) {
      this.racers[i].reset(spawnPositions[i] ?? spawnPositions[0], simTime);
    }
    this.lastSimTime = simTime;
  }
}
