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
  private skillN_: number;
  get skill(): number {
    return this.skillN_;
  }
  /** Difficulty select scales skill at runtime (options menu). */
  setSkill(v: number): void {
    this.skillN_ = THREE.MathUtils.clamp(v, 0.8, 1.1);
  }

  private driftTime = 0;
  private recovering = false;
  private prevLateral = 0;
  private blockedTime = 0;
  private overtakeSide = 1;
  private lastPos = new THREE.Vector3();
  private posTimer = 0;
  private stuckTime = 0;
  // Progress watchdog (critic9 D3 — AI DNFs): the wedge/grind probes only
  // see position displacement and wall contact, so a kart that keeps
  // *some* motion while never gaining on the centerline — spin-pin cycles
  // at foldbacks, creeping with just enough slide to reset the 0.5 m
  // displacement counter, circling between parallel legs — used to grind
  // whole laps at 90 s+ or never finish. Track the kart's own unwrapped
  // centerline index instead: ~zero net forward index over a window means
  // the kart is functionally lost → lakitu onto the racing line.
  private lastRawIdx = -1;
  private progAccum = 0; // net forward index travel (teleports skipped)
  private progMark = 0; // accum value at the last window boundary
  private progWindow = 0; // seconds into the current window
  // Careful mode (critic11 D2): bots that escape a wedge/grind used to
  // charge straight back to full pursuit speed and re-grind the NEXT
  // hairpin — SR descents showed ~10% of samples <0.5 m/s in perpetual
  // stall→recover cycles. After any ladder escape or lakitu, run a few
  // seconds at reduced corner-entry pace so the re-entry is survivable.
  // Never arms on a clean run → solo smoke baselines untouched.
  private carefulTime = 0;
  // Wedge state: anchored once stuckTime trips; wedgeTime then runs on
  // wall-clock (not the displacement counter) so the reverse→forward
  // limit cycle can't reset the ladder — it only clears on a real
  // escape (>2.5 m from the anchor) or the lakitu respawn (critic6 D1).
  private readonly wedgeAnchor = new THREE.Vector3();
  private wedgeTime = -1; // <0 = not wedged
  private grindTime = 0; // sustained low-speed wall contact

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
    this.skillN_ = THREE.MathUtils.clamp(skill, 0.8, 1.1);
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
    this.wedgeTime = -1;
    this.grindTime = 0;
    this.lastRawIdx = -1;
    this.progAccum = 0;
    this.progMark = 0;
    this.progWindow = 0;
    this.carefulTime = 0;
  }

  update(kart: Kart, track: Track, dt: number, traffic?: Kart[]): ControlState {
    const idle: ControlState = { throttle: 0, brake: 0, steer: 0, drift: false };
    const fwdSpeed = kart.forwardSpeed;

    // Local track frame: lateral offset + travel-direction tangent.
    const { lateral, tangent: tanNow } = track.query(kart.position, kart.trackIdx);

    // --- progress watchdog: net forward centerline-index gain per ~8 s
    // window. Jumps ≥90 samples are teleports (lakitu/swap), not progress —
    // skip them so a respawn can't spoof the meter. A kart that can't net
    // ~13 m of index in a window is lost in a mode the displacement/wall
    // probes miss → lakitu onto the nearest line point (global lookup —
    // the kart's own leg may be the wrong one at a foldback).
    {
      const n = track.sampleCount;
      const raw = kart.trackIdx;
      if (raw >= 0 && this.lastRawIdx >= 0) {
        const d = (raw - this.lastRawIdx + n) % n;
        if (d > 0 && d < 90) this.progAccum += d;
        else if (d > n / 2 && n - d < 90) this.progAccum -= n - d;
      }
      this.lastRawIdx = raw >= 0 ? raw : -1;
      this.progWindow += dt;
      if (this.progWindow >= 8) {
        const gained = this.progAccum - this.progMark;
        this.progMark = this.progAccum;
        this.progWindow = 0;
        if (gained < 24 && !kart.celebrating) {
          const i = track.nearestIndex(kart.position);
          const t = track.tangentAt(i);
          kart.reset(track.pointAt(i), Math.atan2(-t.x, -t.z));
          this.reset();
          return idle;
        }
      }
    }
    // Lateral velocity (m/s, signed) — how fast the slide is carrying the
    // kart toward a wall. Clamped: centerline index jumps can spike it.
    const latVel = THREE.MathUtils.clamp(
      dt > 1e-6 ? (lateral - this.prevLateral) / dt : 0,
      -15,
      15,
    );
    this.prevLateral = lateral;

    // --- wedge detection: pressing a wall face with speed but no
    // displacement (verified: a bot pinned ~2 s at a shortcut wall end).
    // Displacement sampled every 0.5 s; fast-but-frozen = wedged.
    // Runs BEFORE the recovery branch: a kart that is both misaligned
    // and frozen must still reach the escape ladder below.
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
    // Grind-beach detection (critic8: BOT-C logged 2:15+ laps — a kart
    // creeping along a wall at a few m/s has enough displacement to
    // defeat the wedge probe, yet pursuit can't break it free). Sustained
    // wall contact at low speed arms the ladder mid-way: the kart has
    // already failed to self-correct, so 2 s of forward-drive then lakitu.
    if (kart.onWall && kart.speed < 8) {
      this.grindTime += dt;
    } else {
      this.grindTime = 0;
    }
    if (this.stuckTime >= 2 && this.wedgeTime < 0) {
      this.wedgeTime = 0;
      this.wedgeAnchor.copy(kart.position);
    }
    if (this.grindTime > 4 && this.wedgeTime < 0) {
      this.wedgeTime = 4;
      this.wedgeAnchor.copy(kart.position);
    }
    if (this.wedgeTime >= 0) {
      // Escape ladder (critic5 D1: a fixed {brake} response deadlocks —
      // steering has zero authority at ~0 speed, and braking digs a
      // tail-to-wall kart deeper. critic6 D1: the reverse-exit reset
      // created a limit cycle that never reached the upper rungs):
      //   0-3 s wedged → reverse out steering toward the line.
      //   3-5 s wedged → drive forward out (tail-to-wall case).
      //   5+ s wedged → lakitu respawn onto the racing line — the same
      //     recovery the player gets on Backspace; wedges the driver
      //     can't solve (beached against a wall face) must not cost the
      //     kart the whole race (critic9 D3: rung at 6 s left too much
      //     dead time on top of the detection delay).
      // The ladder only clears on real displacement from the anchor —
      // an attempt that rocks the kart but re-wedges keeps climbing.
      this.wedgeTime += dt;
      // Escape = real displacement AND off the wall. A kart creeping
      // along the wall face satisfies displacement but is still beached
      // (critic8: grinders cleared the ladder every ~1.6 s and creeped
      // for whole laps); only an unclamped kart has truly escaped.
      if (kart.position.distanceTo(this.wedgeAnchor) > 2.5 && !kart.onWall) {
        this.wedgeTime = -1;
        this.stuckTime = 0;
        this.grindTime = 0;
        this.carefulTime = 6; // escaped — re-enter at reduced pace
      } else {
        const desired = Math.atan2(-tanNow.x, -tanNow.z);
        const err = wrapAngle(desired - kart.heading);
        if (this.wedgeTime > 5) {
          const i = track.nearestIndexNear(kart.position, kart.trackIdx);
          const t = track.tangentAt(i);
          kart.reset(track.pointAt(i), Math.atan2(-t.x, -t.z));
          kart.trackIdx = -1;
          this.stuckTime = 0;
          this.wedgeTime = -1;
          this.recovering = false;
          this.carefulTime = 6; // lakitu — re-enter at reduced pace
          return idle;
        }
        if (this.wedgeTime > 3) {
          return { ...idle, throttle: 1, steer: clampSteer(-err * AI.steerGain) };
        }
        return { ...idle, brake: 1, steer: clampSteer(err * AI.steerGain) };
      }
    }

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

    const la = track.lookahead(kart.position, look, kart.trackIdx);
    const target = la.point;
    // Grind assist (critic12 D2): wall-pressed at <8 m/s, the normal
    // lookahead target sits behind the hairpin's inside wall — steering
    // toward it keeps the kart nose-in grinding (the 10%-of-lap stall
    // clusters on the SR descent). While creeping on the wall, jump the
    // pursuit point ~2.5× farther so the kart steers ALONG the wall face
    // and off the pin on its own. Recovery-path only: a clean solo run
    // never satisfies the condition → baselines unchanged.
    if (this.grindTime > 0.5 && this.wedgeTime < 0) {
      const laFar = track.lookahead(kart.position, look * 2.5, kart.trackIdx);
      target.copy(laFar.point);
    }
    // Shift the pursuit point onto this bot's preferred line — plus a
    // temporary sidestep while executing an overtake (see traffic below).
    let lineBias = this.lineOffset;
    let onShortcut = false;
    if (this.takesShortcuts) {
      // Shortcut-taker: pull to mid-apron once the kart is inside the zone
      // (past the wall's end — approach-pull wedged bots into the wall
      // face). The inside cut doubles as an overtake line, so it takes
      // precedence over the blocked-sidestep below.
      const gb = track.gravelBiasInside(kart.position, 0.008, kart.trackIdx);
      if (gb !== null) {
        lineBias = gb;
        onShortcut = true;
      }
    }
    if (!onShortcut && this.blockedTime > AI.overtakeTime) {
      lineBias += this.overtakeSide * AI.overtakeBias;
    }
    target.addScaledVector(track.leftAt(la.index), lineBias);
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
      const p = track.lookahead(kart.position, d, kart.trackIdx);
      const tan = track.tangentAt(p.index);
      const ang = Math.abs(signedAngle(tanNow, tan));
      if (ang > 1e-4) minRadius = Math.min(minRadius, d / ang);
    }

    // Near-lookahead corner: drives drift entry/exit (radius + direction).
    const nearD = Math.max(look * 0.6, 6);
    const nearLa = track.lookahead(kart.position, nearD, kart.trackIdx);
    const tanNear = track.tangentAt(nearLa.index);
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
    // Rubber-band headroom (critic10 D8): Game raises the kart's physical
    // cap via paceAssist, but the old KART.maxSpeed clamp meant a trailing
    // bot could never actually use it — the field stayed strung out. Cap
    // at the ASSISTED speed so a trailing bot genuinely runs faster.
    // paceAssist is 0 in the solo smoke harness → baselines unchanged.
    targetSpeed = Math.min(
      targetSpeed * this.skill,
      KART.maxSpeed * (1 + kart.paceAssist),
    );
    // Careful mode: post-wedge/lakitu re-entry at 85% pace — arrives at
    // the next hairpin slow enough to hold the line instead of grinding
    // straight back onto it (critic11 D2).
    this.carefulTime = Math.max(0, this.carefulTime - dt);
    if (this.carefulTime > 0) targetSpeed *= 0.85;

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
