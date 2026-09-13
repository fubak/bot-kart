import type * as THREE from 'three';
import type { Track } from './Track';
import { RACE } from '../config/tuning';

// Race rules: countdown → ordered checkpoint gates → lap counting → finish.
// Kart progress is an unwrapped centerline index (monotonic forward); gates
// are progress thresholds, so passes can't be skipped at any sane speed.
// Wrong-way is detected by sustained backward progress.

export type RacePhase = 'countdown' | 'racing' | 'finished';

const GATE_FRACTIONS = [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0];

export class Race {
  phase: RacePhase = 'countdown';
  countdownLeft = RACE.countdown;
  goFlash = 0; // brief "GO!" display window after countdown
  lap = 1;
  lapTimes: number[] = [];
  raceTime = 0;
  lastLapTime = 0;
  bestLapTime = 0;
  wrongWay = false;

  private readonly gates: number[]; // progress-index thresholds
  private nextGate = 0;
  lapStart = 0; // simTime when the current lap began
  private progressIdx = 0;
  private lastIdx = -1;
  private backwardAccum = 0;

  constructor(private readonly track: Track, readonly totalLaps = RACE.laps) {
    this.gates = GATE_FRACTIONS.map((f) => Math.floor(f * track.sampleCount));
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

  update(pos: THREE.Vector3, simTime: number, dt: number): void {
    if (this.phase === 'countdown') {
      this.countdownLeft -= dt;
      if (this.countdownLeft <= 0) {
        this.phase = 'racing';
        this.goFlash = 0.9;
        this.lapStart = simTime;
        this.raceStart = simTime;
      }
      return;
    }
    this.goFlash = Math.max(0, this.goFlash - dt);
    if (this.phase === 'finished') return;

    this.raceTime = simTime - this.raceStart;

    // Unwrap the nearest-index into monotonic forward progress.
    const n = this.gates.length ? this.trackLength : 0;
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
        // Moving backward along the centerline.
        this.backwardAccum += n - delta;
      }
      this.lastIdx = i;
    }
    this.wrongWay = this.backwardAccum > n * 0.01;

    while (this.nextGate < this.gates.length && this.progressIdx >= this.gates[this.nextGate]) {
      if (this.nextGate === this.gates.length - 1) {
        this.completeLap(simTime);
      }
      this.nextGate++;
    }
  }

  private raceStart = 0;

  private get trackLength(): number {
    return this.track.sampleCount;
  }

  private completeLap(simTime: number): void {
    const t = simTime - this.lapStart;
    this.lastLapTime = t;
    this.lapTimes.push(t);
    if (!this.bestLapTime || t < this.bestLapTime) this.bestLapTime = t;
    this.lapStart = simTime;
    if (this.lap >= this.totalLaps) {
      this.phase = 'finished';
      return;
    }
    this.lap++;
    // Wrap progress into the new lap and re-arm the gates.
    this.progressIdx -= this.trackLength;
    this.nextGate = 0;
  }

  restart(spawnPos: THREE.Vector3, simTime: number): void {
    this.phase = 'countdown';
    this.countdownLeft = RACE.countdown;
    this.goFlash = 0;
    this.lap = 1;
    this.lapTimes = [];
    this.raceTime = 0;
    this.lastLapTime = 0;
    this.bestLapTime = 0;
    this.wrongWay = false;
    this.nextGate = 0;
    this.raceStart = 0;
    this.backwardAccum = 0;
    this.lastIdx = this.track.nearestIndex(spawnPos);
    this.progressIdx = this.lastIdx;
    this.lapStart = simTime;
  }
}
