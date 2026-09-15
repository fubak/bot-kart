import * as THREE from 'three';
import { FX, KART } from '../config/tuning';
import { TEX, glowTexture, starTexture, streakTexture } from '../core/Textures';

// Shared world-space particle system. Two instanced billboard pools —
// 'spark' (additive: sparks, boost flame, confetti, pickup glints,
// explosion flash) and 'smoke' (alpha-blended soft puffs: tire smoke,
// gravel dust, exhaust, explosion smoke). One draw call per pool —
// replaces the per-kart Points systems (4 draws) and adds real
// size/rotation/alpha animation per particle.

const VERT = /* glsl */ `
  attribute vec3 offset;
  attribute vec4 tint;
  attribute vec2 sizeRot; // x: size, y: rotation
  varying vec4 vTint;
  varying vec2 vUv;
  void main() {
    vTint = tint;
    vUv = uv;
    float c = cos(sizeRot.y), s = sin(sizeRot.y);
    vec2 p = (position.xy * sizeRot.x);
    p = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 world = offset + right * p.x + up * p.y;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform float lumaAlpha; // 1 = texture luminance IS the alpha (white-on-black sprites)
  varying vec4 vTint;
  varying vec2 vUv;
  void main() {
    vec4 t = texture2D(map, vUv);
    float a = mix(t.a, dot(t.rgb, vec3(0.299, 0.587, 0.114)), lumaAlpha);
    gl_FragColor = vec4(vTint.rgb * mix(t.rgb, vec3(1.0), lumaAlpha), vTint.a * a);
    if (gl_FragColor.a < 0.003) discard;
  }
`;

interface Particle {
  life: number;
  ttl: number;
  px: number; py: number; pz: number;
  vx: number; vy: number; vz: number;
  r: number; g: number; b: number; a: number;
  drag: number;
  gravity: number;
  s0: number; s1: number; // size start → end
  rot: number;
  rotVel: number;
  fadeIn: number; // fraction of ttl spent fading in
}

class Pool {
  readonly mesh: THREE.Mesh;
  private readonly pool: Particle[] = [];
  private cursor = 0;
  private readonly offsets: Float32Array;
  private readonly tints: Float32Array;
  private readonly sizeRots: Float32Array;
  private readonly geo: THREE.InstancedBufferGeometry;

  constructor(
    capacity: number,
    map: THREE.Texture,
    blending: THREE.Blending,
    lumaAlpha = 0,
  ) {
    const base = new THREE.PlaneGeometry(1, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = base.index;
    this.geo.attributes.position = base.attributes.position;
    this.geo.attributes.uv = base.attributes.uv;
    this.offsets = new Float32Array(capacity * 3);
    this.tints = new Float32Array(capacity * 4);
    this.sizeRots = new Float32Array(capacity * 2);
    this.offsets.fill(0);
    for (let i = 0; i < capacity; i++) this.offsets[i * 3 + 1] = -500;
    this.geo.setAttribute('offset', new THREE.InstancedBufferAttribute(this.offsets, 3));
    this.geo.setAttribute('tint', new THREE.InstancedBufferAttribute(this.tints, 4));
    this.geo.setAttribute('sizeRot', new THREE.InstancedBufferAttribute(this.sizeRots, 2));
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { map: { value: map }, lumaAlpha: { value: lumaAlpha } },
      transparent: true,
      depthWrite: false,
      blending,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10; // particles over world, under HUD
    for (let i = 0; i < capacity; i++) {
      this.pool.push({
        life: 1, ttl: 1, px: 0, py: -500, pz: 0, vx: 0, vy: 0, vz: 0,
        r: 1, g: 1, b: 1, a: 1, drag: 0, gravity: 0,
        s0: 0.5, s1: 0.5, rot: 0, rotVel: 0, fadeIn: 0,
      });
    }
  }

  emit(p: Particle): void {
    const t = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    Object.assign(t, p, { life: 0 });
  }

  update(dt: number): void {
    const n = this.pool.length;
    for (let i = 0; i < n; i++) {
      const pt = this.pool[i];
      if (pt.life >= pt.ttl) {
        if (this.offsets[i * 3 + 1] > -400) {
          this.offsets[i * 3 + 1] = -500;
          this.tints[i * 4 + 3] = 0;
        }
        continue;
      }
      pt.life += dt;
      const damp = Math.exp(-pt.drag * dt);
      pt.vx *= damp; pt.vz *= damp;
      pt.vy = pt.vy * damp - pt.gravity * dt;
      pt.px += pt.vx * dt; pt.py += pt.vy * dt; pt.pz += pt.vz * dt;
      const k = Math.min(pt.life / pt.ttl, 1);
      const fadeOut = 1 - k;
      const fadeIn = pt.fadeIn > 0 ? Math.min(pt.life / (pt.ttl * pt.fadeIn), 1) : 1;
      pt.rot += pt.rotVel * dt;
      this.offsets[i * 3] = pt.px;
      this.offsets[i * 3 + 1] = pt.py;
      this.offsets[i * 3 + 2] = pt.pz;
      this.tints[i * 4] = pt.r;
      this.tints[i * 4 + 1] = pt.g;
      this.tints[i * 4 + 2] = pt.b;
      this.tints[i * 4 + 3] = pt.a * fadeOut * fadeIn;
      this.sizeRots[i * 2] = pt.s0 + (pt.s1 - pt.s0) * k;
      this.sizeRots[i * 2 + 1] = pt.rot;
    }
    this.geo.attributes.offset.needsUpdate = true;
    this.geo.attributes.tint.needsUpdate = true;
    this.geo.attributes.sizeRot.needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }

  /** Live particle count — QA pool-utilization probe (O(cap), probe only). */
  live(): number {
    let n = 0;
    for (const pt of this.pool) if (pt.life < pt.ttl) n++;
    return n;
  }
}

type EmitOpts = Partial<Particle> & {
  ttl: number;
  jitter?: number;  // positional scatter radius
  vjitter?: number; // velocity scatter
  alpha?: number;   // peak opacity (maps onto Particle.a)
};

const SPARK_CAP = 640;
const SMOKE_CAP = 448;
// Speed-line pool (wave-20): slipstream streaks, pad-kick darts. Worst case
// 4 simultaneous bursts ≈ 150 live + pad fans (~20) — 224 keeps headroom.
const STREAK_CAP = 224;
// Star pool raised 96→128: roulette glints (~10/kart live) share it with
// spin-out stars (~77 live) — worst-case overlap ~110 < 128.
const STAR_CAP = 128;

// Module scratch — emitters run hot; no per-particle Vector3 allocs.
const _p = new THREE.Vector3();
const _v = new THREE.Vector3();
const _d = new THREE.Vector3();
const _f = new THREE.Vector3();
const _q = new THREE.Vector3(); // second NDC probe point for streak rotation

// Drift charge-tier palette: [uncharged, tier-1 blue, tier-2 orange,
// tier-3 violet ultra]. Shared instances — driftSparks reads, never mutates.
const TIER_COLORS = [
  new THREE.Color(0x9a9a9a),
  new THREE.Color(0x3fd8ff),
  new THREE.Color(0xffa028),
  new THREE.Color(0xd86aff),
];

export class Fx {
  readonly object = new THREE.Group();
  /** Camera used to rotate speed-line streaks into their screen-space
   *  velocity direction. Set once by Game after ChaseCamera exists. */
  camera?: THREE.Camera;
  private readonly spark = new Pool(SPARK_CAP, glowTexture(), THREE.AdditiveBlending);
  private readonly smoke = new Pool(SMOKE_CAP, TEX.smoke(), THREE.NormalBlending, 1);
  private readonly star = new Pool(STAR_CAP, starTexture(), THREE.AdditiveBlending);
  private readonly streak = new Pool(STREAK_CAP, streakTexture(), THREE.AdditiveBlending);
  private ambAcc = 0; // ambient emit accumulator (fractional particles)

  constructor() {
    this.object.add(this.spark.mesh, this.smoke.mesh, this.star.mesh, this.streak.mesh);
  }

  private s(
    pool: Pool,
    p: THREE.Vector3,
    v: THREE.Vector3,
    c: THREE.Color,
    o: EmitOpts,
  ): void {
    const j = o.jitter ?? 0.4;
    pool.emit({
      life: 0, ttl: o.ttl,
      px: p.x + (Math.random() - 0.5) * j,
      py: p.y + (Math.random() - 0.5) * j * 0.4,
      pz: p.z + (Math.random() - 0.5) * j,
      vx: v.x + (Math.random() - 0.5) * (o.vjitter ?? 1.6),
      vy: v.y + (Math.random() - 0.5) * (o.vjitter ?? 1.6) * 0.5,
      vz: v.z + (Math.random() - 0.5) * (o.vjitter ?? 1.6),
      r: c.r, g: c.g, b: c.b, a: o.alpha ?? 1,
      drag: o.drag ?? 2, gravity: o.gravity ?? -9,
      s0: o.s0 ?? 0.3, s1: o.s1 ?? o.s0 ?? 0.3,
      rot: o.rot ?? Math.random() * 6.28, rotVel: o.rotVel ?? 0,
      fadeIn: o.fadeIn ?? 0,
    });
  }

  // ---------- kart feedback ----------

  /** Drift sparks at a wheel contact patch; color encodes charge tier —
   *  blue → orange → violet for the three mini-turbo tiers. */
  driftSparks(pos: THREE.Vector3, vel: THREE.Vector3, charge: number): void {
    const tiers = KART.driftChargeTier;
    const color =
      charge >= tiers[2] ? TIER_COLORS[3] :
      charge >= tiers[1] ? TIER_COLORS[2] :
      charge >= tiers[0] ? TIER_COLORS[1] :
      TIER_COLORS[0];
    const rate = charge >= tiers[2] ? 4 : charge >= tiers[1] ? 3 : charge >= tiers[0] ? 2 : 1;
    for (let i = 0; i < rate; i++) {
      const v = vel.clone().multiplyScalar(-0.25).setY(1.4);
      this.s(this.spark, pos, v, color, {
        ttl: 0.3 + Math.random() * 0.22, drag: 3, gravity: -15,
        s0: 0.34, s1: 0.1, jitter: 0.3, vjitter: 2.4,
      });
    }
    // Tire smoke while drifting — grey-white puffs, tinted by charge.
    if (Math.random() < 0.5) {
      const sc = charge >= tiers[0] ? color.clone().lerp(new THREE.Color(0xffffff), 0.55)
        : new THREE.Color(0xcfd4da);
      const v = vel.clone().multiplyScalar(-0.12).setY(0.9);
      this.s(this.smoke, pos, v, sc, {
        ttl: 0.5 + Math.random() * 0.3, drag: 1.6, gravity: 1.5,
        s0: 0.35, s1: 1.15, alpha: 0.5, fadeIn: 0.15, jitter: 0.25,
        rotVel: (Math.random() - 0.5) * 3,
      });
    }
  }

  /** Boost exhaust burst — hot flame plume at the tailpipe. */
  boostFlame(pos: THREE.Vector3, vel: THREE.Vector3): void {
    const color = Math.random() < 0.6
      ? new THREE.Color(0x3fd8ff)
      : new THREE.Color(0xff7a20);
    const v = vel.clone().multiplyScalar(-0.45).setY(0.9);
    this.s(this.spark, pos, v, color, {
      ttl: 0.24 + Math.random() * 0.14, drag: 2.5, gravity: 2,
      s0: 0.5, s1: 0.12, jitter: 0.22, vjitter: 2,
    });
    if (Math.random() < 0.3) {
      const v2 = vel.clone().multiplyScalar(-0.2).setY(1.1);
      this.s(this.smoke, pos, v2, new THREE.Color(0x6a7078), {
        ttl: 0.5, drag: 1.5, gravity: 1.2,
        s0: 0.3, s1: 0.9, alpha: 0.35, fadeIn: 0.2, jitter: 0.15,
      });
    }
  }

  /** Idle/rev exhaust puff — countdown and standing starts. */
  exhaustPuff(pos: THREE.Vector3, vel: THREE.Vector3): void {
    const v = vel.clone().multiplyScalar(-0.15).setY(1.4);
    this.s(this.smoke, pos, v, new THREE.Color(0x8a9098), {
      ttl: 0.6 + Math.random() * 0.3, drag: 1.8, gravity: 1.8,
      s0: 0.22, s1: 0.85, alpha: 0.45, fadeIn: 0.15, jitter: 0.15,
      rotVel: (Math.random() - 0.5) * 2,
    });
  }

  /** Gravel/dirt dust kicked up on shortcut aprons. */
  dust(pos: THREE.Vector3, vel: THREE.Vector3, tint = 0xb0906a): void {
    const v = vel.clone().multiplyScalar(-0.2).setY(1.6);
    this.s(this.smoke, pos, v, new THREE.Color(tint), {
      ttl: 0.55 + Math.random() * 0.35, drag: 2.2, gravity: 0.8,
      s0: 0.4, s1: 1.5, alpha: 0.5, fadeIn: 0.12, jitter: 0.5,
      vjitter: 1.2, rotVel: (Math.random() - 0.5) * 2.5,
    });
  }

  /** Wall-grind chips — pale debris kicked off the barrier. */
  wallChips(pos: THREE.Vector3, inward: THREE.Vector3): void {
    const v = inward.clone().multiplyScalar(3).setY(2);
    this.s(this.spark, pos, v, new THREE.Color(0xd8d0c0), {
      ttl: 0.3, drag: 2, gravity: -16, s0: 0.28, s1: 0.08, jitter: 0.2,
    });
  }

  /** Finish celebration — multi-colored confetti fountain over the kart. */
  confetti(pos: THREE.Vector3): void {
    const palette = [0xff4a6a, 0x40c8ff, 0xffd54a, 0x7aff6a, 0xc07aff];
    for (let i = 0; i < 30; i++) {
      const c = new THREE.Color(palette[i % palette.length]);
      const v = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        7 + Math.random() * 5,
        (Math.random() - 0.5) * 6,
      );
      this.s(this.spark, pos, v, c, {
        ttl: 1.2 + Math.random() * 0.8, drag: 1.2, gravity: -12,
        s0: 0.22, s1: 0.22, jitter: 1.4, vjitter: 1.5,
        rotVel: (Math.random() - 0.5) * 10,
      });
    }
  }

  // ---------- item / world feedback ----------

  /** Item-box pickup — cyan sparkle ring + flash. */
  pickupSparkle(pos: THREE.Vector3): void {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a) * 4, 1.5, Math.sin(a) * 4);
      this.s(this.spark, pos, v, new THREE.Color(0x7be8ff), {
        ttl: 0.35, drag: 2.5, gravity: -2, s0: 0.4, s1: 0.1, jitter: 0.2,
      });
    }
    this.s(this.spark, pos, new THREE.Vector3(0, 1, 0), new THREE.Color(0xbfffff), {
      ttl: 0.22, drag: 0, gravity: 0, s0: 2.2, s1: 0.4, jitter: 0, vjitter: 0,
    });
  }

  /** Missile exhaust — smoke puff + occasional ember per call. */
  missileTrail(pos: THREE.Vector3, vel: THREE.Vector3): void {
    this.s(this.smoke, pos, vel.clone().multiplyScalar(-0.1).setY(0.4),
      new THREE.Color(0x9aa0a8), {
        ttl: 0.5 + Math.random() * 0.2, drag: 1.4, gravity: 0.6,
        s0: 0.3, s1: 0.95, alpha: 0.55, fadeIn: 0.1, jitter: 0.12,
        vjitter: 0.6,
      });
    if (Math.random() < 0.35) {
      this.s(this.spark, pos, vel.clone().multiplyScalar(-0.3),
        new THREE.Color(0xffa030), {
          ttl: 0.25, drag: 2, gravity: -4, s0: 0.3, s1: 0.08, jitter: 0.15,
        });
    }
  }

  /** Missile impact/fizzle — flash + radial sparks + smoke ring. */
  explosion(pos: THREE.Vector3): void {
    this.s(this.spark, pos, new THREE.Vector3(), new THREE.Color(0xfff0b0), {
      ttl: 0.16, drag: 0, gravity: 0, s0: 3.4, s1: 1, jitter: 0, vjitter: 0,
    });
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a) * 7, 2 + Math.random() * 4, Math.sin(a) * 7);
      this.s(this.spark, pos, v, new THREE.Color(i % 2 ? 0xff8030 : 0xffd040), {
        ttl: 0.4 + Math.random() * 0.2, drag: 2.4, gravity: -8,
        s0: 0.45, s1: 0.1, jitter: 0.3,
      });
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a) * 3.2, 1.2, Math.sin(a) * 3.2);
      this.s(this.smoke, pos, v, new THREE.Color(0x5a5e66), {
        ttl: 0.8 + Math.random() * 0.3, drag: 1.8, gravity: 0.9,
        s0: 0.6, s1: 2.1, alpha: 0.6, fadeIn: 0.1, jitter: 0.4,
      });
    }
  }

  /** Slick/hazard trigger splash — quick dark splat burst. */
  splat(pos: THREE.Vector3, color = 0x30263a): void {
    for (let i = 0; i < 8; i++) {
      const v = new THREE.Vector3(
        (Math.random() - 0.5) * 5, 2.5 + Math.random() * 2.5, (Math.random() - 0.5) * 5);
      this.s(this.smoke, pos, v, new THREE.Color(color), {
        ttl: 0.45, drag: 2, gravity: -14, s0: 0.35, s1: 0.5, alpha: 0.8,
        jitter: 0.3,
      });
    }
  }

  /** Spin-out stars — one orbiting burst call per frame while spinning. */
  spinStar(pos: THREE.Vector3, angle: number): void {
    const r = 1.05;
    const p = new THREE.Vector3(
      pos.x + Math.cos(angle) * r, pos.y + 1.15, pos.z + Math.sin(angle) * r);
    this.s(this.star, p, new THREE.Vector3(), new THREE.Color(0xffd94a), {
      ttl: 0.32, drag: 0, gravity: 0, s0: 0.5, s1: 0.42, jitter: 0.05,
      vjitter: 0.4, alpha: 0.95,
    });
  }

  // ---------- wave-20 VFX-DEEP emitters ----------

  /** Slipstream wind tunnel — elongated additive darts spawned ahead and
   *  on the flanks, swept backward past the kart at ~2-3× its speed. Each
   *  streak is rotated into its screen-space velocity direction so the
   *  burst reads as lines radiating past the camera, not floating dots.
   *  `right` = kart's right vector for lateral spawn/push. */
  slipstream(pos: THREE.Vector3, vel: THREE.Vector3, right: THREE.Vector3): void {
    const speed = vel.length();
    if (speed < 6) return;
    _f.copy(vel).multiplyScalar(1 / speed); // unit travel dir
    for (let i = 0; i < 3; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      // Spawn on a cylinder AROUND the kart axis — ≥2.2 m off-axis so a
      // streak never drifts straight down the camera lens into a soft
      // screen-filling blob; they sweep past at the frame periphery (MK8).
      const lat = side * (2.2 + Math.random() * 3.3);
      _p.copy(pos)
        .addScaledVector(_f, 2.5 + Math.random() * 6.5)
        .addScaledVector(right, lat);
      _p.y += 0.35 + Math.random() * 1.9;
      // Backward at 2-3× kart speed + a slight outward push — tunnel feel.
      _v.copy(vel).multiplyScalar(-(1.9 + Math.random() * 0.8))
        .addScaledVector(right, side * (0.7 + Math.random() * 1.1));
      // Rotate the streak so its long axis follows the APPARENT motion:
      // project p and p+vε to NDC — perspective divergence turns the
      // toward-camera stream into the MK radial-line fan. (A plain
      // view-space projection would read ~0 for head-on motion → dots.)
      let rot = 0;
      if (this.camera) {
        _q.copy(_p).project(this.camera);
        _d.copy(_v).multiplyScalar(0.05).add(_p).project(this.camera);
        rot = Math.atan2(_d.y - _q.y, _d.x - _q.x);
      }
      const c = Math.random() < 0.55 ? 0x9fe8ff : 0xe4f8ff;
      this.s(this.streak, _p, _v, new THREE.Color(c), {
        ttl: 0.24 + Math.random() * 0.14, drag: 0, gravity: 0,
        s0: 2.2 + Math.random() * 1.3, jitter: 0.1, vjitter: 0,
        rot, alpha: 0.9,
      });
    }
  }

  /** Mini-turbo release — one-shot ring + tailpipe jet in the released
   *  charge tier's color (blue/orange/violet). Fired only on drift-release
   *  boosts; pad/item boosts have their own cues. */
  turboBurst(pos: THREE.Vector3, vel: THREE.Vector3, tier: number): void {
    const c = TIER_COLORS[THREE.MathUtils.clamp(tier, 0, 2) + 1];
    // White core flash at the pipes.
    this.s(this.spark, pos, _v.copy(vel).multiplyScalar(0.15),
      new THREE.Color(0xffffff), {
        ttl: 0.2, drag: 0, gravity: 0, s0: 2.4, s1: 0.5,
        jitter: 0, vjitter: 0, alpha: 0.9,
      });
    // Expanding horizontal ring, carried a little by the kart's motion.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      _v.set(Math.cos(a) * 5.5, 0.9, Math.sin(a) * 5.5).addScaledVector(vel, 0.22);
      this.s(this.spark, pos, _v, c, {
        ttl: 0.3 + Math.random() * 0.12, drag: 2.6, gravity: -3,
        s0: 0.5, s1: 0.14, jitter: 0.15, vjitter: 0.8,
      });
    }
    // Backward jet — the exhaust flare that sells the kick.
    for (let i = 0; i < 5; i++) {
      _v.copy(vel).multiplyScalar(-0.55).setY(1.6);
      this.s(this.spark, pos, _v, c, {
        ttl: 0.3, drag: 2.2, gravity: -2, s0: 0.55, s1: 0.12,
        jitter: 0.2, vjitter: 2,
      });
    }
  }

  /** Touchdown dust — radial smoke ring scaled by impact intensity
   *  (0 = hop-landing puff, 1 = big airtime slam). */
  landingDust(pos: THREE.Vector3, vel: THREE.Vector3, intensity: number): void {
    const n = Math.round(6 + intensity * 10);
    const speed = 2.6 + intensity * 4.5;
    _p.copy(pos);
    _p.y += 0.12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      _v.set(Math.cos(a) * speed, 0.7 + intensity * 1.2, Math.sin(a) * speed)
        .addScaledVector(vel, 0.15);
      this.s(this.smoke, _p, _v, new THREE.Color(0xcfc4ae), {
        ttl: 0.5 + intensity * 0.4 + Math.random() * 0.2,
        drag: 2.8, gravity: 0.6,
        s0: 0.35, s1: 1.1 + intensity * 0.9, alpha: 0.45, fadeIn: 0.1,
        jitter: 0.4, rotVel: (Math.random() - 0.5) * 2,
      });
    }
    // Hard landings also kick a few grit chips for extra read.
    if (intensity >= 0.6) {
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * Math.PI * 2;
        _v.set(Math.cos(a) * 4, 2 + Math.random() * 1.5, Math.sin(a) * 4);
        this.s(this.spark, _p, _v, new THREE.Color(0xd8cfb8), {
          ttl: 0.3, drag: 2, gravity: -16, s0: 0.24, s1: 0.08, jitter: 0.3,
        });
      }
    }
  }

  /** Item-roulette glint — a small star sparkle cycling above the kart's
   *  roof, tinted by the icon currently shown in the slot. */
  rouletteGlint(pos: THREE.Vector3, color: THREE.Color): void {
    _p.set(pos.x, pos.y + 1.4 + Math.random() * 0.35, pos.z);
    _v.set((Math.random() - 0.5) * 0.6, 0.55, (Math.random() - 0.5) * 0.6);
    this.s(this.star, _p, _v, color, {
      ttl: 0.3 + Math.random() * 0.15, drag: 0, gravity: 0,
      s0: 0.32, s1: 0.14, jitter: 0.6, vjitter: 0.3,
      rotVel: 5, alpha: 0.9,
    });
  }

  /** Swap teleport — imploding ring of green sparks collapsing onto the
   *  kart point, then a central flash. Fired at both exchanged positions
   *  (each point is one kart's departure and the other's arrival). */
  teleportBurst(pos: THREE.Vector3): void {
    const c = new THREE.Color(0x7dff8a);
    const ttl = 0.32;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      _p.set(pos.x + Math.cos(a) * 1.5, pos.y + 0.25 + Math.random() * 0.85, pos.z + Math.sin(a) * 1.5);
      // Velocity aims at the kart's chest point → converges at ttl end.
      _v.set(pos.x - _p.x, pos.y + 0.65 - _p.y, pos.z - _p.z).multiplyScalar(1 / ttl);
      this.s(this.spark, _p, _v, c, {
        ttl, drag: 0, gravity: 0, s0: 0.34, s1: 0.1,
        jitter: 0.06, vjitter: 0.3, alpha: 0.95,
      });
    }
    this.s(this.spark, _p.set(pos.x, pos.y + 0.65, pos.z), _v.set(0, 1.5, 0),
      new THREE.Color(0xd8ffe0), {
        ttl: 0.22, drag: 0, gravity: 0, s0: 1.7, s1: 0.3,
        jitter: 0, vjitter: 0, alpha: 0.9,
      });
    // A few risers — re-materialize sparkle climbing the body.
    for (let i = 0; i < 4; i++) {
      _v.set((Math.random() - 0.5) * 0.8, 4 + Math.random() * 3, (Math.random() - 0.5) * 0.8);
      this.s(this.spark, _p, _v, c, {
        ttl: 0.35, drag: 0.8, gravity: -2, s0: 0.26, s1: 0.08, jitter: 0.5,
      });
    }
  }

  /** Respawn materialize — rising shimmer column + ground ring at the
   *  lakitu-style drop-in point. */
  materialize(pos: THREE.Vector3): void {
    const c = new THREE.Color(0x9fe8ff);
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.3 + Math.random() * 0.7;
      _p.set(pos.x + Math.cos(a) * r, pos.y + Math.random() * 0.4, pos.z + Math.sin(a) * r);
      _v.set(Math.cos(a) * 0.4, 3.5 + Math.random() * 3, Math.sin(a) * 0.4);
      this.s(this.spark, _p, _v, i % 3 ? c : new THREE.Color(0xffffff), {
        ttl: 0.45 + Math.random() * 0.25, drag: 1, gravity: -1.5,
        s0: 0.3, s1: 0.08, jitter: 0.1, vjitter: 0.6, alpha: 0.9,
      });
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      _v.set(Math.cos(a) * 3.5, 0.5, Math.sin(a) * 3.5);
      this.s(this.spark, pos, _v, c, {
        ttl: 0.3, drag: 3, gravity: -1, s0: 0.3, s1: 0.1, jitter: 0.15,
      });
    }
  }

  /** Boost-pad activation — green chevron kick: a forward-swept fan of
   *  streak darts + a flash at the pad contact. */
  padFlash(pos: THREE.Vector3, vel: THREE.Vector3): void {
    const c = new THREE.Color(0x30e8a0);
    const speed = Math.max(vel.length(), 1);
    _f.copy(vel).multiplyScalar(1 / speed); // unit travel dir
    this.s(this.spark, pos, _v.copy(vel).multiplyScalar(0.3), c, {
      ttl: 0.22, drag: 0, gravity: 0, s0: 1.9, s1: 0.5,
      jitter: 0.2, vjitter: 0.4, alpha: 0.9,
    });
    for (let i = 0; i < 10; i++) {
      const spread = i / 9 - 0.5; // -0.5..0.5 fan
      _p.copy(pos);
      _p.y += 0.25 + Math.random() * 0.4;
      _v.copy(_f).multiplyScalar(5 + Math.random() * 3)
        .addScaledVector(_d.set(-_f.z, 0, _f.x), spread * 6);
      _v.y = 0.8 + Math.random() * 1.2;
      // Rotate each dart along its apparent screen motion (see slipstream).
      let rot = 0;
      if (this.camera) {
        _q.copy(_p).project(this.camera);
        _d.copy(_v).multiplyScalar(0.05).add(_p).project(this.camera);
        rot = Math.atan2(_d.y - _q.y, _d.x - _q.x);
      }
      this.s(this.streak, _p, _v, c, {
        ttl: 0.3 + Math.random() * 0.1, drag: 0.5, gravity: -2,
        s0: 0.7 + Math.random() * 0.3, jitter: 0.1, vjitter: 0,
        rot, alpha: 0.85,
      });
    }
  }

  /** Ambient theme motes — a sparse ring of atmosphere drifting around the
   *  camera. PG: warm pollen motes (soft alpha). SR: rising dusk embers.
   *  NN: tiny cyan/magenta data-sparks. Rates from FX.ambientRate. */
  ambientTick(camPos: THREE.Vector3, trackIdx: number, dt: number): void {
    this.ambAcc += (FX.ambientRate[trackIdx] ?? 3) * dt;
    while (this.ambAcc >= 1) {
      this.ambAcc -= 1;
      const a = Math.random() * Math.PI * 2;
      const r = FX.ambientRing[0] + Math.random() * (FX.ambientRing[1] - FX.ambientRing[0]);
      _p.set(
        camPos.x + Math.cos(a) * r,
        camPos.y - 1 + Math.random() * 5,
        camPos.z + Math.sin(a) * r,
      );
      if (trackIdx === 1) {
        // SR embers — warm amber sparks drifting up on the ridge air.
        _v.set((Math.random() - 0.5) * 0.9, 0.3 + Math.random() * 0.4, (Math.random() - 0.5) * 0.9);
        const c = [0xffa040, 0xff7a30, 0xffc060][(Math.random() * 3) | 0];
        this.s(this.spark, _p, _v, new THREE.Color(c), {
          ttl: 2.5 + Math.random() * 1.5, drag: 0.2, gravity: -0.3,
          s0: 0.1 + Math.random() * 0.08, s1: 0.05, alpha: 0.65,
          fadeIn: 0.15, jitter: 1.2, vjitter: 0.3,
        });
      } else if (trackIdx === 2) {
        // NN data-motes — tiny neon flecks hanging in the night air.
        _v.set((Math.random() - 0.5) * 0.5, -0.05 + Math.random() * 0.2, (Math.random() - 0.5) * 0.5);
        const c = [0x46e8ff, 0xff4fd8, 0x9f6aff][(Math.random() * 3) | 0];
        this.s(this.spark, _p, _v, new THREE.Color(c), {
          ttl: 2 + Math.random() * 1.5, drag: 0.1, gravity: 0,
          s0: 0.08 + Math.random() * 0.07, alpha: 0.55,
          fadeIn: 0.2, jitter: 1.4, vjitter: 0.2,
        });
      } else {
        // PG pollen — big soft warm motes sinking through the meadow air.
        _v.set((Math.random() - 0.5) * 0.7, -0.12 - Math.random() * 0.15, (Math.random() - 0.5) * 0.7);
        const c = [0xe9f7c8, 0xfff3c4, 0xd8f0b0][(Math.random() * 3) | 0];
        this.s(this.smoke, _p, _v, new THREE.Color(c), {
          ttl: 3 + Math.random() * 1.5, drag: 0.1, gravity: 0,
          s0: 0.26, s1: 0.42, alpha: 0.3, fadeIn: 0.2,
          jitter: 1.4, vjitter: 0.2, rotVel: (Math.random() - 0.5) * 1.5,
        });
      }
    }
  }

  /** Live particle counts per pool — QA pool-utilization probe. */
  stats(): { spark: number; smoke: number; star: number; streak: number } {
    return {
      spark: this.spark.live(),
      smoke: this.smoke.live(),
      star: this.star.live(),
      streak: this.streak.live(),
    };
  }

  update(dt: number): void {
    this.streak.update(dt);
    this.spark.update(dt);
    this.smoke.update(dt);
    this.star.update(dt);
  }

  dispose(): void {
    this.spark.dispose();
    this.smoke.dispose();
    this.star.dispose();
    this.streak.dispose();
  }
}
