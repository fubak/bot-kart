import * as THREE from 'three';
import { KART } from '../config/tuning';
import type { ControlState } from '../core/Input';
import type { Track } from './Track';

// Arcade kart entity: velocity-based model with exp-grip lateral slip,
// hold-to-drift with mini-turbo charge, wall constraint via track lookup.
// Placeholder visuals — a stylized kart + driver built from primitives;
// real Grok Bot + kart assets come from the Blender pipeline later.

export type DriveState = 'grip' | 'drift' | 'boost';

export class Kart {
  readonly group = new THREE.Group();

  position = new THREE.Vector3();
  heading = 0; // rad; 0 faces -Z (ADR-002)
  velocity = new THREE.Vector3();

  driftDir = 0; // -1/0/+1 (locked while drifting)
  driftCharge = 0;
  boostTimer = 0;
  state: DriveState = 'grip';
  lastWallHit = 0; // sim-time of last wall contact (for feedback hooks)

  private readonly wheels: THREE.Mesh[] = [];
  private readonly frontAxle = new THREE.Group();
  private readonly body: THREE.Group;
  private wheelSpin = 0;
  private steerVisual = 0;
  private lastDt = 0;

  constructor() {
    this.body = new THREE.Group();

    const mat = (c: number) =>
      new THREE.MeshStandardMaterial({ color: c, flatShading: true });

    // Chassis — low wide body, cockpit tub, engine block behind.
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(KART.width, 0.32, KART.length), mat(0xff7847));
    chassis.position.y = 0.32;
    const nose = new THREE.Mesh(new THREE.BoxGeometry(KART.width * 0.72, 0.22, 0.7), mat(0xe8622c));
    nose.position.set(0, 0.3, -KART.length / 2 - 0.2);
    const engine = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.7), mat(0x3a3f52));
    engine.position.set(0, 0.55, KART.length / 2 - 0.45);
    // Driver placeholder: faceted bot head with eyes — silhouette reads at speed.
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), mat(0x46c8ff));
    head.position.set(0, 0.95, 0.15);
    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0b0e1a });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.15, 1.0, -0.18);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.15, 1.0, -0.18);
    this.body.add(chassis, nose, engine, head, eyeL, eyeR);
    this.group.add(this.body);

    // Wheels: 4 cylinders; fronts parented to a steerable axle group.
    const wheelGeo = new THREE.CylinderGeometry(KART.wheelRadius, KART.wheelRadius, 0.3, 12);
    wheelGeo.rotateZ(Math.PI / 2); // axle along X
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1c1f2a });
    const wx = KART.width / 2 + 0.08;
    const wz = KART.length / 2 - 0.55;
    const wy = KART.wheelRadius;
    const rearL = new THREE.Mesh(wheelGeo, wheelMat);
    rearL.position.set(-wx, wy, wz);
    const rearR = new THREE.Mesh(wheelGeo, wheelMat);
    rearR.position.set(wx, wy, wz);
    const frontL = new THREE.Mesh(wheelGeo, wheelMat);
    frontL.position.set(-wx, 0, 0);
    const frontR = new THREE.Mesh(wheelGeo, wheelMat);
    frontR.position.set(wx, 0, 0);
    this.frontAxle.position.set(0, wy, -wz);
    this.frontAxle.add(frontL, frontR);
    this.wheels.push(rearL, rearR, frontL, frontR);
    this.group.add(rearL, rearR, this.frontAxle);
  }

  get speed(): number {
    return this.velocity.length();
  }

  /** Forward speed component (signed; negative = reversing). */
  get forwardSpeed(): number {
    return this.velocity.dot(this.forward());
  }

  forward(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));
  }

  reset(position: THREE.Vector3, heading: number): void {
    this.position.copy(position);
    this.heading = heading;
    this.velocity.set(0, 0, 0);
    this.driftDir = 0;
    this.driftCharge = 0;
    this.boostTimer = 0;
    this.state = 'grip';
    this.syncVisual();
  }

  update(dt: number, input: ControlState, track: Track, simTime: number): void {
    const fwd = this.forward();
    const fwdSpeed = this.velocity.dot(fwd);

    // --- throttle / brake ---
    const boosting = this.boostTimer > 0;
    const topSpeed = KART.maxSpeed + (boosting ? KART.boostSpeed : 0);
    if (input.throttle > 0) {
      const a = boosting ? KART.boostAccel : KART.accel;
      this.velocity.addScaledVector(fwd, a * input.throttle * dt);
    }
    if (input.brake > 0) {
      if (fwdSpeed > 0.5) {
        this.velocity.addScaledVector(fwd, -KART.brake * input.brake * dt);
      } else {
        // At a stop, brake becomes reverse.
        this.velocity.addScaledVector(fwd, -KART.accel * 0.6 * input.brake * dt);
      }
    }
    // Coast drag.
    this.velocity.addScaledVector(fwd, -Math.sign(fwdSpeed) * Math.min(Math.abs(fwdSpeed), KART.drag * dt));

    // Clamp forward speed (leave lateral to the grip model).
    const newFwd = THREE.MathUtils.clamp(this.velocity.dot(fwd), -KART.reverseSpeed, topSpeed);
    const lateral = this.velocity.clone().addScaledVector(fwd, -this.velocity.dot(fwd));
    this.velocity.copy(lateral).addScaledVector(fwd, newFwd);

    // --- drift state machine ---
    const drifting = this.driftDir !== 0;
    if (!drifting && input.drift && input.steer !== 0 && fwdSpeed > KART.steerMinSpeed * 4) {
      this.driftDir = Math.sign(input.steer);
      this.driftCharge = 0;
    }
    if (drifting) {
      const canSustain = input.drift && fwdSpeed > KART.steerMinSpeed * 2;
      if (canSustain) {
        this.driftCharge += dt;
      } else {
        // Release → mini-turbo if a tier was charged.
        const tier = this.driftCharge >= KART.driftChargeTier[1] ? 1 : this.driftCharge >= KART.driftChargeTier[0] ? 0 : -1;
        if (tier === 1) this.boostTimer = KART.boostTime[1];
        else if (tier === 0) this.boostTimer = KART.boostTime[0];
        this.driftDir = 0;
        this.driftCharge = 0;
      }
    }
    this.boostTimer = Math.max(0, this.boostTimer - dt);
    this.state = this.boostTimer > 0 ? 'boost' : this.driftDir !== 0 ? 'drift' : 'grip';

    // --- steering ---
    // Full effect up to steerFullSpeed, gentle fade above, none when parked.
    const speedAbs = Math.abs(fwdSpeed);
    const speedFactor =
      THREE.MathUtils.smoothstep(speedAbs, KART.steerMinSpeed, KART.steerFullSpeed) *
      (1 - 0.35 * THREE.MathUtils.clamp(speedAbs / KART.maxSpeed, 0, 1));
    let steer = input.steer;
    if (drifting) {
      // During a drift the locked direction dominates; opposite stick trims it.
      steer = this.driftDir * 0.8 + input.steer * 0.45;
    }
    const steerMul = drifting ? KART.driftSteerMul : 1;
    // Reverse steering when going backward.
    const dirSign = fwdSpeed >= 0 ? 1 : -1;
    this.heading -= steer * KART.steerRate * steerMul * speedFactor * dirSign * dt;
    this.steerVisual = input.steer;
    this.lastDt = dt;

    // --- grip: exp decay of lateral velocity ---
    const grip = drifting ? KART.driftGrip : KART.grip;
    const fwd2 = this.forward();
    const fAmt = this.velocity.dot(fwd2);
    const lAmt = this.velocity.clone().addScaledVector(fwd2, -fAmt).length();
    const lKeep = Math.exp(-grip * dt);
    const lDir = this.velocity.clone().addScaledVector(fwd2, -fAmt);
    if (lAmt > 1e-5) lDir.normalize();
    this.velocity.copy(fwd2.multiplyScalar(fAmt)).addScaledVector(lDir, lAmt * lKeep);

    // --- walls ---
    const before = this.position.clone();
    this.position.addScaledVector(this.velocity, dt);
    const c = track.constrain(this.position);
    if (c.clamped) {
      // Push-back direction = inward wall normal.
      const normal = before.sub(this.position);
      const d = normal.length();
      if (d > 1e-5) {
        normal.divideScalar(d);
        const out = this.velocity.dot(normal);
        if (out < 0) {
          // Impact frame only: reflect outward component + one-time speed loss.
          this.velocity.addScaledVector(normal, -out * (1 + KART.wallBounce));
          this.velocity.multiplyScalar(KART.wallSpeedLoss);
          this.lastWallHit = simTime;
        } else {
          // Already sliding along the wall: light scrub friction only.
          this.velocity.multiplyScalar(1 - 0.5 * dt);
        }
      }
    }

    this.syncVisual();
  }

  private syncVisual(): void {
    this.group.position.copy(this.position);
    this.group.rotation.y = this.heading;
    this.wheelSpin += (this.forwardSpeed / KART.wheelRadius) * this.lastDt;
    for (const w of this.wheels) w.rotation.x = this.wheelSpin;
    // Visual steer on front axle; body yaw-out + roll while drifting.
    this.frontAxle.rotation.y = -this.steerVisual * 0.45;
    this.body.rotation.y = this.driftDir * -0.28;
    this.body.rotation.z = this.driftDir * 0.06;
  }
}
