import * as THREE from 'three';
import { AI, KART } from '../config/tuning';
import type { ControlState } from '../core/Input';
import type { Kart } from './Kart';
import type { Track } from './Track';

// AI driver: pure-pursuit steering to a centerline lookahead point
// (Track.lookaheadPoint), curvature-aware throttle/brake from tangent-change
// sampling over a braking horizon, and hold-to-drift on tight corners with a
// mini-turbo release at corner exit. `skill` (0.8–1.1) scales lookahead and
// corner speed so different bots feel different — no rubber-banding.
//
// Sign conventions (verified against Kart.update):
//   steer +1 = right; heading -= steer * rate (forward = -Z at heading 0).
//   signedAngle(a, b) < 0 ⇒ the track turns RIGHT (driftDir +1).

export class AiDriver {
  /** 0.8 (cautious) … 1.0 (baseline) … 1.1 (hot). */
  private skill: number;
  /** Difficulty select scales skill at runtime (options menu). */
  setSkill(v: number): void {
    this.skill = THREE.MathUtils.clamp(v, 0.8, 1.1);
  }

  private driftTime = 0;
  private recovering = false;
  private prevLateral = 0;
  private blockedTime = 0;
  private overtakeSide = 1;
  private lastPos = new THREE.Vector3();
  private posTimer = 0;
  private stuckTime = 0;

  constructor(
    skill = 1.0,
    /** Preferred lateral line offset (m, + = left of centerline). Gives
     *  each bot its own racing line so the field spreads and side-by-side
     *  battles happen instead of single-file centerline trains. */
    lineOffset = 0,
    /** Routes through gravel shortcut aprons when the zone offers one —
     *  the cheeky shortcut-taker (slower surface, shorter path). */
    takesShortcuts = false,
  ) {
    this.skill = THREE.MathUtils.clamp(skill, 0.8, 1.1);
    this.lineOffset = THREE.MathUtils.clamp(lineOffset, -3.5, 3.5);
    this.takesShortcuts = takesShortcuts;
  }

  readonly takesShortcuts: boolean;

  readonly lineOffset: number;

  /** Clear per-maneuver state (call on kart reset / race restart). */
  reset(): void {
    this.driftTime = 0;
    this.recovering = false;
    this.prevLateral = 0;
    this.blockedTime = 0;
    this.posTimer = 0;
    this.stuckTime = 0;
  }

  update(kart: Kart, track: Track, dt: number, traffic?: Kart[]): ControlState {
    const idle: ControlState = { throttle: 0, brake: 0, steer: 0, drift: false };
    const fwdSpeed = kart.forwardSpeed;

    // Local track frame: lateral offset + travel-direction tangent.
    const { lateral, tangent: tanNow } = track.query(kart.position);
    // Lateral velocity (m/s, signed) — how fast the slide is carrying the
    // kart toward a wall. Clamped: centerline index jumps can spike it.
    const latVel = THREE.MathUtils.clamp(
      dt > 1e-6 ? (lateral - this.prevLateral) / dt : 0,
      -15,
      15,
    );
    this.prevLateral = lateral;

    // --- recovery: nose pointing backward along the track ---
    // Post-wall-hit spins can leave the kart facing >160° off the travel
    // direction; pursuit alone would happily drive it the wrong way.
    const align = kart.forward().dot(tanNow);
    if (!this.recovering && align < -0.45) this.recovering = true;
    if (this.recovering) {
      if (align > 0.2) {
        this.recovering = false;
      } else {
        const desired = Math.atan2(-tanNow.x, -tanNow.z);
        const err = wrapAngle(desired - kart.heading);
        if (fwdSpeed > 2) {
          // Sliding forward while facing back — kill momentum, steer normally.
          return { ...idle, brake: 1, steer: clampSteer(-err * AI.steerGain) };
        }
        // Reversing flips steer sign inside Kart (dirSign), so +err*gain
        // rotates the nose back toward the travel direction while backing up.
        return { ...idle, brake: 1, steer: clampSteer(err * AI.steerGain) };
      }
    }

    // --- wedge detection: pressing a wall face with speed but no
    // displacement (verified: a bot pinned ~2 s at a shortcut wall end).
    // Displacement sampled every 0.5 s; fast-but-frozen = wedged.
    this.posTimer += dt;
    if (this.posTimer > 0.5) {
      this.posTimer = 0;
      // Any wedge — nose-in-wall (low speed) or wall-pressed grind (high
      // speed) — shows as ~zero displacement. Spin-outs excluded (they
      // rotate in place legitimately for ~1 s).
      if (!kart.isSpinning && kart.position.distanceTo(this.lastPos) < 0.5) {
        this.stuckTime++;
      } else {
        this.stuckTime = 0;
      }
      this.lastPos.copy(kart.position);
    }
    if (this.stuckTime >= 2) {
      // Back out steering the nose toward the travel direction (reverse
      // flips steer inside Kart — same trick as the spin recovery).
      const desired = Math.atan2(-tanNow.x, -tanNow.z);
      const err = wrapAngle(desired - kart.heading);
      if (kart.forwardSpeed < -1) {
        // Reversed enough — drive off steering toward the line.
        this.stuckTime = 0;
        return { ...idle, throttle: 1, steer: clampSteer(-err * AI.steerGain) };
      }
      return { ...idle, brake: 1, steer: clampSteer(err * AI.steerGain) };
    }

    // --- steering: pure pursuit to the centerline lookahead point ---
    // Skill scales lookahead: timid bots look shorter (later, twitchier).
    const skillN = (this.skill - 0.8) / 0.3; // 0..1
    const lookMul = 0.9 + 0.2 * skillN;
    let look =
      (AI.lookaheadBase + AI.lookaheadPerSpeed * Math.max(0, fwdSpeed)) * lookMul;
    look = Math.min(look, AI.lookaheadMax);
    // Far off-line → shorten lookahead to rejoin instead of cutting across.
    if (Math.abs(lateral) > AI.rejoinLateral) look *= AI.rejoinLookMul;
    // Inked: vision denied — short sight + steering wander (see below).
    if (kart.inked) look *= 0.55;

    const target = track.lookaheadPoint(kart.position, look);
    // Shift the pursuit point onto this bot's preferred line — plus a
    // temporary sidestep while executing an overtake (see traffic below).
    let lineBias = this.lineOffset;
    let onShortcut = false;
    if (this.takesShortcuts) {
      // Shortcut-taker: pull to mid-apron once the kart is inside the zone
      // (past the wall's end — approach-pull wedged bots into the wall
      // face). The inside cut doubles as an overtake line, so it takes
      // precedence over the blocked-sidestep below.
      const gb = track.gravelBiasInside(kart.position);
      if (gb !== null) {
        lineBias = gb;
        onShortcut = true;
      }
    }
    if (!onShortcut && this.blockedTime > AI.overtakeTime) {
      lineBias += this.overtakeSide * AI.overtakeBias;
    }
    target.addScaledVector(track.leftAt(track.nearestIndex(target)), lineBias);
    const toTarget = target.sub(kart.position).setY(0);
    if (toTarget.lengthSq() < 1e-6) return { ...idle, throttle: 1 };
    toTarget.normalize();
    const desiredHeading = Math.atan2(-toTarget.x, -toTarget.z);
    const headingErr = wrapAngle(desiredHeading - kart.heading);
    let steer = clampSteer(-headingErr * AI.steerGain);

    // --- curvature: worst tangent-change over a braking horizon ---
    // Speed must be sane BEFORE the corner, so probe several distances and
    // take the tightest implied radius: R = arcLength / tangentAngle.
    const horizon = Math.max(
      look * AI.brakeLookMul,
      Math.max(0, fwdSpeed) * AI.brakeTimeAhead,
    );
    let minRadius = Infinity;
    for (const f of AI.curveSampleFracs) {
      const d = Math.max(horizon * f, 1);
      const p = track.lookaheadPoint(kart.position, d);
      const tan = track.tangentAt(track.nearestIndex(p));
      const ang = Math.abs(signedAngle(tanNow, tan));
      if (ang > 1e-4) minRadius = Math.min(minRadius, d / ang);
    }

    // Near-lookahead corner: drives drift entry/exit (radius + direction).
    const nearD = Math.max(look * 0.6, 6);
    const nearP = track.lookaheadPoint(kart.position, nearD);
    const tanNear = track.tangentAt(track.nearestIndex(nearP));
    const turnNear = signedAngle(tanNow, tanNear); // <0 = right-hand corner
    const radiusNow =
      Math.abs(turnNear) > 1e-4 ? nearD / Math.abs(turnNear) : Infinity;

    // --- throttle / brake ---
    // Target speed from the tightest radius on the horizon; skill scales how
    // much corner speed the bot dares to carry (0.8 lifts early, 1.1 sends it).
    let targetSpeed: number = KART.maxSpeed;
    if (minRadius < Infinity) {
      targetSpeed = Math.min(
        targetSpeed,
        Math.sqrt(AI.cornerAccel * minRadius),
      );
      targetSpeed = Math.max(targetSpeed, AI.cornerMinSpeed);
    }
    targetSpeed = Math.min(targetSpeed * this.skill, KART.maxSpeed);

    let throttle = 0;
    let brake = 0;
    if (fwdSpeed > targetSpeed * AI.brakeMargin) {
      brake = THREE.MathUtils.clamp(
        (fwdSpeed - targetSpeed) / AI.brakeBand,
        AI.brakeMin,
        1,
      );
    } else if (fwdSpeed <= targetSpeed) {
      throttle = 1;
    }
    // Between target and target*margin: coast (drag trims the overshoot).

    // --- traffic: blocked by a kart dead ahead → lift + sidestep overtake ---
    // Without this the pack collapses into matched-speed push-trains at the
    // collision minDist (critic: two bots welded together for 91% of a race).
    let blocked = false;
    if (traffic && fwdSpeed > 4) {
      const fwd = kart.forward();
      const right = kart.right();
      for (const other of traffic) {
        if (other === kart) continue;
        const rel = other.position.clone().sub(kart.position);
        const along = rel.dot(fwd);
        if (along < 1.5 || along > AI.blockAhead) continue;
        const side = rel.dot(right);
        if (Math.abs(side) > AI.blockLat) continue;
        blocked = true;
        // Aim for the side with more room — away from the blocker.
        this.overtakeSide = side > 0 ? -1 : 1;
        break;
      }
    }
    if (blocked) {
      this.blockedTime += dt;
      throttle = Math.min(throttle, AI.blockThrottle);
    } else {
      this.blockedTime = Math.max(0, this.blockedTime - dt * 2); // decay, not snap
    }

    // --- drift state machine ---
    // Enter on tight near-corner radius at speed; Kart latches
    // driftDir = sign(steer) on the entry frame, so steer must already point
    // into the corner — pure pursuit guarantees that here.
    const drifting = kart.driftDir !== 0;
    let drift = false;
    if (drifting) {
      this.driftTime += dt;
      const cornerFlipped =
        Math.abs(turnNear) > AI.driftFlipAngle &&
        Math.sign(turnNear) === kart.driftDir; // bends opposite the slide
      // Project the slide forward: |lat| alone reacts too late — an outward
      // slide at 5 m/s reaches the barrier ~0.4 s before the margin trips.
      const latProj = lateral + latVel * AI.driftWallMarginTime;
      const exit =
        radiusNow > AI.driftExitRadius ||
        fwdSpeed < AI.driftMinSpeed * 0.7 ||
        this.driftTime > AI.driftMaxTime ||
        cornerFlipped ||
        Math.abs(latProj) > AI.driftWallMargin;
      if (exit) {
        this.driftTime = 0; // release now → charged boost fires on corner exit
      } else {
        drift = true;
      }
    } else {
      this.driftTime = 0;
      if (
        !onShortcut && // gravel aprons: grip the cut, don't drift it
        radiusNow < AI.driftEnterRadius &&
        fwdSpeed > AI.driftMinSpeed &&
        steer !== 0
      ) {
        drift = true;
      }
    }
    if (drift) {
      // Hold the slide: bias the stick into the drift direction, while the
      // pursuit term still modulates the line (tighten vs widen).
      const dir = drifting ? kart.driftDir : Math.sign(steer);
      steer = clampSteer(steer * AI.driftPursuitMul + dir * AI.driftSteerBias);
    }

    // Inked: squinting through the splat — wander on top of the pursuit.
    if (kart.inked) steer = clampSteer(steer + (Math.random() - 0.5) * 1.1);

    return { throttle, brake, steer, drift };
  }
}

/** Wrap to [-π, π]. */
function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/**
 * Signed XZ angle from tangent a to tangent b.
 * Positive = b bends LEFT of a (counterclockwise from +Y), negative = right.
 */
function signedAngle(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.atan2(a.z * b.x - a.x * b.z, a.x * b.x + a.z * b.z);
}

function clampSteer(s: number): number {
  return THREE.MathUtils.clamp(s, -1, 1);
}
