import * as THREE from 'three';
import { CAMERA, KART } from '../config/tuning';
import type { Kart } from './Kart';

// Chase camera: damped follow behind the kart, look-ahead along its heading,
// speed/boost FOV response. This is a primary gameplay system (spec §33) —
// Wave 2 adds drift/boost/jump-specific behavior as separate quality units.

export class ChaseCamera {
  readonly camera: THREE.PerspectiveCamera;
  private readonly lookTarget = new THREE.Vector3();
  private initialized = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(CAMERA.fovBase, aspect, 0.1, 500);
  }

  update(dt: number, kart: Kart): void {
    const fwd = kart.forward();
    const targetPos = kart.position
      .clone()
      .addScaledVector(fwd, -CAMERA.distance)
      .add(new THREE.Vector3(0, CAMERA.height, 0));

    if (!this.initialized) {
      this.camera.position.copy(targetPos);
      this.lookTarget.copy(kart.position).addScaledVector(fwd, CAMERA.lookAhead);
      this.initialized = true;
    }

    // Frame-rate independent exp damping.
    const kp = 1 - Math.exp(-CAMERA.posDamp * dt);
    const kl = 1 - Math.exp(-CAMERA.lookDamp * dt);
    this.camera.position.lerp(targetPos, kp);

    const wantLook = kart.position.clone().addScaledVector(fwd, CAMERA.lookAhead).add(new THREE.Vector3(0, 1.0, 0));
    this.lookTarget.lerp(wantLook, kl);
    this.camera.lookAt(this.lookTarget);

    const speedT = THREE.MathUtils.clamp(kart.speed / KART.maxSpeed, 0, 1);
    const wantFov =
      CAMERA.fovBase + CAMERA.fovSpeed * speedT + (kart.state === 'boost' ? CAMERA.fovBoost : 0);
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
