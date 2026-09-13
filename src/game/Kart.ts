import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KART } from '../config/tuning';
import type { ControlState } from '../core/Input';
import type { Track } from './Track';
import { KartVfx } from './KartVfx';
import kartGlbUrl from '../../assets/exported/karts/kart-a.glb?url';
import botGlbUrl from '../../assets/exported/characters/grokbot-a.glb?url';

// Arcade kart entity: velocity-based model with exp-grip lateral slip,
// hold-to-drift with mini-turbo charge, wall constraint via track lookup.
// Placeholder visuals — a stylized kart + driver built from primitives;
// real Grok Bot + kart assets come from the Blender pipeline later.

export type DriveState = 'grip' | 'drift' | 'boost';

const UP = new THREE.Vector3(0, 1, 0);

export class Kart {
  readonly group = new THREE.Group();
  readonly vfx = new KartVfx();

  position = new THREE.Vector3();
  heading = 0; // rad; 0 faces -Z (ADR-002)
  velocity = new THREE.Vector3();

  driftDir = 0; // -1/0/+1 (locked while drifting)
  driftCharge = 0;
  boostTimer = 0;
  state: DriveState = 'grip';
  lastWallHit = -1; // sim-time of last wall impact (feedback hooks consume)
  lastWallImpact = 0; // 0..1 severity of the last impact (camera/audio scale)
  slipAngle = 0; // velocity-vs-heading angle (rad), drives drift visual
  private wallContact = false;
  private steerSmooth = 0;
  private impactSquash = 0; // 0..1 wall-hit squash, decays in syncVisual
  vy = 0; // vertical velocity — crests at speed give real airtime
  grounded = true;
  slopePitch = 0; // road pitch under the kart — drives body tilt
  slopeRoll = 0;

  private readonly wheels: THREE.Mesh[] = [];
  private readonly frontAxle = new THREE.Group();
  private readonly body: THREE.Group;
  private readonly proceduralBody: THREE.Object3D[] = [];
  private readonly placeholderDriver: THREE.Object3D[] = [];
  private glbWheels: THREE.Object3D[] = [];
  private wheelSpin = 0;
  private steerVisual = 0;
  private lastDt = 0;
  private readonly tint: THREE.Color | null;
  private readonly botUrl: string;

  /** tint multiplies the GLB materials — cheap rival differentiation until
   *  distinct Bot B/C assets land. */
  constructor(tint?: THREE.ColorRepresentation, botUrl?: string) {
    this.tint = tint === undefined ? null : new THREE.Color(tint);
    this.botUrl = botUrl ?? botGlbUrl;
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
    this.proceduralBody.push(chassis, nose, engine);
    this.placeholderDriver.push(head, eyeL, eyeR);
    this.group.add(this.body);
    this.loadAsset();
    this.loadDriver();

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

  /**
   * Swap the procedural placeholder kart for the Blender-authored GLB once
   * it loads. Keeps the icosahedron bot head as the driver until Bot A's
   * character asset exists. Orientation verified in-game (ADR-002: -Z fwd).
   */
  private loadAsset(): void {
    new GLTFLoader().load(
      kartGlbUrl,
      (gltf) => {
        this.applyAsset(gltf.scene);
      },
      undefined,
      (err) => {
        console.warn('[kart] GLB load failed, keeping placeholder:', err);
        // One retry — covers the file being mid-rewrite during dev.
        setTimeout(() => {
          new GLTFLoader().load(kartGlbUrl, (g) => this.applyAsset(g.scene));
        }, 1500);
      },
    );
  }

  private applyAsset(model: THREE.Group): void {
    // Normalize to KART footprint: GLB is 2.6 m long, target ~3.2 m.
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const scale = KART.length / size.z;
    model.scale.setScalar(scale);
    // Ground the model and center it on the kart origin.
    box.setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center).setY(-box.min.y);
    // GLB wheels are named wheel_fl/fr/rl/rr (axle-local X spin).
    model.traverse((o) => {
      if (o.name.startsWith('wheel_')) this.glbWheels.push(o);
    });
    for (const o of this.proceduralBody) o.visible = false;
    for (const w of this.wheels) w.visible = false;
    if (this.tint) this.tintModel(model);
    this.body.add(model);
  }

  private tintModel(root: THREE.Object3D): void {
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const cloned = mats.map((m) => {
        const c = m.clone();
        if ('color' in c) (c.color as THREE.Color).lerp(this.tint!, 0.55);
        return c;
      });
      o.material = Array.isArray(o.material) ? cloned : cloned[0];
    });
  }

  /** Grok Bot A GLB as the driver — authored seated, origin at seat base. */
  private loadDriver(): void {
    new GLTFLoader().load(
      this.botUrl,
      (gltf) => {
        const bot = gltf.scene;
        const box = new THREE.Box3().setFromObject(bot);
        const size = box.getSize(new THREE.Vector3());
        // Slight downscale: 1.28 m bot in a 3.2 m kart reads proportionate.
        bot.scale.setScalar(0.92);
        box.setFromObject(bot);
        void size;
        // Seat-base origin → place at cockpit floor, slightly behind center.
        bot.position.set(0, 0.62, 0.28);
        for (const o of this.placeholderDriver) o.visible = false;
        this.body.add(bot);
      },
      undefined,
      (err) => console.warn('[kart] driver GLB failed:', err),
    );
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

  right(): THREE.Vector3 {
    const f = this.forward();
    return new THREE.Vector3(-f.z, 0, f.x);
  }

  reset(position: THREE.Vector3, heading: number): void {
    this.position.copy(position);
    this.heading = heading;
    this.velocity.set(0, 0, 0);
    this.driftDir = 0;
    this.driftCharge = 0;
    this.boostTimer = 0;
    this.state = 'grip';
    this.wallContact = false;
    this.steerSmooth = 0;
    this.impactSquash = 0;
    this.slipAngle = 0;
    this.syncVisual();
  }

  update(dt: number, input: ControlState, track: Track, simTime: number): void {
    const fwd = this.forward();
    const fwdSpeed = this.velocity.dot(fwd);

    // --- throttle / brake ---
    const boosting = this.boostTimer > 0;
    const topSpeed = KART.maxSpeed + (boosting ? KART.boostSpeed : 0);
    if (input.throttle > 0) {
      // Launch surge: extra kick off the line, tapering out by launchSpeed.
      const surge =
        fwdSpeed < KART.launchSpeed ? THREE.MathUtils.lerp(KART.launchMul, 1, fwdSpeed / KART.launchSpeed) : 1;
      const a = (boosting ? KART.boostAccel : KART.accel) * surge;
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
    // Coast drag — only when off-throttle (critic: it silently ate accel).
    if (input.throttle === 0) {
      this.velocity.addScaledVector(fwd, -Math.sign(fwdSpeed) * Math.min(Math.abs(fwdSpeed), KART.drag * dt));
    }

    // Speed handling: cap forward speed; above topSpeed (boost end) BLEED back
    // at overSpeedDecay rather than hard-clamping in one step (critic jolt).
    const lateral = this.velocity.clone().addScaledVector(fwd, -this.velocity.dot(fwd));
    let newFwd = this.velocity.dot(fwd);
    if (newFwd > topSpeed) newFwd = Math.max(topSpeed, newFwd - KART.overSpeedDecay * dt);
    newFwd = Math.max(newFwd, -KART.reverseSpeed);
    this.velocity.copy(lateral).addScaledVector(fwd, newFwd);

    // --- drift state machine ---
    const drifting = this.driftDir !== 0;
    if (!drifting && input.drift && input.steer !== 0 && fwdSpeed > KART.driftEnterSpeed) {
      this.driftDir = Math.sign(input.steer);
      this.driftCharge = 0;
    }
    if (drifting) {
      // Sustain needs real forward speed (kills parking-lot donuts) and the
      // drift button. Charge only accrues while genuinely moving + sliding.
      const canSustain = input.drift && fwdSpeed > KART.driftSustainSpeed;
      if (canSustain) {
        if (input.brake === 0 && fwdSpeed > KART.driftChargeSpeed && Math.abs(this.slipAngle) > 0.1) {
          this.driftCharge = Math.min(this.driftCharge + dt, KART.driftChargeTier[1] + 0.3);
        }
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
    // Virtual wheel slews toward the stick target — asymmetric: fast attack
    // (corrections land sooner), softer release (taps stay gentle). Drift
    // biases the wheel into the drift direction but leaves counter-steer
    // authority — that's the skill input.
    const slewTarget = drifting ? this.driftDir * 0.55 + input.steer * 0.5 : input.steer;
    const attacking = Math.abs(slewTarget) > Math.abs(this.steerSmooth);
    const slewRate = (attacking ? KART.steerAttack : KART.steerRelease) * (drifting ? 1.6 : 1);
    this.steerSmooth += THREE.MathUtils.clamp(
      slewTarget - this.steerSmooth, -slewRate * dt, slewRate * dt,
    );
    // Full effect up to steerFullSpeed, gentle fade above, none when parked.
    const speedAbs = Math.abs(fwdSpeed);
    const speedFactor =
      THREE.MathUtils.smoothstep(speedAbs, KART.steerMinSpeed, KART.steerFullSpeed) *
      (1 - 0.35 * THREE.MathUtils.clamp(speedAbs / KART.maxSpeed, 0, 1));
    const steerMul = drifting ? KART.driftSteerMul : 1;
    // Reverse steering when going backward.
    const dirSign = fwdSpeed >= 0 ? 1 : -1;
    const yawDelta = -this.steerSmooth * KART.steerRate * steerMul * speedFactor * dirSign * dt;
    this.heading += yawDelta;
    // Drift arc model: the velocity vector follows a fraction of the yaw —
    // the kart carves a widening arc instead of spinning through its own
    // velocity (critic: held drift → slip 62–80°, speed collapse, spin-out).
    if (drifting) {
      this.velocity.applyAxisAngle(UP, yawDelta * KART.driftVelFollow);
      // Mild scrub — holds ~83% of entry speed through a 1.2 s drift.
      this.velocity.multiplyScalar(Math.exp(-KART.driftScrub * dt));
    }
    this.steerVisual = this.steerSmooth;
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

    // --- walls: contact-episode model ---
    // Impact penalty fires once per wall ENTRY (scaled by impact speed), not
    // per step — sustained contact slides with a light scrub (critic tar-pit).
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
          // Remove outward velocity with restitution.
          this.velocity.addScaledVector(normal, -out * (1 + KART.wallBounce));
        }
        if (!this.wallContact) {
          // Contact episode start: penalty scales with how hard we hit.
          const impact = Math.min(1, Math.abs(out) / KART.maxSpeed);
          this.lastWallImpact = impact;
          this.velocity.multiplyScalar(1 - KART.wallImpactLoss * (0.3 + 0.7 * impact));
          // No backward ejection — the kart stops, it never bounces off
          // facing the wall (critic: restitution ping-ponged it back in).
          const fNow = this.velocity.dot(fwd);
          if (fNow < 0) this.velocity.addScaledVector(fwd, -fNow);
          this.lastWallHit = simTime;
          this.impactSquash = 0.4 + 0.6 * impact;
          this.wallContact = true;
        } else {
          // Sustained grind: scrub friction + a hard cap — grinding is a
          // real cost, not a free rail (critic: kart re-accelerated to full
          // speed while in contact).
          this.velocity.multiplyScalar(Math.exp(-KART.wallScrub * dt));
          const grindCap = KART.maxSpeed * KART.wallGrindCap;
          if (this.velocity.length() > grindCap) {
            this.velocity.setLength(THREE.MathUtils.lerp(this.velocity.length(), grindCap, 1 - Math.exp(-8 * dt)));
          }
        }
      }
    } else {
      this.wallContact = false;
    }

    // --- elevation: follow road height, catch air over crests ---
    // Grounded karts track the surface upward (climb); cresting fast leaves
    // groundY below position.y → gravity pulls back down = real airtime.
    const groundY = track.heightAt(this.position);
    this.vy -= KART.gravity * dt;
    this.position.y += this.vy * dt;
    if (this.position.y <= groundY) {
      this.position.y = groundY;
      this.vy = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }
    // Slope gravity (grounded only): uphill bleeds speed, downhill adds it.
    const fwdE = this.forward();
    const hA = track.heightAt(this.position.clone().addScaledVector(fwdE, 1.4));
    const hB = track.heightAt(this.position.clone().addScaledVector(fwdE, -1.4));
    this.slopePitch = Math.atan2(hA - hB, 2.8);
    if (this.grounded) {
      this.velocity.addScaledVector(fwdE, -Math.sin(this.slopePitch) * KART.slopeForce * dt);
    }
    const rE = this.right();
    const hR = track.heightAt(this.position.clone().addScaledVector(rE, 0.9));
    const hL = track.heightAt(this.position.clone().addScaledVector(rE, -0.9));
    this.slopeRoll = Math.atan2(hR - hL, 1.8);

    // Actual slip angle (velocity vs heading) drives the drift visual.
    const fAmt2 = this.velocity.dot(this.forward());
    const lat = this.velocity.clone().addScaledVector(this.forward(), -fAmt2);
    const latSigned = lat.dot(this.right());
    this.slipAngle = this.speed > 0.5 ? Math.atan2(latSigned, Math.abs(fAmt2)) : 0;
    // Held-slip ceiling: while drifting, heading may lead velocity by at most
    // driftMaxSlip — settles into a held ~30° slide instead of a spin-out.
    if (drifting && Math.abs(this.slipAngle) > KART.driftMaxSlip) {
      const velHeading = Math.atan2(-this.velocity.x, -this.velocity.z);
      const s = Math.sign(this.slipAngle);
      this.heading = velHeading + s * KART.driftMaxSlip;
      this.slipAngle = s * KART.driftMaxSlip;
    }
    // Keep heading bounded.
    if (this.heading > Math.PI * 4 || this.heading < -Math.PI * 4) {
      this.heading = THREE.MathUtils.euclideanModulo(this.heading + Math.PI, Math.PI * 2) - Math.PI;
    }

    // --- VFX emission (world space) ---
    const right2 = this.right();
    const fwd3 = this.forward();
    const rearC = this.position.clone().addScaledVector(fwd3, -(KART.length / 2 - 0.55)).setY(0.25);
    if (this.driftDir !== 0) {
      // Sparks at both rear wheels — tier color is the player's charge readout.
      const wx = KART.width / 2 + 0.08;
      if (Math.random() < 60 * dt) {
        this.vfx.driftSparks(rearC.clone().addScaledVector(right2, -wx), this.velocity, this.driftCharge);
        this.vfx.driftSparks(rearC.clone().addScaledVector(right2, wx), this.velocity, this.driftCharge);
      }
    }
    if (this.boostTimer > 0) {
      if (Math.random() < 90 * dt) this.vfx.boostFlame(rearC.clone().setY(0.55), this.velocity);
    }
    if (c.clamped && Math.random() < 30 * dt) {
      const inward = this.position.clone().sub(before).setY(0);
      if (inward.lengthSq() > 1e-6) {
        this.vfx.wallChips(this.position.clone().setY(0.3), inward.normalize());
      }
    }
    this.vfx.update(dt);

    this.syncVisual();
  }

  private syncVisual(): void {
    this.group.position.copy(this.position);
    this.group.rotation.order = 'YXZ'; // yaw-dominant: pitch/roll after heading
    this.group.rotation.y = this.heading;
    // Pitch/roll the whole kart to the road grade — sells the elevation.
    this.group.rotation.x = this.slopePitch * 0.7;
    this.group.rotation.z = -this.slopeRoll * 0.6;
    this.wheelSpin += (this.forwardSpeed / KART.wheelRadius) * this.lastDt;
    for (const w of this.wheels) w.rotation.x = this.wheelSpin;
    for (const w of this.glbWheels) w.rotation.x = this.wheelSpin;
    // Visual steer on front axle.
    this.frontAxle.rotation.y = -this.steerVisual * 0.45;
    // Body yaws with the TRUE slip angle (not a fixed snap) + leans into it.
    const slip = THREE.MathUtils.clamp(this.slipAngle, -0.6, 0.6);
    this.body.rotation.y = -slip * 0.7;
    this.body.rotation.z = slip * 0.12;
    // Wall-impact squash: brief scale dip on contact (consumes lastWallHit).
    this.impactSquash = Math.max(0, this.impactSquash - this.lastDt * 6);
    const s = this.impactSquash;
    this.body.scale.set(1 + s * 0.1, 1 - s * 0.18, 1 + s * 0.1);
  }
}
