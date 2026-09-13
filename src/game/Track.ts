import * as THREE from 'three';
import { TRACK } from '../config/tuning';

// Test track: a closed Catmull-Rom circuit ("Proving Grounds").
// Provides the road/barrier meshes plus a sampled centerline lookup used for
// kart constraint (on-road test + wall push-back). Flat for the Wave 1 slice;
// elevation becomes its own quality unit.

// A track layout: closed Catmull-Rom control points (X, Y, Z — meters) plus
// gravel shortcut zones (index-range aprons extending the drivable edge).
export interface TrackLayout {
  readonly name: string;
  readonly points: ReadonlyArray<readonly [number, number, number]>;
  readonly gravel: ReadonlyArray<{ i0: number; i1: number; side: -1 | 1 }>;
}

export const TRACKS: readonly TrackLayout[] = [
  {
    name: 'PROVING GROUNDS',
    // ~190×100 m circuit: long back straight, sweeping right hander over a
    // CREST (climb-and-dive), roller-coaster ridge through the S-curves,
    // hairpin. Clockwise.
    points: [
      [0, 0, 0],
      [55, 0, 0],
      [88, 1.2, 8],
      [102, 3.6, 32],
      [92, 6.0, 58],
      [62, 3.8, 66],
      [52, 1.0, 88],
      [24, 0, 96],
      [-4, 0, 86],
      [-18, 0, 62],
      [-34, 1.0, 48],
      [-48, 3.0, 60],
      [-70, 4.5, 58],
      [-84, 2.0, 38],
      [-78, 0.4, 14],
      [-56, 0, 4],
      [-30, 0, -6],
      [-12, 0, -4],
    ],
    gravel: [
      // Hairpin at ~0.63 bends LEFT (+1.79 rad) — inside is the left edge.
      { i0: 0.6, i1: 0.662, side: 1 },
      // Left-hander at ~0.36 (crest area): inside cut on the left edge.
      { i0: 0.352, i1: 0.382, side: 1 },
    ],
  },
  {
    name: 'SWITCHBACK RIDGE',
    // ~200×90 m technical course: plateau climb, switchback descent,
    // ridge dive — slower, more corner management than Proving Grounds.
    points: [
      [0, 0, 0],
      [56, 0, 0],
      [92, 0.8, 10],
      [106, 3.0, 38],
      [96, 6.0, 66],
      [62, 6.5, 78],
      [30, 5.0, 70],
      [8, 2.5, 48],
      [14, 1.0, 20],
      [-16, 0.6, 12],
      [-44, 1.5, 26],
      [-70, 3.5, 46],
      [-92, 4.0, 70],
      [-108, 2.0, 44],
      [-96, 0.4, 14],
      [-66, 0, 0],
      [-32, 0, -2],
    ],
    gravel: [
      // Switchback at ~0.50 bends RIGHT (-0.51 rad) — inside is the right
      // edge (-1). Tight apex cut through the S-sequence.
      { i0: 0.485, i1: 0.535, side: -1 },
      // Ridge dive at ~0.71 bends LEFT (+0.76 rad, sharpest on course) —
      // inside is the left edge (+1).
      { i0: 0.68, i1: 0.73, side: 1 },
    ],
  },
];

interface Sample {
  point: THREE.Vector3;
  tangent: THREE.Vector3;
  left: THREE.Vector3; // unit vector toward TRUE road-left (driver's left)
}

export class Track {
  readonly group = new THREE.Group();
  readonly name: string;
  private readonly curve: THREE.CatmullRomCurve3;
  private readonly samples: Sample[] = [];
  private readonly gravelZones: TrackLayout['gravel'];

  constructor(layout: TrackLayout = TRACKS[0]) {
    this.name = layout.name;
    this.gravelZones = layout.gravel;
    this.curve = new THREE.CatmullRomCurve3(
      layout.points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      true,
      'centripetal',
    );
    this.buildSamples();
    this.buildMeshes();
  }

  // Free GPU resources when the world is rebuilt (track select).
  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material;
        for (const mm of Array.isArray(m) ? m : [m]) mm.dispose();
      }
    });
  }

  private buildSamples(): void {
    const n = TRACK.samples;
    const pts = this.curve.getSpacedPoints(n);
    for (let i = 0; i < n; i++) {
      const point = pts[i];
      const next = pts[(i + 1) % n];
      const prev = pts[(i - 1 + n) % n];
      const tangent = next.clone().sub(prev).setY(0).normalize();
      const left = new THREE.Vector3(tangent.z, 0, -tangent.x);
      this.samples.push({ point, tangent, left });
    }
  }

  /** Nearest centerline sample index — linear scan, cheap at 1024 samples. */
  nearestIndex(pos: THREE.Vector3): number {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < this.samples.length; i++) {
      const d = this.samples[i].point.distanceToSquared(pos);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  /**
   * Signed lateral distance from centerline (positive = left of travel
   * direction) and the local tangent. Used by kart constraint + spawn.
   */
  query(pos: THREE.Vector3): { lateral: number; tangent: THREE.Vector3 } {
    const i = this.nearestIndex(pos);
    // Refine by checking neighbors — nearest vertex isn't always the closest
    // segment point on a curvy section, but sample density keeps error <0.2 m.
    let bestI = i;
    let bestD = Infinity;
    for (let k = -1; k <= 1; k++) {
      const j = (i + k + this.samples.length) % this.samples.length;
      const d = this.samples[j].point.distanceToSquared(pos);
      if (d < bestD) {
        bestD = d;
        bestI = j;
      }
    }
    const s = this.samples[bestI];
    const rel = pos.clone().sub(s.point);
    return { lateral: rel.dot(s.left), tangent: s.tangent };
  }

  /** Gravel zone containing a sample index, or null. `margin` shrinks the
   *  zone on both ends (frac units) — used to release the AI's shortcut
   *  pull before the wall resumes at the exit. */
  private zoneAt(
    index: number,
    margin = 0,
  ): { i0: number; i1: number; side: number } | null {
    const n = this.samples.length;
    const frac = index / n;
    for (const z of this.gravelZones) {
      if (frac >= z.i0 + margin && frac <= z.i1 - margin) return z;
    }
    return null;
  }

  /** Preferred racing-line lateral inside a gravel zone at this index
   *  (mid-apron), or null — lets AI route through shortcuts. */
  gravelBiasAt(index: number, margin = 0): number | null {
    const z = this.zoneAt(index, margin);
    if (!z) return null;
    return z.side * (TRACK.roadHalfWidth + TRACK.gravelWidth * 0.35);
  }

  /** Kart-position shortcut test: mid-apron lateral only when the kart is
   *  INSIDE a zone past the entry margin — approaching early steered bots
   *  into the wall face just before the gap opens. */
  gravelBiasInside(pos: THREE.Vector3, margin = 0.008): number | null {
    const z = this.zoneAt(this.nearestIndex(pos), margin);
    if (!z) return null;
    return z.side * (TRACK.roadHalfWidth + TRACK.gravelWidth * 0.35);
  }

  /** Surface under a position: 'gravel' on shortcut aprons, else 'road'. */
  surfaceAt(pos: THREE.Vector3): 'road' | 'gravel' {
    const i = this.nearestIndex(pos);
    const z = this.zoneAt(i);
    if (!z) return 'road';
    const { lateral } = this.query(pos);
    return lateral * z.side > TRACK.roadHalfWidth - 0.5 ? 'gravel' : 'road';
  }

  /** Push a position back inside the drivable edge — the edge widens onto
   *  gravel aprons inside shortcut zones (asymmetric per side). */
  constrain(pos: THREE.Vector3): { lateral: number; clamped: boolean } {
    const i = this.nearestIndex(pos);
    const { lateral } = this.query(pos);
    const roadLimit = TRACK.roadHalfWidth - 0.75; // kart half-width → wall face
    const z = this.zoneAt(i);
    // Zone-side edge extends onto gravel; the other edge stays the wall.
    const limit =
      z && Math.sign(lateral) === z.side ? roadLimit + TRACK.gravelWidth : roadLimit;
    if (Math.abs(lateral) <= limit) return { lateral, clamped: false };
    const s = this.samples[i];
    pos.copy(s.point).addScaledVector(s.left, Math.sign(lateral) * limit);
    return { lateral: Math.sign(lateral) * limit, clamped: true };
  }

  /**
   * Point on the centerline `aheadMeters` past the nearest sample to `pos`.
   * Walks the samples by arc length and interpolates the final segment so the
   * target moves smoothly — used as the AI pure-pursuit lookahead.
   */
  lookaheadPoint(pos: THREE.Vector3, aheadMeters: number): THREE.Vector3 {
    const n = this.samples.length;
    const start = this.nearestIndex(pos);
    let i = start;
    let acc = 0;
    while (acc < aheadMeters) {
      const j = (i + 1) % n;
      acc += this.samples[i].point.distanceTo(this.samples[j].point);
      i = j;
      if (i === start) break; // wrapped the whole lap — absurd distance
    }
    // Interpolate back into the final segment for a smooth target point.
    const prev = this.samples[(i - 1 + n) % n].point;
    const cur = this.samples[i].point;
    const segLen = prev.distanceTo(cur);
    const t =
      segLen > 1e-6
        ? THREE.MathUtils.clamp(1 - (acc - aheadMeters) / segLen, 0, 1)
        : 1;
    return prev.clone().lerp(cur, t);
  }

  /** Unit tangent of the travel direction at a centerline sample index. */
  tangentAt(index: number): THREE.Vector3 {
    const n = this.samples.length;
    return this.samples[((index % n) + n) % n].tangent;
  }

  /** Centerline point at a sample index (wrapped). */
  pointAt(index: number): THREE.Vector3 {
    const n = this.samples.length;
    return this.samples[((index % n) + n) % n].point.clone();
  }

  /** Road-left unit vector at a sample index (wrapped). */
  leftAt(index: number): THREE.Vector3 {
    const n = this.samples.length;
    return this.samples[((index % n) + n) % n].left;
  }

  /** Average metres between centerline samples (for arc-length math). */
  get sampleSpacing(): number {
    if (this._spacing < 0) {
      let acc = 0;
      const n = this.samples.length;
      for (let i = 0; i < n; i++) {
        acc += this.samples[i].point.distanceTo(this.samples[(i + 1) % n].point);
      }
      this._spacing = acc / n;
    }
    return this._spacing;
  }
  private _spacing = -1;

  get sampleCount(): number {
    return this.samples.length;
  }

  /** Road surface height at a world position — projects onto the two
   *  centerline segments adjacent to the nearest sample and interpolates. */
  heightAt(pos: THREE.Vector3): number {
    const n = this.samples.length;
    const i = this.nearestIndex(pos);
    let bestY = this.samples[i].point.y;
    let bestD = Infinity;
    for (const [a, b] of [
      [i, (i + 1) % n],
      [(i - 1 + n) % n, i],
    ] as const) {
      const pa = this.samples[a].point;
      const pb = this.samples[b].point;
      const dx = pb.x - pa.x;
      const dz = pb.z - pa.z;
      const lenSq = dx * dx + dz * dz;
      const t = lenSq > 1e-9
        ? THREE.MathUtils.clamp(((pos.x - pa.x) * dx + (pos.z - pa.z) * dz) / lenSq, 0, 1)
        : 0;
      const px = pa.x + dx * t;
      const pz = pa.z + dz * t;
      const d = (pos.x - px) * (pos.x - px) + (pos.z - pz) * (pos.z - pz);
      if (d < bestD) {
        bestD = d;
        bestY = pa.y + (pb.y - pa.y) * t;
      }
    }
    return bestY;
  }

  /** Grid slot: `backSamples` behind the start line, `lateral` offset (m). */
  gridSlot(backSamples: number, lateral: number): { position: THREE.Vector3; heading: number } {
    const n = this.samples.length;
    const i = ((Math.floor(n * 0.01) - backSamples) % n + n) % n;
    const s = this.samples[i];
    const position = s.point.clone().addScaledVector(s.left, lateral);
    return { position, heading: Math.atan2(-s.tangent.x, -s.tangent.z) };
  }

  /** Spawn transform: on the grid just past the start line, facing tangent. */
  spawn(): { position: THREE.Vector3; heading: number } {
    const s = this.samples[Math.floor(this.samples.length * 0.01)];
    const position = s.point.clone();
    return { position, heading: Math.atan2(-s.tangent.x, -s.tangent.z) };
  }

  private buildMeshes(): void {
    const n = this.samples.length;
    const hw = TRACK.roadHalfWidth;
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshStandardMaterial({ color: 0x3e8a4e, roughness: 1 }),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.1; // clear of the road plane — avoids z-fighting
    this.group.add(grass);

    // Road ribbon: triangle strip between left/right road edges.
    const roadPos: number[] = [];
    const roadIdx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const s = this.samples[i % n];
      roadPos.push(
        s.point.x + s.left.x * hw, s.point.y, s.point.z + s.left.z * hw,
        s.point.x - s.left.x * hw, s.point.y, s.point.z - s.left.z * hw,
      );
      if (i < n) {
        const a = i * 2;
        // CCW seen from +Y so normals face up (left edge = even verts).
        roadIdx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      }
    }
    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPos, 3));
    roadGeo.setIndex(roadIdx);
    roadGeo.computeVertexNormals();
    const road = new THREE.Mesh(
      roadGeo,
      new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.9 }),
    );
    this.group.add(road);

    // Curbs: alternating red/white boxes along both edges — readable boundary.
    const curbGeo = new THREE.BoxGeometry(0.8, 0.12, 2.4);
    const red = new THREE.MeshStandardMaterial({ color: 0xd8443c });
    const white = new THREE.MeshStandardMaterial({ color: 0xe8e8e8 });
    const curbCount = Math.floor(n / 8);
    const curbsL = new THREE.InstancedMesh(curbGeo, red, curbCount);
    const curbsR = new THREE.InstancedMesh(curbGeo, white, curbCount);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (let c = 0; c < curbCount; c++) {
      const s = this.samples[(c * 8) % n];
      q.setFromAxisAngle(up, Math.atan2(s.tangent.x, s.tangent.z) + Math.PI / 2);
      for (const [mesh, side] of [
        [curbsL, 1],
        [curbsR, -1],
      ] as const) {
        m.compose(
          s.point.clone().addScaledVector(s.left, side * (hw - 0.15)).setY(s.point.y + 0.06),
          q,
          new THREE.Vector3(1, 1, 1),
        );
        mesh.setMatrixAt(c, m);
      }
    }
    this.group.add(curbsL, curbsR);

    // Barrier walls: continuous raised ribbons just outside the curbs so the
    // constraint boundary is VISIBLE (critic gap: invisible wall read as a bug).
    // Two vertical strips facing inward, one per edge.
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xe8e4da,
      roughness: 0.7,
      side: THREE.DoubleSide,
    });
    for (const side of [1, -1]) {
      const wallPos: number[] = [];
      const wallIdx: number[] = [];
      // Wall face sits just past the clamp edge so contact visually touches.
      const off = hw + 0.05;
      const h = TRACK.wallHeight;
      // Skip samples inside this side's gravel zone → a visible gap where
      // the shortcut apron opens (karts drive onto dirt, not through wall).
      for (let i = 0; i <= n; i++) {
        const s = this.samples[i % n];
        const z = this.zoneAt(i % n);
        const gapped = !!z && z.side === side;
        const bx = s.point.x + s.left.x * side * off;
        const bz = s.point.z + s.left.z * side * off;
        const base = wallPos.length / 3;
        wallPos.push(bx, s.point.y, bz, bx, s.point.y + h, bz);
        // Emit quads only when this AND the next sample are both ungapped.
        if (i < n) {
          const zNext = this.zoneAt((i + 1) % n);
          const gapNext = !!zNext && zNext.side === side;
          if (!gapped && !gapNext) {
            const a = base;
            if (side > 0) wallIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
            else wallIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
          }
        }
      }
      const wallGeo = new THREE.BufferGeometry();
      wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
      wallGeo.setIndex(wallIdx);
      wallGeo.computeVertexNormals();
      this.group.add(new THREE.Mesh(wallGeo, wallMat));
    }

    // Gravel aprons: dirt ribbon from the road edge outward, plus a low berm
    // at the far edge (the new wall line). Reads as a rough cut-through.
    const gravelMat = new THREE.MeshStandardMaterial({
      color: 0xa08658,
      roughness: 1,
      side: THREE.DoubleSide,
    });
    for (const z of this.gravelZones) {
      const gPos: number[] = [];
      const gIdx: number[] = [];
      const inner = hw - 0.6;
      const outer = hw + TRACK.gravelWidth + 0.9;
      const i0 = Math.floor(z.i0 * n);
      const i1 = Math.floor(z.i1 * n);
      for (let i = i0; i <= i1; i++) {
        const s = this.samples[i];
        const a = (i - i0) * 2;
        gPos.push(
          s.point.x + s.left.x * z.side * inner, s.point.y - 0.015, s.point.z + s.left.z * z.side * inner,
          s.point.x + s.left.x * z.side * outer, s.point.y - 0.015, s.point.z + s.left.z * z.side * outer,
        );
        if (i < i1) {
          gIdx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
        }
      }
      const gGeo = new THREE.BufferGeometry();
      gGeo.setAttribute('position', new THREE.Float32BufferAttribute(gPos, 3));
      gGeo.setIndex(gIdx);
      gGeo.computeVertexNormals();
      this.group.add(new THREE.Mesh(gGeo, gravelMat));
      // Dirt berm at the gravel's outer edge — low soft mounds marking the
      // new boundary (reads as piled earth, not barriers).
      const bermGeo = new THREE.CylinderGeometry(1.6, 2.0, 0.34, 8);
      const bermMat = new THREE.MeshStandardMaterial({ color: 0x94784f, roughness: 1 });
      const bermCount = Math.floor((i1 - i0) / 4);
      const berms = new THREE.InstancedMesh(bermGeo, bermMat, bermCount);
      const bm = new THREE.Matrix4();
      const bq = new THREE.Quaternion();
      const bup = new THREE.Vector3(0, 1, 0);
      for (let c = 0; c < bermCount; c++) {
        const s = this.samples[i0 + c * 4];
        bq.setFromAxisAngle(bup, Math.atan2(s.tangent.x, s.tangent.z) + Math.PI / 2);
        bm.compose(
          s.point.clone().addScaledVector(s.left, z.side * (outer + 0.5)).setY(s.point.y + 0.05),
          bq,
          new THREE.Vector3(1, 1, 1),
        );
        berms.setMatrixAt(c, bm);
      }
      this.group.add(berms);
    }

    // Embankment skirts: grass ribbon from each road edge outward+down to
    // ground, so elevated sections read as mounds instead of floating ribbon.
    const skirtMat = new THREE.MeshStandardMaterial({
      color: 0x35793f,
      roughness: 1,
      side: THREE.DoubleSide,
    });
    for (const side of [1, -1]) {
      const skPos: number[] = [];
      const skIdx: number[] = [];
      const inner = hw - 0.1;
      const outer = hw + 6;
      for (let i = 0; i <= n; i++) {
        const s = this.samples[i % n];
        skPos.push(
          s.point.x + s.left.x * side * inner, s.point.y, s.point.z + s.left.z * side * inner,
          s.point.x + s.left.x * side * outer, -0.35, s.point.z + s.left.z * side * outer,
        );
        if (i < n) {
          const a = i * 2;
          if (side > 0) skIdx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
          else skIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
      const skGeo = new THREE.BufferGeometry();
      skGeo.setAttribute('position', new THREE.Float32BufferAttribute(skPos, 3));
      skGeo.setIndex(skIdx);
      skGeo.computeVertexNormals();
      this.group.add(new THREE.Mesh(skGeo, skirtMat));
    }

    // Start/finish stripe.
    const s0 = this.samples[0];
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(hw * 2, 2),
      new THREE.MeshStandardMaterial({ color: 0xf5f5f5 }),
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.rotation.z = -Math.atan2(s0.tangent.x, s0.tangent.z) + Math.PI / 2;
    stripe.position.copy(s0.point).setY(s0.point.y + 0.03); // above road, below wheels
    this.group.add(stripe);

    // Centerline dashes — speed/racing-line readability (critic: flat
    // featureless road gave no optical flow).
    const dashGeo = new THREE.BoxGeometry(0.18, 0.02, 1.4);
    const dashMat = new THREE.MeshStandardMaterial({ color: 0xd8dce4 });
    const dashEvery = 6;
    const dashes = new THREE.InstancedMesh(dashGeo, dashMat, Math.floor(n / dashEvery));
    for (let c = 0; c < Math.floor(n / dashEvery); c++) {
      const s = this.samples[(c * dashEvery) % n];
      q.setFromAxisAngle(up, Math.atan2(s.tangent.x, s.tangent.z));
      m.compose(
        s.point.clone().setY(s.point.y + 0.025),
        q,
        new THREE.Vector3(1, 1, 1),
      );
      dashes.setMatrixAt(c, m);
    }
    this.group.add(dashes);

    // Start gantry — landmark over the stripe (two posts + beam + banner).
    const postGeo = new THREE.BoxGeometry(0.4, 5.5, 0.4);
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x2a3140 });
    for (const side of [1, -1]) {
      const post = new THREE.Mesh(postGeo, beamMat);
      post.position.copy(s0.point).addScaledVector(s0.left, side * (hw + 1.2)).setY(s0.point.y + 2.75);
      this.group.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 2.8, 0.5, 0.5), beamMat);
    beam.position.copy(s0.point).setY(s0.point.y + 5.5);
    beam.rotation.y = Math.atan2(s0.tangent.x, s0.tangent.z) + Math.PI / 2;
    this.group.add(beam);
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(hw * 1.2, 1.0, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xffb340 }),
    );
    banner.position.copy(s0.point).setY(s0.point.y + 4.8);
    banner.rotation.y = beam.rotation.y;
    this.group.add(banner);

    // Corner chevrons: glowing arrow boards on the outside wall at corner
    // entries — readable turn direction + severity at speed. Detect corners
    // by tangent change over ~30 m; board arrows point the turn direction.
    const chevMat = new THREE.MeshStandardMaterial({
      color: 0x1a2028,
      roughness: 0.6,
      side: THREE.DoubleSide,
    });
    const chevGeo = new THREE.PlaneGeometry(1.6, 0.9);
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0xffc23c,
      emissive: 0xc07818,
      side: THREE.DoubleSide,
    });
    const arrowGeo = new THREE.PlaneGeometry(1.1, 0.5);
    for (let i = 0; i < n; i += 10) {
      const ahead = (i + 24) % n;
      const turn = this.samples[i].tangent.angleTo(this.samples[ahead].tangent);
      if (turn < 0.35) continue; // only real corners get boards
      // Sign of turn: cross.y of tangents — negative = right-hand corner,
      // so boards go on the OUTSIDE (left wall for right turns).
      const t0 = this.samples[i].tangent;
      const t1 = this.samples[ahead].tangent;
      const rightTurn = t0.x * t1.z - t0.z * t1.x < 0;
      const wallSide = rightTurn ? 1 : -1;
      // 3 boards staggered across the corner entry.
      for (let b = 0; b < 3; b++) {
        const s = this.samples[(i + b * 6) % n];
        const board = new THREE.Mesh(chevGeo, chevMat);
        const arrow = new THREE.Mesh(arrowGeo, arrowMat);
        board.position
          .copy(s.point)
          .addScaledVector(s.left, wallSide * (hw + 0.8))
          .setY(s.point.y + TRACK.wallHeight + 0.75);
        // Face the approaching driver — normal points back along tangent.
        board.rotation.y = Math.atan2(-s.tangent.x, -s.tangent.z);
        arrow.position.copy(board.position);
        arrow.rotation.y = board.rotation.y;
        arrow.position.addScaledVector(s.tangent, -0.06); // in front of the board face
        // Chevron arrow: shear/tilt to point the turn direction.
        arrow.rotation.z = rightTurn ? -0.5 : 0.5;
        arrow.scale.x = rightTurn ? -1 : 1;
        this.group.add(board, arrow);
      }
      i += 60; // space boards out — skip past this corner
    }

    // Scenery: instanced trees + rocks scattered outside the walls. Pure
    // optical-flow/parallax props — cheap, deterministic pseudo-random.
    const rng = (seed: number) => {
      let s = seed >>> 0;
      return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
    };
    const rand = rng(1337);
    const treeCount = 110;
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.3, 1.6, 6);
    const canopyGeo = new THREE.ConeGeometry(1.5, 3.2, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, flatShading: true });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2f7a3f, flatShading: true });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCount);
    const rockGeo = new THREE.DodecahedronGeometry(0.9, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8f96, flatShading: true });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 40);
    // Ground height for props beside the road: inside the skirt zone
    // (hw..hw+6) the terrain slopes from road height down to -0.35.
    const groundY = (s: Sample, dist: number) => {
      const t = THREE.MathUtils.clamp((dist - hw) / 6, 0, 1);
      return THREE.MathUtils.lerp(s.point.y, -0.35, t) + 0.35; // base sits ON skirt
    };
    let placed = 0;
    let guard = 0;
    while (placed < treeCount && guard++ < treeCount * 4) {
      const s = this.samples[Math.floor(rand() * n)];
      const side = rand() < 0.5 ? 1 : -1;
      const dist = hw + 3 + rand() * 30;
      const p = s.point.clone().addScaledVector(s.left, side * dist);
      const gy = groundY(s, dist);
      const sc = 0.8 + rand() * 0.9;
      const rot = new THREE.Quaternion().setFromAxisAngle(up, rand() * Math.PI * 2);
      m.compose(p.clone().setY(gy + 0.8 * sc), rot, new THREE.Vector3(sc, sc, sc));
      trunks.setMatrixAt(placed, m);
      m.compose(p.clone().setY(gy + (1.6 + 1.6) * sc), rot, new THREE.Vector3(sc, sc, sc));
      canopies.setMatrixAt(placed, m);
      placed++;
    }
    for (let c = 0; c < 40; c++) {
      const s = this.samples[Math.floor(rand() * n)];
      const side = rand() < 0.5 ? 1 : -1;
      const dist = hw + 4 + rand() * 24;
      const p = s.point.clone().addScaledVector(s.left, side * dist);
      const sc = 0.5 + rand() * 1.1;
      m.compose(
        p.setY(groundY(s, dist) + 0.4 * sc),
        new THREE.Quaternion().setFromAxisAngle(up, rand() * Math.PI * 2),
        new THREE.Vector3(sc, sc * 0.7, sc),
      );
      rocks.setMatrixAt(c, m);
    }
    this.group.add(trunks, canopies, rocks);
  }
}
