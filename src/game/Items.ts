import * as THREE from 'three';
import type { Kart } from './Kart';
import type { Track } from './Track';
import { AI, KART } from '../config/tuning';

// Item system: floating pickup boxes on the racing line + usable items.
// Wave-2 unit ITEM-001. Boxes respawn after collection; a kart holds one
// item at a time. Player triggers with Space (wired in Game); AI triggers
// via ControlState-style hook when implemented.
//
// Items (v1): BOOST — burst of speed; MISSILE — homes forward along the
// centerline and spins out the first kart it tags.

export type ItemKind = 'boost' | 'missile' | 'slick' | 'shield' | 'ink' | 'swap';

const BOX_RADIUS = 1.6; // pickup distance, m
const RESPAWN_S = 7;
const MISSILE_SPEED = 34; // m/s along track
const MISSILE_RANGE = 90; // m travelled before fizzle
const MISSILE_HIT = 2.4; // hit radius, m
const MISSILE_SLOW = 0.25; // victim keeps this fraction of velocity

interface Box {
  mesh: THREE.Mesh;
  idx: number;
  pos: THREE.Vector3;
  respawnAt: number; // sim-time; active when < simTime
}

interface Pad {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  cooldownUntil: number;
}

interface Missile {
  mesh: THREE.Mesh;
  progressIdx: number; // unwrapped centerline index — travels the racing line
  speed: number;
  travelled: number;
  owner: Kart;
  active: boolean;
}

interface Slick {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  owner: Kart;
  spawnedAt: number; // owner-immune for the first beat
  expiresAt: number;
}

const boxGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
const boxMat = new THREE.MeshStandardMaterial({
  color: 0x7be8ff,
  emissive: 0x2a9dc4,
  transparent: true,
  opacity: 0.85,
  flatShading: true,
});
const missileGeo = new THREE.ConeGeometry(0.32, 1.3, 8);
const missileMat = new THREE.MeshStandardMaterial({
  color: 0xff5040,
  emissive: 0xa02010,
  flatShading: true,
});
const slickGeo = new THREE.CylinderGeometry(0.7, 0.9, 0.22, 10);
const slickMat = new THREE.MeshStandardMaterial({
  color: 0xf7d020,
  emissive: 0x7a5c00,
  flatShading: true,
});
const shieldGeo = new THREE.SphereGeometry(1.9, 16, 12);
const shieldMat = new THREE.MeshStandardMaterial({
  color: 0x60d0ff,
  emissive: 0x1a5a80,
  transparent: true,
  opacity: 0.28,
  depthWrite: false,
});
const padGeo = new THREE.PlaneGeometry(2.2, 3.2);
const padMat = new THREE.MeshStandardMaterial({
  color: 0x30e8a0,
  emissive: 0x12a060,
  transparent: true,
  opacity: 0.9,
  side: THREE.DoubleSide,
});

export class Items {
  readonly group = new THREE.Group();
  /** Item each kart currently holds, parallel to the karts list passed to update. */
  readonly held: (ItemKind | null)[] = [];

  private readonly boxes: Box[] = [];
  private readonly missiles: Missile[] = [];
  private readonly slicks: Slick[] = [];
  private readonly pads: Pad[] = [];
  private readonly karts: Kart[] = [];
  /** Latest race scores (set by update) — position-weighted item rolls. */
  private scores: number[] = [];
  /** Per-kart shield expiry (sim-time) + bubble mesh while active. */
  readonly shieldUntil: number[] = [];
  private readonly shieldMeshes: THREE.Mesh[] = [];

  constructor(private readonly track: Track, karts: Kart[]) {
    this.karts = karts;
    this.held = karts.map(() => null);
    for (let i = 0; i < karts.length; i++) {
      this.shieldUntil.push(0);
      const bubble = new THREE.Mesh(shieldGeo, shieldMat);
      bubble.visible = false;
      this.group.add(bubble);
      this.shieldMeshes.push(bubble);
    }
    // Rows of 3 boxes at ~1/8-lap intervals, staggered across the road.
    const n = track.sampleCount;
    const spreads = [-3, 0, 3];
    for (let row = 0; row < 8; row++) {
      const idx = Math.floor(((row + 0.5) / 8) * n);
      for (let s = 0; s < 3; s++) {
        const pos = track.pointAt(idx).addScaledVector(
          track.leftAt(idx),
          spreads[(s + row) % 3],
        );
        pos.y += 0.7;
        const mesh = new THREE.Mesh(boxGeo, boxMat);
        mesh.position.copy(pos);
        mesh.rotation.set(0.5, (row + s) * 0.7, 0.4);
        this.group.add(mesh);
        this.boxes.push({ mesh, idx, pos, respawnAt: 0 });
      }
    }
    // Boost pads: glowing arrows placed OFF the ideal line — a route decision
    // (wide line for free boost vs. tight line). Outside of the crest corner,
    // inside of the hairpin exit, mid straight.
    const padSpots: Array<[number, number]> = [
      [0.22, -4.2], // outside on the climb into the crest
      [0.30, 4.4],  // outside at crest exit — the dive
      [0.62, -4.0], // inside of the ridge S
      [0.88, 3.8],  // outside hairpin exit
    ];
    for (const [frac, lat] of padSpots) {
      const idx = Math.floor(frac * n);
      const pos = track.pointAt(idx).addScaledVector(track.leftAt(idx), lat);
      pos.y += 0.03;
      const mesh = new THREE.Mesh(padGeo, padMat);
      mesh.position.copy(pos);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = -Math.atan2(
        track.tangentAt(idx).x,
        track.tangentAt(idx).z,
      );
      this.group.add(mesh);
      this.pads.push({ mesh, pos, cooldownUntil: 0 });
    }
  }

  /** Roll a random item, weighted by race position — trailing racers draw
   *  aggressive items (missile/ink/swap), leaders draw utility (genre
   *  rubber-banding; pairs with the pace assist). */
  private roll(kartIdx: number): ItemKind {
    const n = this.scores.length;
    const my = n > kartIdx ? this.scores[kartIdx] : 0;
    let rank = 0;
    for (let k = 0; k < n; k++) if (this.scores[k] > my) rank++;
    const trailing = n > 1 ? rank / (n - 1) : 0.5; // 0 leader → 1 last
    const w: Record<ItemKind, number> = {
      boost: THREE.MathUtils.lerp(0.42, 0.1, trailing),
      slick: THREE.MathUtils.lerp(0.26, 0.08, trailing),
      shield: THREE.MathUtils.lerp(0.16, 0.16, trailing),
      missile: THREE.MathUtils.lerp(0.1, 0.3, trailing),
      ink: THREE.MathUtils.lerp(0.04, 0.2, trailing),
      swap: THREE.MathUtils.lerp(0.02, 0.16, trailing),
    };
    let r = Math.random();
    for (const k of Object.keys(w) as ItemKind[]) {
      if ((r -= w[k]) <= 0) return k;
    }
    return 'boost';
  }

  /** Fire kart `k`'s held item. `scores` = race scores for ink targeting.
   *  Returns the item used (or null). */
  use(kartIdx: number, simTime: number, scores?: number[]): ItemKind | null {
    const item = this.held[kartIdx];
    if (!item) return null;
    this.held[kartIdx] = null;
    const kart = this.karts[kartIdx];
    if (item === 'swap') {
      // Swap positions/velocities with the racer directly ahead — chaotic
      // but bounded (no one ahead → fizzle, same as leading-ink).
      const sc = scores ?? this.scores;
      if (!sc.length) return item;
      let target = -1;
      let bestGap = Infinity;
      for (let k = 0; k < this.karts.length; k++) {
        const gap = sc[k] - sc[kartIdx];
        if (k !== kartIdx && gap > 0 && gap < bestGap) {
          bestGap = gap;
          target = k;
        }
      }
      if (target < 0) return item; // leading — wasted
      const other = this.karts[target];
      const p = kart.position.clone();
      const v = kart.velocity.clone();
      const h = kart.heading;
      kart.position.copy(other.position);
      kart.velocity.copy(other.velocity);
      kart.heading = other.heading;
      other.position.copy(p);
      other.velocity.copy(v);
      other.heading = h;
      return item;
    }
    if (item === 'ink') {
      // Blooper: splats every racer ahead on score. Leading = wasted toss.
      const sc = scores ?? this.scores;
      if (!sc.length) return item;
      for (let k = 0; k < this.karts.length; k++) {
        if (k === kartIdx || sc[k] <= sc[kartIdx]) continue;
        if (simTime < this.shieldUntil[k]) {
          this.shieldUntil[k] = 0; // shield absorbs it, consumed
        } else {
          this.karts[k].inkedUntil = simTime + AI.inkDuration;
        }
      }
      return item;
    }
    if (item === 'boost') {
      kart.boostTimer = Math.max(kart.boostTimer, KART.boostTime[1]);
      return item;
    }
    if (item === 'shield') {
      // Defensive bubble — absorbs the next missile/slick hit for ~8 s.
      this.shieldUntil[kartIdx] = simTime + 8;
      return item;
    }
    if (item === 'slick') {
      // Drop hazard behind the kart — persists ~18 s, spins whoever clips it.
      const mesh = new THREE.Mesh(slickGeo, slickMat);
      const pos = kart.position
        .clone()
        .addScaledVector(kart.forward(), -2.6);
      pos.y = this.track.heightAt(pos) + 0.11;
      mesh.position.copy(pos);
      this.group.add(mesh);
      this.slicks.push({
        mesh,
        pos,
        owner: kart,
        spawnedAt: simTime,
        expiresAt: simTime + 18,
      });
      return item;
    }
    // Missile: spawn at kart nose, travels the centerline forward.
    const mesh = new THREE.Mesh(missileGeo, missileMat);
    mesh.position.copy(kart.position).setY(0.5);
    this.group.add(mesh);
    this.missiles.push({
      mesh,
      progressIdx: this.track.nearestIndex(kart.position),
      speed: Math.max(MISSILE_SPEED, kart.speed + 8),
      travelled: 0,
      owner: kart,
      active: true,
    });
    void simTime;
    return item;
  }

  update(simTime: number, dt: number, scores?: number[]): void {
    if (scores) this.scores = scores;
    // Pickup checks
    for (const b of this.boxes) {
      const active = simTime >= b.respawnAt;
      b.mesh.visible = active;
      if (active) b.mesh.rotation.y += dt * 1.5;
      if (!active) continue;
      for (let k = 0; k < this.karts.length; k++) {
        if (this.held[k]) continue; // one item at a time
        const p = this.karts[k].position;
        const dx = p.x - b.pos.x;
        const dz = p.z - b.pos.z;
        if (dx * dx + dz * dz < BOX_RADIUS * BOX_RADIUS) {
          this.held[k] = this.roll(k);
          b.respawnAt = simTime + RESPAWN_S;
          b.mesh.visible = false;
          break;
        }
      }
    }
    // Boost pads: drive over for a free mini-turbo (1 s cooldown per kart)
    for (const p of this.pads) {
      if (simTime < p.cooldownUntil) continue;
      for (const kart of this.karts) {
        const dx = kart.position.x - p.pos.x;
        const dz = kart.position.z - p.pos.z;
        if (dx * dx + dz * dz < 4.5) {
          kart.boostTimer = Math.max(kart.boostTimer, KART.boostTime[0]);
          p.cooldownUntil = simTime + 1.0;
          break;
        }
      }
    }
    // Missiles: advance along centerline, check hits
    for (const m of this.missiles) {
      if (!m.active) continue;
      const step = (m.speed * dt) / this.track.sampleSpacing;
      m.progressIdx += step;
      m.travelled += m.speed * dt;
      const wp = this.track.pointAt(Math.floor(m.progressIdx));
      wp.y += 0.5;
      m.mesh.position.copy(wp);
      const t = this.track.tangentAt(Math.floor(m.progressIdx));
      m.mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        t.clone().negate(), // cone +Y tip faces -tangent? keep nose forward
      );
      let hit = false;
      for (let k = 0; k < this.karts.length; k++) {
        const kart = this.karts[k];
        if (kart === m.owner) continue;
        const d = kart.position.distanceTo(m.mesh.position);
        if (d < MISSILE_HIT) {
          if (simTime < this.shieldUntil[k]) {
            this.shieldUntil[k] = 0; // shield absorbs the hit, consumed
          } else {
            kart.velocity.multiplyScalar(MISSILE_SLOW);
            kart.lastWallHit = simTime;
            kart.lastWallImpact = 0.7;
            kart.spinUntil = simTime + 0.9;
          }
          hit = true;
          break;
        }
      }
      if (hit || m.travelled > MISSILE_RANGE) {
        m.active = false;
        this.group.remove(m.mesh);
      }
    }
    // Slicks: persistent hazards — spin out whoever clips one.
    for (let i = this.slicks.length - 1; i >= 0; i--) {
      const s = this.slicks[i];
      if (simTime > s.expiresAt) {
        this.group.remove(s.mesh);
        this.slicks.splice(i, 1);
        continue;
      }
      s.mesh.rotation.y += dt * 0.8;
      for (let k = 0; k < this.karts.length; k++) {
        const kart = this.karts[k];
        if (kart === s.owner && simTime < s.spawnedAt + 1.2) continue;
        const dx = kart.position.x - s.pos.x;
        const dz = kart.position.z - s.pos.z;
        if (dx * dx + dz * dz < 1.2) {
          if (simTime < this.shieldUntil[k]) {
            this.shieldUntil[k] = 0; // shield absorbs the hit, consumed
          } else {
            kart.velocity.multiplyScalar(0.3);
            kart.lastWallHit = simTime;
            kart.lastWallImpact = 0.55;
            kart.spinUntil = simTime + 1.1;
          }
          this.group.remove(s.mesh);
          this.slicks.splice(i, 1);
          break;
        }
      }
    }
    // Shield bubbles follow their kart while active; ink flags tick too.
    for (let k = 0; k < this.karts.length; k++) {
      this.karts[k].inked = simTime < this.karts[k].inkedUntil;
      const active = simTime < this.shieldUntil[k];
      const b = this.shieldMeshes[k];
      b.visible = active;
      if (active) {
        b.position.copy(this.karts[k].position);
        b.position.y += 0.9;
        b.scale.setScalar(1 + Math.sin(simTime * 6 + k) * 0.04);
      }
    }
    // Compact dead missiles occasionally
    if (this.missiles.length > 8) {
      for (let i = this.missiles.length - 1; i >= 0; i--) {
        if (!this.missiles[i].active) this.missiles.splice(i, 1);
      }
    }
  }
}
