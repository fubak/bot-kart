import * as THREE from 'three';
import { KART } from '../config/tuning';

// Pooled world-space particle system for kart feedback: drift sparks that
// telegraph mini-turbo charge tier (grey → amber → cyan), boost exhaust
// bursts, and wall-grind chips. Additive blending: fading color to black
// reads as fade-out without per-particle alpha.

const MAX = 320;

interface Particle {
  life: number;
  ttl: number;
  px: number; py: number; pz: number;
  vx: number; vy: number; vz: number;
  r: number; g: number; b: number;
  drag: number;
  gravity: number;
}

export class KartVfx {
  readonly object: THREE.Points;
  private readonly geo = new THREE.BufferGeometry();
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly pool: Particle[] = [];
  private cursor = 0;

  constructor() {
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    for (let i = 0; i < MAX; i++) {
      this.pool.push({ life: 0, ttl: 1, px: 0, py: -100, pz: 0, vx: 0, vy: 0, vz: 0, r: 0, g: 0, b: 0, drag: 0, gravity: 0 });
      this.pos[i * 3 + 1] = -100;
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.32,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    this.object = new THREE.Points(this.geo, mat);
    this.object.frustumCulled = false;
  }

  emit(
    p: THREE.Vector3,
    v: THREE.Vector3,
    color: THREE.Color,
    ttl: number,
    drag = 2,
    gravity = -9,
    jitter = 0.6,
  ): void {
    const pt = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % MAX;
    pt.life = 0;
    pt.ttl = ttl;
    pt.px = p.x + (Math.random() - 0.5) * jitter;
    pt.py = p.y + (Math.random() - 0.5) * jitter * 0.4;
    pt.pz = p.z + (Math.random() - 0.5) * jitter;
    pt.vx = v.x + (Math.random() - 0.5) * 2;
    pt.vy = v.y + Math.random() * 2;
    pt.vz = v.z + (Math.random() - 0.5) * 2;
    pt.r = color.r; pt.g = color.g; pt.b = color.b;
    pt.drag = drag;
    pt.gravity = gravity;
  }

  /** Drift sparks at a wheel contact patch; color encodes charge tier. */
  driftSparks(pos: THREE.Vector3, vel: THREE.Vector3, charge: number): void {
    const tier1 = KART.driftChargeTier[0];
    const tier2 = KART.driftChargeTier[1];
    const color =
      charge >= tier2 ? new THREE.Color(0x3fd8ff) :   // tier 2: cyan
      charge >= tier1 ? new THREE.Color(0xffa028) :   // tier 1: amber
      new THREE.Color(0x9a9a9a);                       // charging: grey
    const rate = charge >= tier2 ? 3 : charge >= tier1 ? 2 : 1;
    for (let i = 0; i < rate; i++) {
      const v = vel.clone().multiplyScalar(-0.25).setY(1.2);
      this.emit(pos, v, color, 0.35 + Math.random() * 0.25, 3, -14, 0.3);
    }
  }

  /** Boost exhaust burst — hot flame plume at the tailpipe. */
  boostFlame(pos: THREE.Vector3, vel: THREE.Vector3): void {
    const color = Math.random() < 0.6
      ? new THREE.Color(0x3fd8ff)
      : new THREE.Color(0xff7a20);
    const v = vel.clone().multiplyScalar(-0.4).setY(0.8);
    this.emit(pos, v, color, 0.28 + Math.random() * 0.15, 2.5, 2, 0.25);
  }

  /** Finish celebration — multi-colored confetti fountain over the kart. */
  confetti(pos: THREE.Vector3): void {
    const palette = [0xff4a6a, 0x40c8ff, 0xffd54a, 0x7aff6a, 0xc07aff];
    for (let i = 0; i < 26; i++) {
      const c = new THREE.Color(palette[i % palette.length]);
      const v = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        7 + Math.random() * 5,
        (Math.random() - 0.5) * 6,
      );
      this.emit(pos, v, c, 1.2 + Math.random() * 0.8, 1.2, -12, 1.4);
    }
  }

  /** Wall-grind chips — pale debris kicked off the barrier. */
  wallChips(pos: THREE.Vector3, inward: THREE.Vector3): void {
    const v = inward.clone().multiplyScalar(3).setY(2);
    this.emit(pos, v, new THREE.Color(0xd8d0c0), 0.3, 2, -16, 0.2);
  }

  update(dt: number): void {
    for (let i = 0; i < MAX; i++) {
      const pt = this.pool[i];
      if (pt.life >= pt.ttl) {
        if (this.pos[i * 3 + 1] > -90) {
          this.pos[i * 3 + 1] = -100;
          this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0;
        }
        continue;
      }
      pt.life += dt;
      const damp = Math.exp(-pt.drag * dt);
      pt.vx *= damp; pt.vz *= damp;
      pt.vy = pt.vy * damp - pt.gravity * dt;
      pt.px += pt.vx * dt; pt.py += pt.vy * dt; pt.pz += pt.vz * dt;
      const fade = 1 - pt.life / pt.ttl;
      this.pos[i * 3] = pt.px;
      this.pos[i * 3 + 1] = pt.py;
      this.pos[i * 3 + 2] = pt.pz;
      this.col[i * 3] = pt.r * fade;
      this.col[i * 3 + 1] = pt.g * fade;
      this.col[i * 3 + 2] = pt.b * fade;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}
