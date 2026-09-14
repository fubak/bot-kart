import * as THREE from 'three';
import { KART } from '../config/tuning';
import { TEX, glowTexture, starTexture } from '../core/Textures';

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
}

type EmitOpts = Partial<Particle> & {
  ttl: number;
  jitter?: number;  // positional scatter radius
  vjitter?: number; // velocity scatter
  alpha?: number;   // peak opacity (maps onto Particle.a)
};

const SPARK_CAP = 640;
const SMOKE_CAP = 448;

export class Fx {
  readonly object = new THREE.Group();
  private readonly spark = new Pool(SPARK_CAP, glowTexture(), THREE.AdditiveBlending);
  private readonly smoke = new Pool(SMOKE_CAP, TEX.smoke(), THREE.NormalBlending, 1);
  private readonly star = new Pool(96, starTexture(), THREE.AdditiveBlending);

  constructor() {
    this.object.add(this.spark.mesh, this.smoke.mesh, this.star.mesh);
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
      rot: Math.random() * 6.28, rotVel: o.rotVel ?? 0,
      fadeIn: o.fadeIn ?? 0,
    });
  }

  // ---------- kart feedback ----------

  /** Drift sparks at a wheel contact patch; color encodes charge tier. */
  driftSparks(pos: THREE.Vector3, vel: THREE.Vector3, charge: number): void {
    const tier1 = KART.driftChargeTier[0];
    const tier2 = KART.driftChargeTier[1];
    const color =
      charge >= tier2 ? new THREE.Color(0x3fd8ff) :
      charge >= tier1 ? new THREE.Color(0xffa028) :
      new THREE.Color(0x9a9a9a);
    const rate = charge >= tier2 ? 3 : charge >= tier1 ? 2 : 1;
    for (let i = 0; i < rate; i++) {
      const v = vel.clone().multiplyScalar(-0.25).setY(1.4);
      this.s(this.spark, pos, v, color, {
        ttl: 0.3 + Math.random() * 0.22, drag: 3, gravity: -15,
        s0: 0.34, s1: 0.1, jitter: 0.3, vjitter: 2.4,
      });
    }
    // Tire smoke while drifting — grey-white puffs, tinted by charge.
    if (Math.random() < 0.5) {
      const sc = charge >= tier1 ? color.clone().lerp(new THREE.Color(0xffffff), 0.55)
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

  update(dt: number): void {
    this.spark.update(dt);
    this.smoke.update(dt);
    this.star.update(dt);
  }

  dispose(): void {
    this.spark.dispose();
    this.smoke.dispose();
    this.star.dispose();
  }
}
