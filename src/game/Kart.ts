import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FX, KART } from '../config/tuning';
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
// Scratch vectors for the slipstream cone test — no per-step allocs.
const _draftRel = new THREE.Vector3();
const _draftFwdA = new THREE.Vector3();
const _draftFwdB = new THREE.Vector3();
// Scratch vectors for update()'s hot path — the sim runs this at 120 Hz
// across 4 karts; clone()s here were a steady GC feed.
const _fwd = new THREE.Vector3();
const _fwd2 = new THREE.Vector3();
const _fwd3 = new THREE.Vector3();
const _rt = new THREE.Vector3();
const _lat = new THREE.Vector3();
const _nrm = new THREE.Vector3();
const _ptmp = new THREE.Vector3();
const _rear = new THREE.Vector3();
const _constrainOut = { lateral: 0, clamped: false, index: 0 };

export class Kart {
  readonly group = new THREE.Group();
  readonly vfx: Fx;

  position = new THREE.Vector3();
  heading = 0; // rad; 0 faces -Z (ADR-002)
  velocity = new THREE.Vector3();

  driftDir = 0; // -1/0/+1 (locked while drifting)
  driftCharge = 0;
  boostTimer = 0;
  /** Slipstream burst remaining (s) — the drafting payoff. QA/VFX read it:
   *  >0 means the wind-burst is on (extra top speed + streak emission). */
  slipstreamT = 0;
  /** Seconds currently sustained inside a leading kart's wake cone —
   *  reaches KART.draftTime → the burst fires. Resets when the cone breaks. */
  draftT = 0;
  /** Total slipstream bursts fired (QA counter). */
  draftsFired = 0;
  /** The kart this one last drafted — per-pair cooldown target. */
  private draftLeader: Kart | null = null;
  private draftCdUntil = -1; // sim-time the pair cooldown ends
  /** Drift-entry hop arc timer (<0 = idle). Visual only — drives a
   *  group-Y offset in syncVisual, never touches velocity/position.y. */
  private hopT = -1;
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
  private glbWheels: { node: THREE.Object3D; front: boolean; baseY: number }[] = [];
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
      if (/^wheel_(fl|fr|rl|rr)$/.test(o.name)) {
        // 'YXZ' so the spin (local X axle) applies before the steer yaw —
        // 'XYZ' would roll the already-yawed wheel about the kart axis.
        o.rotation.order = 'YXZ';
        this.glbWheels.push({
          node: o,
          front: o.name === 'wheel_fl' || o.name === 'wheel_fr',
          baseY: o.rotation.y,
        });
      }
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    for (const o of this.proceduralBody) o.visible = false;
    for (const w of this.wheels) w.visible = false;
    this.mergeStaticMeshes(model);
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

  /**
   * Team tint that keeps the authored material contrast. The old
   * `lerp(tint, 0.55)` dragged EVERY panel to the same mid-tone — kart-b's
   * gunmetal/navy/orange stack collapsed into one orange blob, which is why
   * the rivals read as flat boxes (critic VIS-DEEP). Now: chromatic panels
   * rotate hue the short way toward the team color (lightness untouched —
   * darks stay dark, accents stay bright), plus a light 16% value-lerp so
   * achromatic trim also takes a hue cast. Emitters/rubber/glazing keep
   * their authored color — tinting a glow mat just browns the neon.
   */
  private tintModel(root: THREE.Object3D): void {
    const cache = new Map<THREE.Material, THREE.Material>();
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const cloned = mats.map((m) => {
        const hit = cache.get(m);
        if (hit) return hit;
        const c = m.clone();
        if ('color' in c && !/glow|tire|visor|windshield|glass|lens/i.test(c.name ?? '')) {
          Kart.hueShift(c.color as THREE.Color, this.tint!);
        }
        cache.set(m, c);
        return c;
      });
      o.material = Array.isArray(o.material) ? cloned : cloned[0];
    });
  }

  /**
   * Merge every mesh that never animates — bakes each static part's
   * transform into per-material geometries so a ~125-mesh GLB renders as
   * ~15 draws instead of ~125 draws ×2 passes. Animated nodes (wheels,
   * limbs, head, eyes — the only nodes update() touches) keep their own
   * transforms; static descendants of a hot node merge relative to it so
   * they ride its rotation. Runs BEFORE gloss/tint so merged meshes share
   * the GLB's shared material instances and the per-kart clone count drops
   * from ~120 to ~15.
   */
  private mergeStaticMeshes(root: THREE.Object3D): void {
    root.updateWorldMatrix(true, true);
    // Buckets: merge-space container × material × attribute signature.
    const buckets = new Map<THREE.Object3D, Map<THREE.Material, Map<string, THREE.Mesh[]>>>();
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o === root) return;
      if (Array.isArray(o.material)) return; // grouped materials: rare — skip
      // Nearest hot ancestor-or-self under root picks the merge space.
      let hot: THREE.Object3D | null = null;
      for (let n: THREE.Object3D | null = o; n && n !== root; n = n.parent) {
        if (Kart.HOT_NODE.test(n.name)) {
          hot = n;
          break;
        }
      }
      if (hot === o) return; // the node itself animates — leave it alone
      const container = hot ?? root;
      const g = o.geometry;
      const sig =
        Object.keys(g.attributes).sort().join(',') +
        (g.index ? '+i' : '') +
        Object.keys(g.morphAttributes).sort().join(',');
      let matMap = buckets.get(container);
      if (!matMap) buckets.set(container, (matMap = new Map()));
      let sigMap = matMap.get(o.material);
      if (!sigMap) matMap.set(o.material, (sigMap = new Map()));
      let list = sigMap.get(sig);
      if (!list) sigMap.set(sig, (list = []));
      list.push(o);
    });
    const inv = new THREE.Matrix4();
    const rel = new THREE.Matrix4();
    const merged = new Set<THREE.Mesh>();
    for (const [container, matMap] of buckets) {
      inv.copy(container.matrixWorld).invert();
      for (const [mat, sigMap] of matMap) {
        for (const meshes of sigMap.values()) {
          if (meshes.length < 2) continue; // single mesh — nothing to save
          const geos = meshes.map((m) => {
            const g = m.geometry.clone();
            g.applyMatrix4(rel.copy(inv).multiply(m.matrixWorld));
            return g;
          });
          // mergeGeometries needs index parity across the bucket.
          const norm = geos.some((g) => !g.index)
            ? geos.map((g) => (g.index ? g.toNonIndexed() : g))
            : geos;
          const geo = mergeGeometries(norm, false);
          if (!geo) continue; // parity slipped through — keep originals
          const mesh = new THREE.Mesh(geo, mat);
          mesh.name = 'merged_' + (mat.name || 'mat');
          mesh.castShadow = true;
          mesh.receiveShadow = meshes[0].receiveShadow;
          container.add(mesh);
          for (const m of meshes) merged.add(m);
        }
      }
    }
    // Detach merged-away originals; dispose geometries nothing else uses.
    const stillUsed = new Set<THREE.BufferGeometry>();
    for (const m of merged) m.parent?.remove(m);
    root.traverse((o) => {
      if (o instanceof THREE.Mesh && !merged.has(o)) stillUsed.add(o.geometry);
    });
    for (const m of merged) {
      if (!stillUsed.has(m.geometry)) m.geometry.dispose();
    }
  }

  /** Nodes whose local transform animates at runtime — merge spaces. */
  private static readonly HOT_NODE =
    /^(wheel_(fl|fr|rl|rr)|arm_l|arm_r|head|leg_l|leg_r|eye_l|eye_r)$/;

  private static hueShift(col: THREE.Color, tint: THREE.Color): void {
    const hsl = { h: 0, s: 0, l: 0 };
    col.getHSL(hsl);
    const th = { h: 0, s: 0, l: 0 };
    tint.getHSL(th);
    if (hsl.s > 0.05) {
      let dh = th.h - hsl.h;
      dh -= Math.round(dh); // shortest arc around the wheel
      col.setHSL(
        THREE.MathUtils.euclideanModulo(hsl.h + dh * 0.62, 1),
        THREE.MathUtils.clamp(hsl.s + (th.s - hsl.s) * 0.25, 0, 1),
        hsl.l,
      );
    }
    col.lerp(tint, 0.16);
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
        this.mergeStaticMeshes(bot);
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
        // Driver identity (VIS-DEEP): team-tint the shell panels — same
        // hue-shift as the chassis — so the rival bots carry their kart's
        // color on collar/cuffs/stripes. Glows + visor keep authored color.
        if (this.tint) this.tintModel(bot);
        // The third rival drives the same bot-A shell as the player — add
        // a swept team-color crest fin over the dome so it isn't a driver
        // clone (bots B/C are distinct authored shells). Parented to the
        // head node so it rides the look-around/celebration motion.
        if (this.tint && this.botUrl === botGlbUrl && headNode) {
          const crest = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 0.14, 0.32),
            new THREE.MeshStandardMaterial({
              color: new THREE.Color(this.tint).lerp(new THREE.Color(0xffffff), 0.2),
              emissive: new THREE.Color(this.tint),
              emissiveIntensity: 0.4,
              flatShading: true,
              roughness: 0.5,
            }),
          );
          // Half-embedded in the dome top, swept back behind the antenna.
          crest.position.set(0, 0.46, 0.18);
          crest.rotation.x = 0.3;
          headNode.add(crest);
        }
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

  /** Bumped on every reset/teleport — observers diff it to re-seed their
   *  transition memory instead of firing phantom cues (critic20 D1-D4). */
  resetCount = 0;

  reset(position: THREE.Vector3, heading: number): void {
    this.position.copy(position);
    this.heading = heading;
    this.velocity.set(0, 0, 0);
    this.vy = 0;
    this.airTime = 0;
    this.grounded = true;
    this.resetCount++;
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
    this.spinUntil = 0;
    this.isSpinning = false;
    this.celebrating = false;
    this.slipstreamT = 0;
    this.draftT = 0;
    this.draftsFired = 0;
    this.draftLeader = null;
    this.draftCdUntil = -1;
    this.hopT = -1;
    this.trackIdx = -1; // teleported — re-anchor globally on next update
    this.syncVisual();
  }

  update(
    dt: number,
    input: ControlState,
    track: Track,
    simTime: number,
    traffic?: Kart[],
  ): void {
    this.lastSimTime = simTime;
    this.isSpinning = simTime < this.spinUntil;
    if (this.trackIdx < 0) this.trackIdx = track.nearestIndex(this.position);
    // Drift-entry hop: ticked up here so a mid-hop spin-out still lands
    // (and squashes) instead of freezing the kart at apex.
    if (this.hopT >= 0) {
      this.hopT -= dt;
      if (this.hopT < 0) {
        this.impactSquash = Math.max(this.impactSquash, KART.driftHopSquash);
        // Hop touchdown — a light dust puff sells the kart settling back.
        this.vfx.landingDust(this.position, this.velocity, 0.25);
      }
    }
    // Spin-out (item hits): yaw whips freely, controls dead, velocity decays.
    if (this.isSpinning) {
      this.heading += 11 * dt;
      this.velocity.multiplyScalar(1 - Math.min(1, 3.2 * dt));
      this.driftDir = 0;
      this.driftCharge = 0;
      this.slipstreamT = 0; // getting tagged kills the draft burst too
      this.draftT = 0;
      this.position.addScaledVector(this.velocity, dt);
      this.trackIdx = track.constrain(this.position, this.trackIdx, _constrainOut).index;
      const gy = track.heightAt(this.position, this.trackIdx);
      if (this.position.y < gy) this.position.y = gy;
      this.syncVisual();
      return;
    }
    const fwd = _fwd.set(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    const fwdSpeed = this.velocity.dot(fwd);
    // Pedal work for the driver rig: right leg presses with throttle,
    // left with brake (CHAR: static legs were the last rig gap).
    this.pedalR = input.throttle;
    this.pedalL = input.brake;

    // --- throttle / brake ---
    const boosting = this.boostTimer > 0;
    const drafting = this.slipstreamT > 0; // wake-burst pays like a boost
    const topSpeed =
      KART.maxSpeed * (1 + this.paceAssist) +
      (boosting ? KART.boostSpeed : 0) +
      (drafting ? KART.draftBoostSpeed : 0);
    if (input.throttle > 0) {
      // Launch surge: extra kick off the line, tapering out by launchSpeed.
      const surge =
        fwdSpeed < KART.launchSpeed ? THREE.MathUtils.lerp(KART.launchMul, 1, fwdSpeed / KART.launchSpeed) : 1;
      const a =
        (boosting || drafting ? KART.boostAccel : KART.accel) *
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
    const lateral = _lat.copy(this.velocity).addScaledVector(fwd, -this.velocity.dot(fwd));
    let newFwd = this.velocity.dot(fwd);
    if (newFwd > topSpeed) newFwd = Math.max(topSpeed, newFwd - KART.overSpeedDecay * dt);
    newFwd = Math.max(newFwd, -KART.reverseSpeed);
    this.velocity.copy(lateral).addScaledVector(fwd, newFwd);

    // --- drift state machine ---
    const drifting = this.driftDir !== 0;
    if (!drifting && input.drift && input.steer !== 0 && fwdSpeed > KART.driftEnterSpeed) {
      this.driftDir = Math.sign(input.steer);
      this.driftCharge = 0;
      // MK drift-entry hop: the kart visibly pops as the slide starts.
      // Visual-only (hopT drives a group-Y offset in syncVisual).
      if (this.grounded) this.hopT = KART.driftHopTime;
    }
    if (drifting) {
      // Sustain needs real forward speed (kills parking-lot donuts) and the
      // drift button. Charge only accrues while genuinely moving + sliding.
      const canSustain = input.drift && fwdSpeed > KART.driftSustainSpeed;
      if (canSustain) {
        if (input.brake === 0 && fwdSpeed > KART.driftChargeSpeed && Math.abs(this.slipAngle) > 0.1) {
          const top = KART.driftChargeTier[KART.driftChargeTier.length - 1];
          this.driftCharge = Math.min(this.driftCharge + dt, top + 0.3);
        }
      } else {
        // Release → mini-turbo for the highest tier charged (3 tiers:
        // blue → orange → violet ultra, longest sweeper holds only).
        const tiers = KART.driftChargeTier;
        let tier = -1;
        for (let t = tiers.length - 1; t >= 0; t--) {
          if (this.driftCharge >= tiers[t]) {
            tier = t;
            break;
          }
        }
        if (tier >= 0) {
          this.boostTimer = Math.max(this.boostTimer, KART.boostTime[tier]);
          // Mini-turbo release: one-shot tailpipe burst in the tier color.
          const pipe = _ptmp
            .copy(this.position)
            .addScaledVector(fwd, -(KART.length / 2 - 0.55));
          pipe.y = this.position.y + 0.5;
          this.vfx.turboBurst(pipe, this.velocity, tier);
        }
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
        ? 0.4 * (1 - THREE.MathUtils.smoothstep(speedAbs, KART.steerMinSpeed * 0.6, 6))
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
    const fwd2 = _fwd2.set(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    const fAmt = this.velocity.dot(fwd2);
    const lDir = _lat.copy(this.velocity).addScaledVector(fwd2, -fAmt);
    const lAmt = lDir.length();
    const lKeep = Math.exp(-grip * dt);
    if (lAmt > 1e-5) lDir.normalize();
    this.velocity.copy(fwd2.multiplyScalar(fAmt)).addScaledVector(lDir, lAmt * lKeep);

    // --- walls: contact-episode model ---
    // Impact penalty fires once per wall ENTRY (scaled by impact speed), not
    // per step — sustained contact slides with a light scrub (critic tar-pit).
    this.position.addScaledVector(this.velocity, dt);
    const c = track.constrain(this.position, this.trackIdx, _constrainOut);
    this.trackIdx = c.index;
    if (c.clamped) {
      // Inward wall normal from the TRACK FRAME — not the position delta.
      // A kart parked exactly on the clamp produces before−after ≈ 0, so a
      // delta-derived normal vanished and the whole response was skipped
      // while throttle kept integrating: nose-in read top speed/FOV/revs,
      // defeated the stuck hint, and stored a free launch (critic4 HIGH).
      const normal = _nrm.copy(track.leftAt(c.index)).multiplyScalar(-Math.sign(c.lateral));
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
        this.vfx.landingDust(
          _ptmp.copy(this.position).setY(groundY),
          this.velocity,
          Math.min(1, this.airTime * 0.5),
        );
      }
      this.airTime = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
      this.airTime += dt;
    }
    // Slope gravity (grounded only): uphill bleeds speed, downhill adds it.
    const fwdE = _fwd3.set(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    const hA = track.heightAt(_ptmp.copy(this.position).addScaledVector(fwdE, 1.4), this.trackIdx);
    const hB = track.heightAt(_ptmp.copy(this.position).addScaledVector(fwdE, -1.4), this.trackIdx);
    this.slopePitch = Math.atan2(hA - hB, 2.8);
    if (this.grounded) {
      this.velocity.addScaledVector(fwdE, -Math.sin(this.slopePitch) * KART.slopeForce * dt);
    }
    const rE = _rt.set(-fwdE.z, 0, fwdE.x);
    const hR = track.heightAt(_ptmp.copy(this.position).addScaledVector(rE, 0.9), this.trackIdx);
    const hL = track.heightAt(_ptmp.copy(this.position).addScaledVector(rE, -0.9), this.trackIdx);
    this.slopeRoll = Math.atan2(hR - hL, 1.8);

    // Actual slip angle (velocity vs heading) drives the drift visual.
    const fAmt2 = this.velocity.dot(fwdE);
    const lat = _lat.copy(this.velocity).addScaledVector(fwdE, -fAmt2);
    const latSigned = lat.dot(rE);
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
          _ptmp.copy(this.position).setY(this.position.y + 0.15),
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
    // heading may have been re-clamped by the driftMaxSlip block above —
    // recompute rather than reusing fwdE/rE (they predate the clamp).
    const fwdVfx = _fwd3.set(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    const right2 = _rt.set(-fwdVfx.z, 0, fwdVfx.x);
    const rearC = _rear.copy(this.position).addScaledVector(fwdVfx, -(KART.length / 2 - 0.55)).setY(0.25);
    if (this.driftDir !== 0) {
      // Sparks at both rear wheels — tier color is the player's charge readout.
      const wx = KART.width / 2 + 0.08;
      if (Math.random() < 60 * dt) {
        this.vfx.driftSparks(_ptmp.copy(rearC).addScaledVector(right2, -wx), this.velocity, this.driftCharge);
        this.vfx.driftSparks(_ptmp.copy(rearC).addScaledVector(right2, wx), this.velocity, this.driftCharge);
      }
    }
    if (this.boostTimer > 0) {
      if (Math.random() < 90 * dt) this.vfx.boostFlame(_ptmp.copy(rearC).setY(0.55), this.velocity);
    }
    if (c.clamped && Math.random() < 30 * dt) {
      const inward = _nrm.copy(track.leftAt(c.index)).multiplyScalar(-Math.sign(c.lateral)).setY(0);
      this.vfx.wallChips(_ptmp.copy(this.position).setY(0.3), inward);
    }
    // Spin-out stars — orbiting four-point stars while controls are dead.
    if (this.isSpinning) {
      const a = this.lastSimTime * 15 + this.driverPhase;
      this.vfx.spinStar(this.position, a);
      this.vfx.spinStar(this.position, a + Math.PI);
    }

    // --- slipstream/drafting ---
    this.slipstreamT = Math.max(0, this.slipstreamT - dt);
    this.updateDraft(dt, simTime, traffic);
    if (this.slipstreamT > 0 && Math.random() < FX.slipstreamRate * dt) {
      // MK wind-tunnel speed-lines streaming past the kart (VFX-DEEP).
      this.vfx.slipstream(this.position, this.velocity, right2);
    }

    this.syncVisual();
  }

  /** Slipstream (MK8 drafting): sustained time inside a leading kart's
   *  wake cone charges a speed burst. The cone is measured in the LEADER's
   *  frame — draftGapMin..draftGapMax metres behind their bumper, |lat|
   *  within draftLat, both karts above draftMinSpeed running roughly the
   *  same direction. A fired burst locks that pair out for draftCooldown
   *  seconds; drafting a different leader stays legal. Breaking the cone
   *  resets the charge outright. */
  private updateDraft(dt: number, simTime: number, traffic?: Kart[]): void {
    if (!traffic) {
      this.draftT = 0;
      return;
    }
    let leader: Kart | null = null;
    if (this.forwardSpeed > KART.draftMinSpeed) {
      _draftFwdA.set(-Math.sin(this.heading), 0, -Math.cos(this.heading));
      for (const other of traffic) {
        if (other === this || other.isSpinning) continue;
        if (other.forwardSpeed < KART.draftMinSpeed) continue;
        _draftFwdB.set(-Math.sin(other.heading), 0, -Math.cos(other.heading));
        if (_draftFwdA.dot(_draftFwdB) < KART.draftHeadingCos) continue;
        _draftRel.copy(this.position).sub(other.position).setY(0);
        const gap = -_draftRel.dot(_draftFwdB);
        if (gap < KART.draftGapMin || gap > KART.draftGapMax) continue;
        const lat = _draftRel.x * -_draftFwdB.z + _draftRel.z * _draftFwdB.x; // · right(B)
        if (Math.abs(lat) > KART.draftLat) continue;
        if (other === this.draftLeader && simTime < this.draftCdUntil) continue;
        leader = other;
        break;
      }
    }
    if (leader) {
      this.draftT += dt;
      if (this.draftT >= KART.draftTime) {
        this.slipstreamT = KART.draftBoostTime;
        this.draftsFired++;
        this.draftLeader = leader;
        this.draftCdUntil = simTime + KART.draftCooldown;
        this.draftT = 0;
      }
    } else {
      this.draftT = 0;
    }
  }

  private syncVisual(): void {
    this.group.position.copy(this.position);
    // Drift-entry hop: sin-arc lift of the whole kart (~0.3 m apex over
    // driftHopTime). Purely visual — position.y/velocity are untouched;
    // landing feeds the impact-squash channel for the settle.
    if (this.hopT >= 0) {
      const k = Math.min(1, 1 - this.hopT / KART.driftHopTime);
      this.group.position.y += Math.sin(k * Math.PI) * KART.driftHopHeight;
    }
    this.group.rotation.order = 'YXZ'; // yaw-dominant: pitch/roll after heading
    this.group.rotation.y = this.heading;
    // Pitch/roll the whole kart to the road grade — sells the elevation.
    this.group.rotation.x = this.slopePitch * 0.7;
    this.group.rotation.z = -this.slopeRoll * 0.6;
    this.wheelSpin += (this.forwardSpeed / KART.wheelRadius) * this.lastDt;
    for (const w of this.wheels) w.rotation.x = this.wheelSpin;
    for (const w of this.glbWheels) {
      w.node.rotation.x = this.wheelSpin;
      // Front wheels also take the steer yaw — same visual lock as the
      // procedural frontAxle below (was spin-only: GLB rivals steered
      // with dead-straight front wheels, critic VIS-DEEP).
      if (w.front) w.node.rotation.y = w.baseY - this.steerVisual * 0.45;
    }
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
