import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KART } from '../config/tuning';
import type { ControlState } from '../core/Input';
import type { Track } from './Track';
import { Fx } from './Fx';
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
  readonly vfx: Fx;

  position = new THREE.Vector3();
  heading = 0; // rad; 0 faces -Z (ADR-002)
  velocity = new THREE.Vector3();

  driftDir = 0; // -1/0/+1 (locked while drifting)
  driftCharge = 0;
  boostTimer = 0;
  state: DriveState = 'grip';
  lastWallHit = -1; // sim-time of last impact w/ feedback (walls + landings)
  lastWallImpact = 0; // 0..1 severity of the last impact (camera/audio scale)
  /** True wall impacts only — the QA metric (lastWallHit also fires on
   *  landings and item hits, which legitimately shake/thump). */
  wallHitCount = 0;
  /** Rubber-band pace assist (-1..+1 fraction of maxSpeed) — Game sets it
   *  from each AI kart's score gap vs the player; 0 = no assist. */
  paceAssist = 0;
  /** Ink item: vision-denied until this sim-time (`inked` flag mirrors it). */
  inkedUntil = 0;
  inked = false;
  /** Set when this kart's racer finishes — driver celebrates. */
  celebrating = false;
  /** Finish position (1 = winner) — celebration intensity varies. */
  finishRank = 0;
  // Night-race headlights: emissive lamp quads + a beam spotlight
  // (beam only on the player kart — one extra light is cheap).
  private readonly headlamps: THREE.Object3D[] = [];
  private headlight?: THREE.SpotLight;
  /** True while a spin-out is in effect (item hits) — QA/AI read it. */
  isSpinning = false;
  slipAngle = 0; // velocity-vs-heading angle (rad), drives drift visual
  private wallContact = false;
  /** True while position-clamped against a wall face (AI grind detection). */
  get onWall(): boolean {
    return this.wallContact;
  }
  private steerSmooth = 0;
  private impactSquash = 0; // 0..1 wall-hit squash, decays in syncVisual
  /** Spin-out state (item hits): yaw spins freely, controls dead, until this
   *  sim-time. Set by Items on missile/slick hits. */
  spinUntil = -1;
  /** Player-only standstill pivot authority (critic11 dead-stop pin): AI
   *  keeps its own wedge/recovery ladder, and giving bots launch-phase
   *  pivot yaw nudged the NN top bot's line +0.04 s off the smoke
   *  baseline — defaults off; Game arms it on the player kart. */
  pivotSteer = false;
  private lastSimTime = 0;
  private readonly driver = new THREE.Group();
  private readonly driverPhase = Math.random() * Math.PI * 2;
  vy = 0; // vertical velocity — crests at speed give real airtime
  grounded = true;
  airTime = 0; // seconds airborne — landing feedback scales with it
  slopePitch = 0; // road pitch under the kart — drives body tilt
  slopeRoll = 0;
  onGravel = false; // off-road apron — heavy drag + rumble (shortcut cost)
  /** Continuity hint for centerline lookups — the sample index this kart
   *  was last constrained against. Folded layouts put parallel legs close
   *  together; a global nearest-sample lookup can snap to the wrong leg
   *  there (critic: kart beached on infield grass inside another leg's
   *  limit). Reset via syncTrackIndex after any teleport. */
  trackIdx = 0;

  private readonly wheels: THREE.Mesh[] = [];
  private readonly frontAxle = new THREE.Group();
  private readonly body: THREE.Group;
  private readonly proceduralBody: THREE.Object3D[] = [];
  private readonly placeholderDriver: THREE.Object3D[] = [];
  private glbWheels: THREE.Object3D[] = [];
  private wheelSpin = 0;
  private steerVisual = 0;
  private pedalL = 0; // brake held — left leg press
  private pedalR = 0; // throttle held — right leg press
  private lastDt = 0;
  private readonly tint: THREE.Color | null;
  private readonly botUrl: string;
  private readonly kartUrl: string;
  // Articulated driver limbs (seated-bot GLBs ship a full node rig):
  // base rotation cached at load so emotes apply as additive deltas.
  private readonly limbs: Record<string, { node: THREE.Object3D; base: THREE.Euler }> = {};
  private readonly eyes: { node: THREE.Object3D; base: THREE.Vector3 }[] = [];
  private blinkAt = 2 + Math.random() * 3; // next blink (sim seconds)

  /** tint multiplies the GLB materials — cheap rival differentiation until
   *  distinct Bot B/C assets land. */
  constructor(tint?: THREE.ColorRepresentation, botUrl?: string, kartUrl?: string, fx?: Fx) {
    this.vfx = fx ?? new Fx();
    this.tint = tint === undefined ? null : new THREE.Color(tint);
    this.botUrl = botUrl ?? botGlbUrl;
    this.kartUrl = kartUrl ?? kartGlbUrl;
    this.body = new THREE.Group();

    // WS-MAT: glossy paint on body panels (clearcoat over a mid-roughness
    // base — the coat carries the sun/env highlight so the base keeps its
    // stylized diffuse shape), metal for the engine block. flatShading is
    // preserved — facets stay stylized, only the response changes.
    const paint = (c: number) =>
      new THREE.MeshPhysicalMaterial({
        color: c,
        flatShading: true,
        roughness: 0.55,
        clearcoat: 0.7,
        clearcoatRoughness: 0.32,
      });
    const metal = (c: number) =>
      new THREE.MeshPhysicalMaterial({
        color: c,
        flatShading: true,
        roughness: 0.45,
        metalness: 0.6,
        clearcoat: 0.25,
        clearcoatRoughness: 0.4,
      });

    // Chassis — low wide body, cockpit tub, engine block behind.
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(KART.width, 0.32, KART.length), paint(0xff7847));
    chassis.position.y = 0.32;
    const nose = new THREE.Mesh(new THREE.BoxGeometry(KART.width * 0.72, 0.22, 0.7), paint(0xe8622c));
    nose.position.set(0, 0.3, -KART.length / 2 - 0.2);
    const engine = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.7), metal(0x3a3f52));
    engine.position.set(0, 0.55, KART.length / 2 - 0.45);
    // Driver placeholder: faceted bot head with eyes — silhouette reads at speed.
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), paint(0x46c8ff));
    head.position.set(0, 0.95, 0.15);
    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0b0e1a });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.15, 1.0, -0.18);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.15, 1.0, -0.18);
    this.driver.add(head, eyeL, eyeR);
    this.body.add(chassis, nose, engine, this.driver);
    this.proceduralBody.push(chassis, nose, engine);
    this.placeholderDriver.push(head, eyeL, eyeR);
    this.group.add(this.body);
    // Headlight lamp quads — hidden until setNight(true). Parented to the
    // body so they yaw/lean with the kart. 0.11 not 0.14: the lamp dots
    // bloom into a white ball at night otherwise (critic9).
    const lampGeo = new THREE.CircleGeometry(0.11, 10);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9c2 });
    for (const x of [-0.42, 0.42]) {
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(x, 0.34, -KART.length / 2 - 0.56);
      lamp.visible = false;
      this.body.add(lamp);
      this.headlamps.push(lamp);
    }
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
    // Shadow casting — GLB assets set their own on load; procedural
    // fallback parts cast too.
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
  }

  /**
   * Swap the procedural placeholder kart for the Blender-authored GLB once
   * it loads. Keeps the icosahedron bot head as the driver until Bot A's
   * character asset exists. Orientation verified in-game (ADR-002: -Z fwd).
   */
  private loadAsset(): void {
    new GLTFLoader().load(
      this.kartUrl,
      (gltf) => {
        this.applyAsset(gltf.scene);
      },
      undefined,
      (err) => {
        console.warn('[kart] GLB load failed, keeping placeholder:', err);
        // One retry — covers the file being mid-rewrite during dev.
        setTimeout(() => {
          new GLTFLoader().load(this.kartUrl, (g) => this.applyAsset(g.scene));
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
    // GLB wheels: exact axle nodes wheel_fl/fr/rl/rr (their _1/_2/_3 child
    // parts are tread/hub pieces of the same wheel — matching the prefix
    // would double-spin them).
    model.traverse((o) => {
      if (/^wheel_(fl|fr|rl|rr)$/.test(o.name)) this.glbWheels.push(o);
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    for (const o of this.proceduralBody) o.visible = false;
    for (const w of this.wheels) w.visible = false;
    this.glossMaterials(model);
    if (this.tint) this.tintModel(model);
    this.body.add(model);
  }

  /**
   * WS-MAT: promote the GLB's flat MeshStandardMaterials to
   * MeshPhysicalMaterial — clearcoat paint on body panels, modest metalness
   * on metal trim — so sun/env produce readable specular at chase distance.
   * Emissive `*glow` accents and rubber `tire` keep their cheap standard
   * shading; shared materials convert once (cache) and the originals are
   * disposed. Runs BEFORE tintModel so tinted clones inherit the gloss.
   */
  private glossMaterials(root: THREE.Object3D): void {
    const cache = new Map<THREE.Material, THREE.Material>();
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const out = mats.map((m) => {
        let u = cache.get(m);
        if (!u) {
          u = Kart.toGloss(m);
          cache.set(m, u);
        }
        return u;
      });
      o.material = Array.isArray(o.material) ? out : out[0];
    });
    for (const [oldM, newM] of cache) {
      if (oldM !== newM) oldM.dispose();
    }
  }

  /** Standard→physical upgrade; materials that should stay cheap pass
   *  through unchanged. `MeshPhysicalMaterial.copy` can't consume a
   *  standard source (physical props read undefined), so fields are
   *  carried over by hand. */
  private static toGloss(m: THREE.Material): THREE.Material {
    if (!(m instanceof THREE.MeshStandardMaterial) || m instanceof THREE.MeshPhysicalMaterial) return m;
    const name = m.name ?? '';
    if (/glow|tire/i.test(name)) return m; // emitters + rubber stay standard
    const p = new THREE.MeshPhysicalMaterial();
    p.name = name;
    p.color.copy(m.color);
    p.map = m.map;
    p.emissive.copy(m.emissive);
    p.emissiveMap = m.emissiveMap;
    p.emissiveIntensity = m.emissiveIntensity;
    p.flatShading = m.flatShading;
    p.transparent = m.transparent;
    p.opacity = m.opacity;
    p.side = m.side;
    p.alphaTest = m.alphaTest;
    p.depthWrite = m.depthWrite;
    p.vertexColors = m.vertexColors;
    p.normalMap = m.normalMap;
    p.aoMap = m.aoMap;
    p.envMapIntensity = m.envMapIntensity;
    const glassy = /visor|windshield|glass|lens/i.test(name);
    if (!glassy && m.metalness > 0.15) {
      // Polished metal trim — capped so it reads as trim, not chrome.
      p.metalness = Math.min(0.62, m.metalness + 0.12);
      p.roughness = Math.min(m.roughness, 0.45);
      p.clearcoat = 0.3;
      p.clearcoatRoughness = 0.28;
    } else {
      // Glossy paint: clearcoat carries the highlight; authored roughness
      // keeps the base coat's diffuse shape.
      p.metalness = 0;
      p.roughness = m.roughness;
      p.clearcoat = glassy ? 0.9 : 0.7;
      p.clearcoatRoughness = glassy ? 0.18 : 0.3;
    }
    return p;
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
        bot.traverse((o) => {
          if (o instanceof THREE.Mesh) o.castShadow = true;
        });
        this.glossMaterials(bot); // bot shells read as glossy plastic
        // Matte the head dome down (critic10): the physical clearcoat +
        // env response clipped the whole head to a white orb under the
        // night fill. Eyes keep their own glow mats (toGloss passes them).
        const headNode = bot.getObjectByName('head');
        headNode?.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          for (const hm of ms) {
            if (hm instanceof THREE.MeshPhysicalMaterial) {
              hm.clearcoat = Math.min(hm.clearcoat, 0.25);
              hm.envMapIntensity = Math.min(hm.envMapIntensity, 0.45);
              hm.roughness = Math.max(hm.roughness, 0.55);
            }
          }
        });
        for (const o of this.placeholderDriver) o.visible = false;
        for (const name of ['arm_l', 'arm_r', 'head', 'leg_l', 'leg_r']) {
          const node = bot.getObjectByName(name);
          if (node) this.limbs[name] = { node, base: node.rotation.clone() };
        }
        // Eye nodes for blinks — base scale cached to restore after each wink.
        for (const name of ['eye_l', 'eye_r']) {
          const node = bot.getObjectByName(name);
          if (node) this.eyes.push({ node, base: node.scale.clone() });
        }
        this.driver.add(bot);
      },
      undefined,
      (err) => console.warn('[kart] driver GLB failed:', err),
    );
  }

  /** Night mode: lamp quads glow on every kart; `beam` also mounts a real
   *  spotlight ahead (player kart only — one extra light stays cheap). */
  setNight(on: boolean, beam = false): void {
    for (const l of this.headlamps) l.visible = on;
    if (on && beam && !this.headlight) {
      // 60→34: the full-power beam + fill blew the driver head out to a
      // pure-white ball at night (critic9). Still a real throw ahead.
      this.headlight = new THREE.SpotLight(0xffeecc, 34, 55, 0.5, 0.5, 1.6);
      this.headlight.position.set(0, 1.4, -1.2);
      this.headlight.target.position.set(0, 0, -14);
      this.group.add(this.headlight, this.headlight.target);
      // Soft warm fill so the player's kart doesn't vanish into the dark —
      // one extra light, same budget discipline as the beam.
      // 7.5→4.2 and lifted higher/forward (critic10): the close hot fill
      // clipped the driver's glossy head to a featureless white orb.
      this.fill = new THREE.PointLight(0xffd8b0, 4.2, 9, 1.8);
      this.fill.position.set(0, 3.1, 1.6);
      this.group.add(this.fill);
    } else if (!on && this.headlight) {
      this.group.remove(this.headlight, this.headlight.target);
      this.headlight.dispose();
      this.headlight = undefined;
      this.group.remove(this.fill!);
      this.fill!.dispose();
      this.fill = undefined;
    }
  }
  private fill?: THREE.PointLight;

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
    this.wallHitCount = 0;
    this.paceAssist = 0;
    this.inkedUntil = 0;
    this.inked = false;
    this.celebrating = false;
    this.trackIdx = -1; // teleported — re-anchor globally on next update
    this.syncVisual();
  }

  update(dt: number, input: ControlState, track: Track, simTime: number): void {
    this.lastSimTime = simTime;
    this.isSpinning = simTime < this.spinUntil;
    if (this.trackIdx < 0) this.trackIdx = track.nearestIndex(this.position);
    // Spin-out (item hits): yaw whips freely, controls dead, velocity decays.
    if (this.isSpinning) {
      this.heading += 11 * dt;
      this.velocity.multiplyScalar(1 - Math.min(1, 3.2 * dt));
      this.driftDir = 0;
      this.driftCharge = 0;
      this.position.addScaledVector(this.velocity, dt);
      this.trackIdx = track.constrain(this.position, this.trackIdx).index;
      const gy = track.heightAt(this.position, this.trackIdx);
      if (this.position.y < gy) this.position.y = gy;
      this.syncVisual();
      return;
    }
    const fwd = this.forward();
    const fwdSpeed = this.velocity.dot(fwd);
    // Pedal work for the driver rig: right leg presses with throttle,
    // left with brake (CHAR: static legs were the last rig gap).
    this.pedalR = input.throttle;
    this.pedalL = input.brake;

    // --- throttle / brake ---
    const boosting = this.boostTimer > 0;
    const topSpeed =
      KART.maxSpeed * (1 + this.paceAssist) + (boosting ? KART.boostSpeed : 0);
    if (input.throttle > 0) {
      // Launch surge: extra kick off the line, tapering out by launchSpeed.
      const surge =
        fwdSpeed < KART.launchSpeed ? THREE.MathUtils.lerp(KART.launchMul, 1, fwdSpeed / KART.launchSpeed) : 1;
      const a =
        (boosting ? KART.boostAccel : KART.accel) *
        surge *
        (1 + this.paceAssist * 0.5);
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
    // Full effect up to steerFullSpeed, gentle fade above. Parked used to
    // mean zero authority (critic11 dead-stop pin): a kart nose-in at a
    // wall could not turn at all — only S-reverse or ⌫ escaped. While the
    // driver is applying drive input at near-zero speed, allow a slow
    // pivot in place so a pin is escapable with W+steer (the normal kart
    // move). Doesn't touch the speed range the smoke lines live in.
    const speedAbs = Math.abs(fwdSpeed);
    const speedFactor =
      THREE.MathUtils.smoothstep(speedAbs, KART.steerMinSpeed, KART.steerFullSpeed) *
      (1 - 0.35 * THREE.MathUtils.clamp(speedAbs / KART.maxSpeed, 0, 1));
    const pivot =
      this.pivotSteer && Math.abs(input.throttle) + Math.abs(input.brake) > 0.1
        ? 0.4 * (1 - THREE.MathUtils.smoothstep(speedAbs, KART.steerMinSpeed * 0.6, 5))
        : 0;
    const steerAuthority = Math.max(speedFactor, pivot);
    const steerMul = drifting ? KART.driftSteerMul : 1;
    // Reverse steering when going backward — but NOT off raw fwdSpeed at
    // a dead stop: nose-in at a wall, restitution jitter drives fwdSpeed
    // ± across 0 every tick, which flipped the pivot yaw each frame and
    // pinned the kart in place (critic12 MED). Under steerMinSpeed the
    // steer direction follows drive intent: brake-dominant → reverse,
    // otherwise → forward.
    const dirSign =
      speedAbs < KART.steerMinSpeed
        ? input.brake > Math.abs(input.throttle)
          ? -1
          : 1
        : fwdSpeed >= 0
          ? 1
          : -1;
    const yawDelta = -this.steerSmooth * KART.steerRate * steerMul * steerAuthority * dirSign * dt;
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
    this.position.addScaledVector(this.velocity, dt);
    const c = track.constrain(this.position, this.trackIdx);
    this.trackIdx = c.index;
    if (c.clamped) {
      // Inward wall normal from the TRACK FRAME — not the position delta.
      // A kart parked exactly on the clamp produces before−after ≈ 0, so a
      // delta-derived normal vanished and the whole response was skipped
      // while throttle kept integrating: nose-in read top speed/FOV/revs,
      // defeated the stuck hint, and stored a free launch (critic4 HIGH).
      const normal = track.leftAt(c.index).clone().multiplyScalar(-Math.sign(c.lateral));
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
        this.wallHitCount++;
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
    } else {
      this.wallContact = false;
    }

    // --- elevation: follow road height, catch air over crests ---
    // Grounded karts track the surface upward (climb); cresting fast leaves
    // groundY below position.y → gravity pulls back down = real airtime.
    const groundY = track.heightAt(this.position, this.trackIdx);
    this.vy -= KART.gravity * dt;
    this.position.y += this.vy * dt;
    if (this.position.y <= groundY) {
      this.position.y = groundY;
      this.vy = 0;
      if (!this.grounded && this.airTime > 0.22) {
        // Landing feedback: squash + dust + a camera/audio thump scaled by
        // hang time (critic: 1-3 s crest flights landed silently).
        this.impactSquash = Math.min(0.55, this.airTime * 0.45);
        this.lastWallHit = simTime;
        this.lastWallImpact = Math.min(1, this.airTime * 0.5);
        this.vfx.dust(this.position.clone().setY(groundY + 0.15), this.velocity, 0xcfc4ae);
      }
      this.airTime = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
      this.airTime += dt;
    }
    // Slope gravity (grounded only): uphill bleeds speed, downhill adds it.
    const fwdE = this.forward();
    const hA = track.heightAt(this.position.clone().addScaledVector(fwdE, 1.4), this.trackIdx);
    const hB = track.heightAt(this.position.clone().addScaledVector(fwdE, -1.4), this.trackIdx);
    this.slopePitch = Math.atan2(hA - hB, 2.8);
    if (this.grounded) {
      this.velocity.addScaledVector(fwdE, -Math.sin(this.slopePitch) * KART.slopeForce * dt);
    }
    const rE = this.right();
    const hR = track.heightAt(this.position.clone().addScaledVector(rE, 0.9), this.trackIdx);
    const hL = track.heightAt(this.position.clone().addScaledVector(rE, -0.9), this.trackIdx);
    this.slopeRoll = Math.atan2(hR - hL, 1.8);

    // Actual slip angle (velocity vs heading) drives the drift visual.
    const fAmt2 = this.velocity.dot(this.forward());
    const lat = this.velocity.clone().addScaledVector(this.forward(), -fAmt2);
    const latSigned = lat.dot(this.right());
    this.slipAngle = this.speed > 0.5 ? Math.atan2(latSigned, Math.abs(fAmt2)) : 0;

    // Off-road surface: gravel aprons (shortcut zones) — heavy drag, hard
    // cap, rumble jitter + brown dust. Shorter path, slower surface.
    this.onGravel = track.surfaceAt(this.position, this.trackIdx) === 'gravel';
    if (this.onGravel && this.grounded) {
      const fs = this.velocity.dot(fwd);
      this.velocity.addScaledVector(fwd, -Math.sign(fs) * Math.min(Math.abs(fs), KART.gravelDrag * dt));
      // Hard speed cap on gravel — entering fast scrubs down to the limit
      // immediately (previous exp decay at 120 Hz killed speed to ~0).
      if (this.speed > KART.gravelMaxSpeed) {
        this.velocity.multiplyScalar(KART.gravelMaxSpeed / this.speed);
      }
      if (this.speed > 8 && Math.random() < 0.7) {
        this.vfx.dust(
          this.position.clone().setY(this.position.y + 0.15),
          this.velocity,
        );
      }
    }
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
      const inward = track.leftAt(c.index).clone().multiplyScalar(-Math.sign(c.lateral)).setY(0);
      this.vfx.wallChips(this.position.clone().setY(0.3), inward);
    }
    // Spin-out stars — orbiting four-point stars while controls are dead.
    if (this.isSpinning) {
      const a = this.lastSimTime * 15 + this.driverPhase;
      this.vfx.spinStar(this.position, a);
      this.vfx.spinStar(this.position, a + Math.PI);
    }

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

    // Driver expressiveness: idle bob, lean with steering, eyes track the
    // slide, flinch back on impacts — sells the bots as characters.
    const t = this.lastSimTime + this.driverPhase;
    // Limb emotes — additive deltas on the rig's cached base pose:
    //   celebrating → right arm pumps the air
    //   spinning    → both arms flail
    //   steering    → head looks into the turn
    const armL = this.limbs['arm_l'];
    const armR = this.limbs['arm_r'];
    const headN = this.limbs['head'];
    const legL = this.limbs['leg_l'];
    const legR = this.limbs['leg_r'];
    if (this.celebrating) {
      // Victory bounce — the winner (finishRank 1) pumps an arm high while
      // other finishers give a smaller gracious hop with a dipped head.
      const winner = this.finishRank === 1;
      const amp = winner ? 1 : 0.5;
      this.driver.position.y = Math.abs(Math.sin(t * 7)) * 0.12 * amp;
      this.driver.rotation.z = Math.sin(t * 7) * 0.35 * amp;
      this.driver.rotation.y = Math.sin(t * 3.5) * 0.5;
      this.driver.rotation.x = winner ? -0.15 : 0.2; // losers nod forward
      if (armR) {
        armR.node.rotation.set(
          armR.base.x - (winner ? 1.9 : 0.6) + Math.sin(t * 9) * 0.45 * amp,
          armR.base.y,
          armR.base.z,
        );
      }
      if (armL) armL.node.rotation.set(armL.base.x - (winner ? 1.4 : 0.3), armL.base.y, armL.base.z + Math.sin(t * 9 + 1) * 0.3 * amp);
      // Legs kick with the hop — the whole driver celebrates.
      if (legL) legL.node.rotation.set(legL.base.x - 0.35 + Math.sin(t * 9) * 0.15, legL.base.y, legL.base.z);
      if (legR) legR.node.rotation.set(legR.base.x - 0.35 + Math.sin(t * 9 + 1.6) * 0.15, legR.base.y, legR.base.z);
      return;
    }
    if (this.isSpinning) {
      if (armL) armL.node.rotation.set(armL.base.x - 2.2, armL.base.y, armL.base.z + Math.sin(t * 30) * 0.5);
      if (armR) armR.node.rotation.set(armR.base.x - 2.2, armR.base.y, armR.base.z - Math.sin(t * 30) * 0.5);
      if (headN) headN.node.rotation.set(headN.base.x + 0.3, headN.base.y + Math.sin(t * 20) * 0.4, headN.base.z);
      // Legs kick with the flail.
      if (legL) legL.node.rotation.set(legL.base.x - 0.5 + Math.sin(t * 26) * 0.25, legL.base.y, legL.base.z);
      if (legR) legR.node.rotation.set(legR.base.x - 0.5 + Math.sin(t * 26 + 1.6) * 0.25, legR.base.y, legR.base.z);
    } else {
      if (armL) armL.node.rotation.copy(armL.base);
      if (armR) armR.node.rotation.copy(armR.base);
      // Head tracks the steering — the driver looks into the corner.
      // At near-standstill (title orbit, grid, countdown) the head
      // wanders instead: a slow two-frequency glance that reads as the
      // driver scanning the crowd/rivals.
      const idleLook = Math.abs(this.forwardSpeed) < 2 ? Math.sin(t * 0.53) * 0.5 + Math.sin(t * 0.21) * 0.25 : 0;
      if (headN)
        headN.node.rotation.set(
          headN.base.x,
          headN.base.y - this.steerVisual * 0.45 - slip * 0.25 + idleLook,
          headN.base.z,
        );
      // Pedal work: right leg presses with throttle, left with brake —
      // the driver visibly works the kart (CHAR: static legs).
      if (legL)
        legL.node.rotation.set(
          legL.base.x - this.pedalL * 0.22 + Math.sin(t * 2.3) * 0.015,
          legL.base.y,
          legL.base.z,
        );
      if (legR)
        legR.node.rotation.set(
          legR.base.x - this.pedalR * 0.22 + Math.sin(t * 2.3 + 1.6) * 0.015,
          legR.base.y,
          legR.base.z,
        );
    }
    // Blink: brief 120 ms eye squash every 2.5–5.5 s — bots feel alive.
    const blinking = this.lastSimTime >= this.blinkAt;
    for (const e of this.eyes) {
      e.node.scale.set(
        e.base.x,
        blinking ? e.base.y * 0.12 : e.base.y,
        e.base.z,
      );
    }
    if (blinking && this.lastSimTime > this.blinkAt + 0.12) {
      this.blinkAt = this.lastSimTime + 2.5 + Math.random() * 3;
    }
    this.driver.position.y =
      Math.sin(t * 2.3) * 0.022 + (this.onGravel ? Math.sin(t * 43) * 0.02 : 0);
    this.driver.rotation.z = -this.steerVisual * 0.16 - slip * 0.1;
    this.driver.rotation.y = -slip * 0.5;
    this.driver.rotation.x = -s * 0.3 + (this.grounded ? 0 : -0.12);
  }
}
