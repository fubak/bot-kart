import * as THREE from 'three';
import { CAMERA, KART } from '../config/tuning';
import type { Kart } from './Kart';
import type { Race } from './Race';

// Chase camera: damped follow behind the kart, look-ahead along its heading,
// speed/boost FOV response, wall-impact shake (consumes kart.lastWallHit).
// Primary gameplay system (spec §33) — later units add drift/jump behavior.

export class ChaseCamera {
  readonly camera: THREE.PerspectiveCamera;
  private readonly lookTarget = new THREE.Vector3();
  private initialized = false;
  private lastSeenHit = -1;
  private shake = 0;
  private readonly shakeOffset = new THREE.Vector3();
  private introAngle = Math.PI * 0.5; // countdown orbit angle
  /** Reduced motion: kills shake + speed FOV for motion-sensitive players. */
  reducedMotion = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(CAMERA.fovBase, aspect, 0.1, 500);
  }

  update(dt: number, kart: Kart, race?: Race): void {
    const fwd = kart.forward();
    const speedT = THREE.MathUtils.clamp(kart.speed / KART.maxSpeed, 0, 1);
    const dist = CAMERA.distance - CAMERA.distanceSpeedTrim * speedT;
    // Velocity lead compensates posDamp lag — without it the follow point
    // trails ~v/posDamp behind and the kart shrinks at speed (critic: 9.9 m
    // effective stand-off at 28 m/s despite the trim).
    const lead = kart.position.clone().addScaledVector(kart.velocity, CAMERA.speedLead);
    let targetPos = lead
      .clone()
      .addScaledVector(fwd, -dist)
      .add(new THREE.Vector3(0, CAMERA.height, 0));

    // Title + countdown: slow orbit that sweeps toward the chase position
    // and hands over smoothly at GO (the normal lerp lands it behind).
    const inCountdown = !!race && (race.phase === 'countdown' || race.phase === 'title');
    if (inCountdown) {
      this.introAngle += dt * 0.55;
      const a = this.introAngle;
      targetPos = kart.position
        .clone()
        .add(new THREE.Vector3(Math.sin(a) * 8.5, 2.6, Math.cos(a) * 8.5));
      this.initialized = false;
    } else if (!this.initialized) {
      this.camera.position.copy(targetPos);
      this.lookTarget.copy(kart.position).addScaledVector(fwd, CAMERA.lookAhead);
      this.initialized = true;
    }

    // Frame-rate independent exp damping.
    const kp = 1 - Math.exp(-CAMERA.posDamp * dt);
    const kl = 1 - Math.exp(-CAMERA.lookDamp * dt);
    this.camera.position.lerp(targetPos, kp);

    const wantLook = inCountdown
      ? kart.position.clone().add(new THREE.Vector3(0, 1.0, 0))
      : kart.position.clone().addScaledVector(fwd, CAMERA.lookAhead).add(new THREE.Vector3(0, 1.0, 0));
    this.lookTarget.lerp(wantLook, kl);
    this.camera.lookAt(this.lookTarget);

    // Wall-impact shake: fresh lastWallHit starts a jitter burst scaled by
    // impact severity (a glancing tap shudders; a head-on thumps).
    if (kart.lastWallHit !== this.lastSeenHit) {
      this.lastSeenHit = kart.lastWallHit;
      this.shake = this.reducedMotion ? 0 : 0.4 + 0.6 * kart.lastWallImpact;
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt / CAMERA.shakeTime);
      const a = CAMERA.shakeAmp * this.shake * this.shake;
      this.shakeOffset.set(
        (Math.random() * 2 - 1) * a,
        (Math.random() * 2 - 1) * a * 0.6,
        (Math.random() * 2 - 1) * a,
      );
      this.camera.position.add(this.shakeOffset);
    }

    const wantFov = this.reducedMotion
      ? CAMERA.fovBase
      : CAMERA.fovBase + CAMERA.fovSpeed * speedT + (kart.state === 'boost' ? CAMERA.fovBoost : 0);
    const fov = THREE.MathUtils.lerp(this.camera.fov, wantFov, kl);
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
