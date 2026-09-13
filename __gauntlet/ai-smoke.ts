import { SIM } from '../src/config/tuning';
import type { ControlState } from '../src/core/Input';
import { AiDriver } from '../src/game/AiDriver';
import { Kart } from '../src/game/Kart';
import { Race } from '../src/game/Race';
import { Track } from '../src/game/Track';

// Headless smoke: run AiDriver around Proving Grounds at fixed dt and report
// laps / wall hits / lateral excursion / drift usage per skill level.
// Temporary dev harness — safe to delete.

const IDLE: ControlState = { throttle: 0, brake: 0, steer: 0, drift: false };

interface RunResult {
  skill: number;
  simSeconds: number;
  phase: string;
  lapsCompleted: number;
  lapTimes: number[];
  bestLap: number;
  wallHits: number;
  wallHitIdx: number[]; // centerline index at each hit — finds hot spots
  wallHitSpeed: number[];
  firstHitTrace: string[]; // ~2s of state before the first wall hit
  maxLateral: number;
  driftPct: number;
  avgSpeed: number;
  topSpeed: number;
  wrongWaySeen: number; // steps with wrongWay flag
}

function runOne(skill: number, simSeconds: number): RunResult {
  const track = new Track();
  const kart = new Kart();
  const ai = new AiDriver(skill);
  const race = new Race(track);
  const spawn = track.spawn();
  kart.reset(spawn.position, spawn.heading);
  race.restart([spawn.position], 0);

  const dt = SIM.fixedDt;
  let simTime = 0;
  let wallHits = 0;
  let lastWall = -1;
  let maxLat = 0;
  let driftSteps = 0;
  let speedSum = 0;
  let topSpeed = 0;
  let wrongWaySteps = 0;
  const wallHitIdx: number[] = [];
  const wallHitSpeed: number[] = [];
  // Ring-buffer trace for post-mortem around the first wall hit.
  const trace: string[] = [];
  let firstHitTrace: string[] = [];
  const steps = Math.round(simSeconds / dt);

  for (let i = 0; i < steps; i++) {
    const ctl = race.allowsDrive ? ai.update(kart, track, dt) : IDLE;
    kart.update(dt, ctl, track, simTime);
    race.update([kart.position], simTime, dt);
    simTime += dt;

    const { lateral } = track.query(kart.position);
    if (Math.abs(lateral) > maxLat) maxLat = Math.abs(lateral);
    if (i % 6 === 0) {
      trace.push(
        `t=${simTime.toFixed(1)} i=${track.nearestIndex(kart.position)} ` +
          `lat=${lateral.toFixed(1)} v=${kart.speed.toFixed(1)} ` +
          `fwd=${kart.forwardSpeed.toFixed(1)} drift=${kart.driftDir} ` +
          `steer=${ctl.steer.toFixed(2)} thr=${ctl.throttle} brk=${ctl.brake.toFixed(2)}`,
      );
      if (trace.length > 40) trace.shift();
    }
    if (kart.lastWallHit > lastWall) {
      wallHits++;
      lastWall = kart.lastWallHit;
      wallHitIdx.push(track.nearestIndex(kart.position));
      wallHitSpeed.push(Math.round(kart.speed * 10) / 10);
      if (firstHitTrace.length === 0) firstHitTrace = [...trace];
    }
    if (kart.driftDir !== 0) driftSteps++;
    if (race.wrongWay) wrongWaySteps++;
    speedSum += kart.speed;
    if (kart.speed > topSpeed) topSpeed = kart.speed;
    if (race.phase === 'finished') break;
  }

  return {
    skill: ai.skill,
    simSeconds: Math.round(simTime * 100) / 100,
    phase: race.phase,
    lapsCompleted: race.phase === 'finished' ? race.totalLaps : race.lap - 1,
    lapTimes: race.lapTimes.map((t) => Math.round(t * 100) / 100),
    bestLap: Math.round(race.bestLapTime * 100) / 100,
    wallHits,
    wallHitIdx,
    wallHitSpeed,
    firstHitTrace,
    maxLateral: Math.round(maxLat * 100) / 100,
    driftPct: Math.round((driftSteps / steps) * 1000) / 10,
    avgSpeed: Math.round((speedSum / steps) * 100) / 100,
    topSpeed: Math.round(topSpeed * 100) / 100,
    wrongWaySeen: wrongWaySteps,
  };
}

try {
  const results = [0.85, 1.0, 1.1].map((s) => runOne(s, 90));
  const json = JSON.stringify(results, null, 2);
  const el = document.getElementById('out');
  if (el) el.textContent = json;
  console.log('[ai-smoke]', json);
  document.title = 'AI_SMOKE_DONE';
} catch (err) {
  console.error('[ai-smoke] FAILED', err);
  const el = document.getElementById('out');
  if (el) el.textContent = `FAILED: ${String(err)}`;
  document.title = 'AI_SMOKE_FAILED';
}
