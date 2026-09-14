import * as THREE from 'three';
import { TRACK } from '../config/tuning';
import { TEX, checkerTexture } from '../core/Textures';
import {
  AnimatedProp,
  ScatterCtx,
  dressNeon,
  dressPastoral,
  dressRidge,
} from './Props';

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
  /** Signature prop set — the visual landmark vocabulary that makes each
   *  circuit feel authored, not re-skinned: flower meadows (pastoral),
   *  rock outcrops (ridge), neon pylons (neon). */
  readonly signature?: 'pastoral' | 'ridge' | 'neon';
  /** Palette overrides — gives each circuit its own visual identity. */
  readonly theme?: {
    sky: number;    // scene background + fog
    grass: number;  // ground plane
    skirt: number;  // embankment fill
    canopy: number; // tree tops
    trunk: number;  // tree trunks
    rock: number;
    /** Lighting: sun position + color, hemisphere sky/ground bounce. */
    sunPos?: readonly [number, number, number];
    sunColor?: number;
    sunIntensity?: number;
    hemiSky?: number;
    hemiGround?: number;
    hemiIntensity?: number;
    /** Sky dome: gradient top/horizon, cloud tint, mountain silhouette
     *  base color, star density (0 = day sky). */
    skyTop?: number;
    skyHorizon?: number;
    cloud?: number;
    mountain?: number;
    stars?: number;
    /** Night circuits: karts run headlights (emissive lamps + beam). */
    night?: boolean;
  };
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
    signature: 'pastoral',
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
    signature: 'ridge',
    // Golden-hour palette — dry ridge country vs Proving Grounds' blue day.
    theme: {
      sky: 0xe8b490,
      grass: 0x9aa050,
      skirt: 0x7a8a48,
      canopy: 0x4a7a38,
      trunk: 0x5a4030,
      rock: 0x9a8570,
      sunPos: [-80, 26, 40], // low western sun
      sunColor: 0xffc890,
      hemiSky: 0xf0c8a0,
      hemiGround: 0x5a6a3a,
      // Golden-hour sky: dusky violet top, hot peach horizon, warm clouds.
      skyTop: 0x5a5488,
      skyHorizon: 0xffb070,
      cloud: 0xffd8c0,
      mountain: 0x6a5468,
      stars: 0.12,
    },
  },
  {
    name: 'NEON NIGHT',
    // ~200×115 m flowing speed circuit: long straights, fast banked
    // sweepers, gentle rises — top-speed management over corner survival.
    points: [
      [0, 0, 0],
      [70, 0, 0],
      [105, 0.5, 15],
      [115, 1.5, 45],
      [95, 3.0, 75],
      [60, 4.5, 95],
      [20, 4.0, 105],
      [-12, 2.0, 98],   // crest left — braking into the dip
      [-32, 1.0, 68],   // tight left drop (real corner 1)
      [-30, 0.6, 56],   // switchback right — a lean, not a reversal: x
                        // keeps decreasing so ~55° bends over ~30 m (was
                        // an R≈6 110° spike that wall-clipped the AI)
      [-50, 1.2, 42],   // banking left
      [-88, 2.6, 55],   // ridge climb
      [-112, 2.0, 30],  // dive right — braking zone (real corner 2)
      [-95, 0.3, 2],    // tight bottom
      [-60, 0, -6],
      [-25, 0, -6],
    ],
    gravel: [
      // Left drop after the crest (~0.56, -0.68 rad) — inside cut left.
      // Ends before the right-lean at ~0.58 (its inside is the far side).
      { i0: 0.53, i1: 0.565, side: 1 },
      // Dive-to-hairpin complex (~0.72-0.78, +0.25 rad) — inside cut left.
      { i0: 0.7, i1: 0.8, side: 1 },
    ],
    signature: 'neon',
    // Night palette: navy sky, dim grass, dark pines, cool moonlight.
    theme: {
      sky: 0x141c30,
      grass: 0x2e4638,
      skirt: 0x243a30,
      canopy: 0x1e4a30,
      trunk: 0x3a2e28,
      rock: 0x4a5260,
      sunPos: [40, 60, -80], // cool moonlight
      sunColor: 0x8898c8,
      sunIntensity: 1.2,
      hemiSky: 0x4a5e92,
      hemiGround: 0x2a3828,
      hemiIntensity: 1.35,
      // Night sky: near-black zenith, teal glow at the horizon, full stars.
      skyTop: 0x060a18,
      skyHorizon: 0x1e3450,
      cloud: 0x2e3c58,
      mountain: 0x101828,
      stars: 1,
      night: true,
    },
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
  readonly theme: NonNullable<TrackLayout['theme']>;
  private readonly curve: THREE.CatmullRomCurve3;
  private readonly samples: Sample[] = [];
  private readonly gravelZones: TrackLayout['gravel'];
  private readonly signature: TrackLayout['signature'];
  // Exclusion anchors for prop scatter: the grandstand footprint and the
  // title-camera orbit ring around the player spawn. `avoidPts` collects
  // authored-prop footprints (billboards, arches, gate posts) so scattered
  // props never stab through a set piece.
  private readonly standPt = new THREE.Vector3();
  private readonly spawnPt = new THREE.Vector3();
  private readonly avoidPts: { p: THREE.Vector3; r: number }[] = [];

  constructor(layout: TrackLayout = TRACKS[0]) {
    this.name = layout.name;
    this.gravelZones = layout.gravel;
    this.signature = layout.signature;
    this.theme = layout.theme ?? {
      sky: 0x87b7e8,
      grass: 0x3e8a4e,
      skirt: 0x35793f,
      canopy: 0x2f7a3f,
      trunk: 0x6b4a2f,
      rock: 0x8a8f96,
    };
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
   * Nearest sample within ±`window` of `hint` (wraps the lap). Folded
   * layouts put parallel legs ~15-20 m apart — a global nearest lookup
   * there can snap to the wrong leg, which let karts beach on infield
   * grass inside another leg's drivable limit and flipped progress
   * forward/backward (critic: stuck kart, 4:32 lap, wrong-way flap).
   * Per-kart callers pass their last index so mapping is continuous.
   */
  nearestIndexNear(pos: THREE.Vector3, hint: number, window = 48): number {
    if (hint < 0) return this.nearestIndex(pos); // unanchored — global lookup
    const n = this.samples.length;
    const h = ((Math.round(hint) % n) + n) % n;
    let best = h;
    let bestD = this.samples[h].point.distanceToSquared(pos);
    for (let k = 1; k <= window; k++) {
      const a = (h + k) % n;
      const da = this.samples[a].point.distanceToSquared(pos);
      if (da < bestD) {
        bestD = da;
        best = a;
      }
      const b = (((h - k) % n) + n) % n;
      const db = this.samples[b].point.distanceToSquared(pos);
      if (db < bestD) {
        bestD = db;
        best = b;
      }
    }
    return best;
  }

  /**
   * Signed lateral distance from centerline (positive = left of travel
   * direction) and the local tangent. Used by kart constraint + spawn.
   * `hint` keeps the lookup on the kart's own leg through foldbacks.
   */
  query(
    pos: THREE.Vector3,
    hint?: number,
  ): {
    lateral: number;
    tangent: THREE.Vector3;
    index: number;
    surface: 'road' | 'gravel';
  } {
    const i =
      hint === undefined
        ? this.nearestIndex(pos)
        : this.nearestIndexNear(pos, hint);
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
    const lateral = rel.dot(s.left);
    const z = this.zoneAt(bestI);
    const surface: 'road' | 'gravel' =
      z && lateral * z.side > TRACK.roadHalfWidth - 0.5 ? 'gravel' : 'road';
    return { lateral, tangent: s.tangent, index: bestI, surface };
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
  gravelBiasInside(
    pos: THREE.Vector3,
    margin = 0.008,
    hint?: number,
  ): number | null {
    const i =
      hint === undefined
        ? this.nearestIndex(pos)
        : this.nearestIndexNear(pos, hint);
    const z = this.zoneAt(i, margin);
    if (!z) return null;
    return z.side * (TRACK.roadHalfWidth + TRACK.gravelWidth * 0.35);
  }

  /** Surface under a position: 'gravel' on shortcut aprons, else 'road'. */
  surfaceAt(pos: THREE.Vector3, hint?: number): 'road' | 'gravel' {
    const i =
      hint === undefined
        ? this.nearestIndex(pos)
        : this.nearestIndexNear(pos, hint);
    const z = this.zoneAt(i);
    if (!z) return 'road';
    const { lateral } = this.query(pos, i);
    return lateral * z.side > TRACK.roadHalfWidth - 0.5 ? 'gravel' : 'road';
  }

  /** Push a position back inside the drivable edge — the edge widens onto
   *  gravel aprons inside shortcut zones (asymmetric per side). `hint`
   *  anchors the lookup to the kart's own leg on folded sections. */
  constrain(
    pos: THREE.Vector3,
    hint?: number,
  ): { lateral: number; clamped: boolean; index: number } {
    const i =
      hint === undefined
        ? this.nearestIndex(pos)
        : this.nearestIndexNear(pos, hint);
    const { lateral, index } = this.query(pos, i);
    const roadLimit = TRACK.roadHalfWidth - 0.75; // kart half-width → wall face
    const z = this.zoneAt(index);
    // Zone-side edge extends onto gravel; the other edge stays the wall.
    const limit =
      z && Math.sign(lateral) === z.side ? roadLimit + TRACK.gravelWidth : roadLimit;
    if (Math.abs(lateral) <= limit) {
      return { lateral, clamped: false, index };
    }
    const s = this.samples[index];
    pos.copy(s.point).addScaledVector(s.left, Math.sign(lateral) * limit);
    return { lateral: Math.sign(lateral) * limit, clamped: true, index };
  }

  /**
   * Point on the centerline `aheadMeters` past the nearest sample to `pos`.
   * Walks the samples by arc length and interpolates the final segment so the
   * target moves smoothly — used as the AI pure-pursuit lookahead.
   */
  lookaheadPoint(
    pos: THREE.Vector3,
    aheadMeters: number,
    hint?: number,
  ): THREE.Vector3 {
    return this.lookahead(pos, aheadMeters, hint).point;
  }

  /** Lookahead that also returns the walked sample index — callers probing
   *  far ahead should use the index directly (a position→index re-lookup can
   *  snap to a parallel leg on foldbacks). */
  lookahead(
    pos: THREE.Vector3,
    aheadMeters: number,
    hint?: number,
  ): { point: THREE.Vector3; index: number } {
    const n = this.samples.length;
    const start =
      hint === undefined
        ? this.nearestIndex(pos)
        : this.nearestIndexNear(pos, hint);
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
    return { point: prev.clone().lerp(cur, t), index: i };
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
  heightAt(pos: THREE.Vector3, hint?: number): number {
    const n = this.samples.length;
    const i =
      hint === undefined
        ? this.nearestIndex(pos)
        : this.nearestIndexNear(pos, hint);
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
    const grassTex = TEX.grass();
    grassTex.repeat.set(90, 90);
    // Tint 55% toward white — the theme color still grades the generated
    // texture per circuit without crushing it to monochrome.
    const grassTint = new THREE.Color(this.theme.grass).lerp(new THREE.Color(0xffffff), 0.55);
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(1100, 1100),
      new THREE.MeshStandardMaterial({ map: grassTex, color: grassTint, roughness: 1 }),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.1; // clear of the road plane — avoids z-fighting
    grass.receiveShadow = true;
    this.group.add(grass);

    // Road ribbon: triangle strip between left/right road edges, UV'd so
    // the asphalt tile flows along the racing surface (~6 m per tile).
    const spacing = this.curve.getLength() / n;
    const roadPos: number[] = [];
    const roadUv: number[] = [];
    const roadIdx: number[] = [];
    const vTile = 6;
    for (let i = 0; i <= n; i++) {
      const s = this.samples[i % n];
      roadPos.push(
        s.point.x + s.left.x * hw, s.point.y, s.point.z + s.left.z * hw,
        s.point.x - s.left.x * hw, s.point.y, s.point.z - s.left.z * hw,
      );
      const v = (i * spacing) / vTile;
      roadUv.push(0, v, 1, v);
      if (i < n) {
        const a = i * 2;
        // CCW seen from +Y so normals face up (left edge = even verts).
        roadIdx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      }
    }
    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPos, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUv, 2));
    roadGeo.setIndex(roadIdx);
    roadGeo.computeVertexNormals();
    const asphalt = TEX.asphalt();
    asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
    const road = new THREE.Mesh(
      roadGeo,
      new THREE.MeshStandardMaterial({
        map: asphalt,
        color: new THREE.Color(0x8a92a0).lerp(new THREE.Color(0xffffff), 0.35),
        roughness: 0.85,
      }),
    );
    road.receiveShadow = true;
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
    // Bright accent rail along the wall top — reads as a continuous
    // painted lip, ties the circuit into the classic kart-racer look.
    const railMat = new THREE.MeshStandardMaterial({
      color: this.theme.night ? 0x35f0c8 : 0xe04a3a,
      // Night rail is the circuit's light line: pushed over the bloom gate
      // (~linear 1.0) so it glows on NEON NIGHT; the day rail stays matte.
      // 1.9 not higher — the rail is a continuous ribbon and big bloom
      // energy over a huge screen area reads as a glowing river (WS-POST).
      emissive: this.theme.night ? 0x28e8c0 : 0x481410,
      emissiveIntensity: this.theme.night ? 1.9 : 1.0,
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
      const railPos: number[] = [];
      const railIdx: number[] = [];
      for (let i = 0; i <= n; i++) {
        const s = this.samples[i % n];
        const z = this.zoneAt(i % n);
        const gapped = !!z && z.side === side;
        const bx = s.point.x + s.left.x * side * off;
        const bz = s.point.z + s.left.z * side * off;
        const base = wallPos.length / 3;
        wallPos.push(bx, s.point.y, bz, bx, s.point.y + h, bz);
        railPos.push(bx, s.point.y + h - 0.16, bz, bx, s.point.y + h, bz);
        // Emit quads only when this AND the next sample are both ungapped.
        if (i < n) {
          const zNext = this.zoneAt((i + 1) % n);
          const gapNext = !!zNext && zNext.side === side;
          if (!gapped && !gapNext) {
            const a = base;
            if (side > 0) wallIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
            else wallIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
            if (side > 0) railIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
            else railIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
          }
        }
      }
      const wallGeo = new THREE.BufferGeometry();
      wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
      wallGeo.setIndex(wallIdx);
      wallGeo.computeVertexNormals();
      const wallMesh = new THREE.Mesh(wallGeo, wallMat);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      this.group.add(wallMesh);
      const railGeo = new THREE.BufferGeometry();
      railGeo.setAttribute('position', new THREE.Float32BufferAttribute(railPos, 3));
      railGeo.setIndex(railIdx);
      railGeo.computeVertexNormals();
      this.group.add(new THREE.Mesh(railGeo, railMat));
    }

    // Gravel aprons: dirt ribbon from the road edge outward, plus a low berm
    // at the far edge (the new wall line). Reads as a rough cut-through.
    const gravelTex = TEX.gravel();
    gravelTex.wrapS = gravelTex.wrapT = THREE.RepeatWrapping;
    const gravelMat = new THREE.MeshStandardMaterial({
      map: gravelTex,
      color: 0xc8b090,
      roughness: 1,
      side: THREE.DoubleSide,
    });
    for (const z of this.gravelZones) {
      const gPos: number[] = [];
      const gUv: number[] = [];
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
        const v = (i * spacing) / 3;
        gUv.push(0, v, 1.4, v);
        if (i < i1) {
          gIdx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
        }
      }
      const gGeo = new THREE.BufferGeometry();
      gGeo.setAttribute('position', new THREE.Float32BufferAttribute(gPos, 3));
      gGeo.setAttribute('uv', new THREE.Float32BufferAttribute(gUv, 2));
      gGeo.setIndex(gIdx);
      gGeo.computeVertexNormals();
      const gravelMesh = new THREE.Mesh(gGeo, gravelMat);
      gravelMesh.receiveShadow = true;
      this.group.add(gravelMesh);
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
    const skirtTint = new THREE.Color(this.theme.skirt).lerp(new THREE.Color(0xffffff), 0.5);
    const skirtTex = TEX.grass();
    skirtTex.wrapS = skirtTex.wrapT = THREE.RepeatWrapping;
    const skirtMat = new THREE.MeshStandardMaterial({
      map: skirtTex,
      color: skirtTint,
      roughness: 1,
      side: THREE.DoubleSide,
    });
    for (const side of [1, -1]) {
      const skPos: number[] = [];
      const skUv: number[] = [];
      const skIdx: number[] = [];
      const inner = hw - 0.1;
      const outer = hw + 6;
      for (let i = 0; i <= n; i++) {
        const s = this.samples[i % n];
        skPos.push(
          s.point.x + s.left.x * side * inner, s.point.y, s.point.z + s.left.z * side * inner,
          s.point.x + s.left.x * side * outer, -0.35, s.point.z + s.left.z * side * outer,
        );
        const v = (i * spacing) / 5;
        skUv.push(0, v, 1.2, v);
        if (i < n) {
          const a = i * 2;
          if (side > 0) skIdx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
          else skIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
      const skGeo = new THREE.BufferGeometry();
      skGeo.setAttribute('position', new THREE.Float32BufferAttribute(skPos, 3));
      skGeo.setAttribute('uv', new THREE.Float32BufferAttribute(skUv, 2));
      skGeo.setIndex(skIdx);
      skGeo.computeVertexNormals();
      const skirtMesh = new THREE.Mesh(skGeo, skirtMat);
      skirtMesh.receiveShadow = true;
      this.group.add(skirtMesh);
    }

    // Start/finish stripe — checkered racing line.
    const s0 = this.samples[0];
    const checker = checkerTexture();
    checker.repeat.set(4, 1);
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(hw * 2, 2),
      new THREE.MeshStandardMaterial({ map: checker, roughness: 0.7 }),
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
    const bannerTex = checkerTexture();
    bannerTex.repeat.set(1.5, 1);
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(hw * 1.2, 1.0, 0.1),
      new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.7 }),
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
    // Thin box, not a bare plane — a plane reads as a floating shard
    // edge-on (critic8). The post grounds the board on the wall top.
    const chevGeo = new THREE.BoxGeometry(1.6, 0.9, 0.08);
    const chevPostGeo = new THREE.BoxGeometry(0.12, TRACK.wallHeight + 1.0, 0.12);
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0xffc23c,
      // Chevron boards glow at night (over the bloom gate); on day tracks
      // they keep the old flat amber — no bloom, no wash.
      emissive: this.theme.night ? 0xffa028 : 0xc07818,
      emissiveIntensity: this.theme.night ? 2.2 : 1.0,
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
        board.castShadow = true;
        const post = new THREE.Mesh(chevPostGeo, chevMat);
        post.position.copy(board.position).setY(
          s.point.y + (TRACK.wallHeight + 1.0) / 2 - 0.1,
        );
        post.rotation.y = board.rotation.y;
        arrow.position.copy(board.position);
        arrow.rotation.y = board.rotation.y;
        arrow.position.addScaledVector(s.tangent, -0.1); // in front of the board face
        // Chevron arrow: shear/tilt to point the turn direction.
        arrow.rotation.z = rightTurn ? -0.5 : 0.5;
        arrow.scale.x = rightTurn ? -1 : 1;
        this.group.add(board, arrow, post);
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
    // Ridge golden hour: the low sun + dark-olive hemisphere bounce left
    // prop backfaces near-black, reading as sky blobs at driver height.
    // A low emissive floor in the prop's own color keeps the shadow side
    // material-colored (way under the ~1.0 linear bloom gate). Ridge only —
    // PG's high day sun and NN's emissive night don't need the lift.
    const ridgeLift = this.signature === 'ridge';
    const trunkMat = new THREE.MeshStandardMaterial({
      color: this.theme.trunk,
      flatShading: true,
      emissive: ridgeLift ? this.theme.trunk : 0x000000,
      emissiveIntensity: ridgeLift ? 0.4 : 0,
    });
    const canopyMat = new THREE.MeshStandardMaterial({
      // instanceColor multiplies the base color — on ridge the base goes
      // near-white so the per-tree canopy tint reads as true canopy green
      // instead of canopy² (compounded the dark-blob problem).
      color: ridgeLift ? 0xf2f6ec : this.theme.canopy,
      flatShading: true,
      emissive: ridgeLift ? this.theme.canopy : 0x000000,
      emissiveIntensity: ridgeLift ? 0.32 : 0,
    });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCount);
    const rockGeo = new THREE.DodecahedronGeometry(0.9, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: this.theme.rock,
      flatShading: true,
      emissive: ridgeLift ? this.theme.rock : 0x000000,
      emissiveIntensity: ridgeLift ? 0.45 : 0,
    });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 40);
    // Grandstand footprint exclusion — the stand anchors at hw+20 left
    // of s0 with a ~22×10 m body; scattered pines/rocks must not stab
    // through it (critic8: trees clipped through the crowd tiers).
    const standAnchor = s0.point.clone().addScaledVector(s0.left, hw + 20);
    const nearStand = (p: THREE.Vector3) =>
      p.distanceToSquared(standAnchor) < 16 * 16;
    this.standPt.copy(standAnchor);
    this.spawnPt.copy(
      this.samples[Math.floor(this.samples.length * 0.01)].point,
    );
    let placed = 0;
    let guard = 0;
    while (placed < treeCount && guard++ < treeCount * 4) {
      const s = this.samples[Math.floor(rand() * n)];
      const side = rand() < 0.5 ? 1 : -1;
      const dist = hw + 3 + rand() * 30;
      const p = s.point.clone().addScaledVector(s.left, side * dist);
      // roadClearance re-tests against the NEAREST leg — folded layouts put
      // parallel legs inside the scatter band (and gravel aprons widen the
      // drivable edge on zone sides).
      if (nearStand(p) || this.nearStart(p) || this.roadClearance(p) < 1.4)
        continue;
      // fieldY measures the leg actually under the prop — on folded
      // sections the source sample isn't always the nearest (float fix).
      const gy = this.fieldY(p);
      const sc = 0.8 + rand() * 0.9;
      const rot = new THREE.Quaternion().setFromAxisAngle(up, rand() * Math.PI * 2);
      m.compose(p.clone().setY(gy + 0.8 * sc), rot, new THREE.Vector3(sc, sc, sc));
      trunks.setMatrixAt(placed, m);
      m.compose(p.clone().setY(gy + (1.6 + 1.6) * sc), rot, new THREE.Vector3(sc, sc, sc));
      canopies.setMatrixAt(placed, m);
      // Per-tree canopy hue shift — breaks the cloned-forest look.
      const tint = new THREE.Color(this.theme.canopy)
        .offsetHSL((rand() - 0.5) * 0.06, (rand() - 0.5) * 0.15, (rand() - 0.5) * 0.1);
      canopies.setColorAt(placed, tint);
      placed++;
    }
    let rocksPlaced = 0;
    for (let c = 0; c < 40; c++) {
      let s = this.samples[0];
      let dist = 0;
      const p = new THREE.Vector3();
      let ok = false;
      for (let retry = 0; retry < 8 && !ok; retry++) {
        s = this.samples[Math.floor(rand() * n)];
        const side = rand() < 0.5 ? 1 : -1;
        dist = hw + 4 + rand() * 24;
        p.copy(s.point).addScaledVector(s.left, side * dist);
        ok =
          !nearStand(p) &&
          !this.nearStart(p) &&
          this.roadClearance(p) >= 1.4;
      }
      if (!ok) continue; // all retries landed on a leg/exclusion — skip it
      const sc = 0.5 + rand() * 1.1;
      m.compose(
        p.setY(this.fieldY(p) + 0.4 * sc),
        new THREE.Quaternion().setFromAxisAngle(up, rand() * Math.PI * 2),
        new THREE.Vector3(sc, sc * 0.7, sc),
      );
      rocks.setMatrixAt(rocksPlaced++, m);
    }
    rocks.count = rocksPlaced;
    trunks.castShadow = true;
    canopies.castShadow = true;
    rocks.castShadow = true;
    trunks.userData.dress = 'trunks';
    canopies.userData.dress = 'canopies';
    rocks.userData.dress = 'rocks';
    this.group.add(trunks, canopies, rocks);

    this.buildGrandstand(s0, hw);
    this.buildBillboards(hw);
    this.buildFlags(s0, hw);
    this.buildBalloons();
    this.buildSignatureProps(hw, rand);
    this.buildDressing(hw, rand);
  }

  /** Prop-vs-camera clearance tests. nearStand keeps scatter out of the
   *  grandstand body; nearStart keeps the title orbit (5.2 m ring around
   *  the player spawn, h≈3.3) clear — ridge outcrops reached inside it
   *  and buried the title frame behind rock (critic8 D3 residual). */
  private nearStand(p: THREE.Vector3): boolean {
    const dx = p.x - this.standPt.x, dz = p.z - this.standPt.z;
    return dx * dx + dz * dz < 16 * 16;
  }
  private nearStart(p: THREE.Vector3): boolean {
    const dx = p.x - this.spawnPt.x, dz = p.z - this.spawnPt.z;
    return dx * dx + dz * dz < 25 * 25;
  }

  /**
   * Clearance (m) of p past the drivable edge on the NEAREST centerline leg
   * — positive means off the road/wall/gravel. Folded layouts put parallel
   * legs inside the scatter band, and gravel aprons widen the drivable edge
   * on zone sides, so every scatter candidate is re-tested here against the
   * whole track rather than trusting its source-sample lateral.
   */
  private roadClearance(p: THREE.Vector3): number {
    const i = this.nearestIndex(p);
    const { lateral } = this.query(p, i);
    const z = this.zoneAt(i);
    const edge =
      z && Math.sign(lateral) === z.side
        ? TRACK.roadHalfWidth + TRACK.gravelWidth + 0.9 // gravel apron + berm
        : TRACK.roadHalfWidth;
    return Math.abs(lateral) - edge;
  }

  /** Terrain height under a world point: skirt lerp measured from the leg
   *  actually beneath the prop — folded legs at different elevations made
   *  source-sample heights float props (critic8 D9 floated boards). */
  private fieldY(p: THREE.Vector3): number {
    const i = this.nearestIndex(p);
    const { lateral } = this.query(p, i);
    const s = this.samples[i];
    const t = THREE.MathUtils.clamp(
      (Math.abs(lateral) - TRACK.roadHalfWidth) / 6,
      0,
      1,
    );
    return THREE.MathUtils.lerp(s.point.y, -0.35, t) + 0.35;
  }

  /** Straightest sample index within frac range [f0,f1] passing `ok` —
   *  sites road-spanning set pieces (stone arch, neon gates) on real
   *  straights. Returns -1 when no candidate passes. */
  private straightSpot(
    f0: number,
    f1: number,
    ok?: (i: number) => boolean,
  ): number {
    const n = this.samples.length;
    let best = -1;
    let bestScore = -1;
    for (let i = Math.floor(f0 * n); i < Math.floor(f1 * n); i++) {
      const s = this.samples[i];
      if (this.nearStart(s.point) || this.nearStand(s.point)) continue;
      if (ok && !ok(i)) continue;
      const score = Math.abs(
        s.tangent.dot(this.samples[(i + 16) % n].tangent),
      );
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }

  /**
   * WS-DRESS density pass: per-theme second prop vocabulary (pastoral
   * meadows+fences, ridge strata+cairns+arch, neon gates+signs+columns).
   * All scatter flows through Props.scatter which re-tests every candidate
   * against the nearest leg's drivable edge plus the exclusion anchors.
   */
  private buildDressing(hw: number, rand: () => number): void {
    const n = this.samples.length;
    // Loop centroid — which lateral side faces the infield, per sample.
    const centroid = new THREE.Vector3();
    for (const s of this.samples) centroid.add(s.point);
    centroid.multiplyScalar(1 / n);
    const ctx: ScatterCtx = {
      samples: this.samples,
      hw,
      rand,
      canopy: this.theme.canopy,
      rock: this.theme.rock,
      night: !!this.theme.night,
      roadClearance: (p) => this.roadClearance(p),
      excluded: (p) => {
        if (this.nearStart(p) || this.nearStand(p)) return true;
        for (const a of this.avoidPts) {
          const dx = p.x - a.p.x, dz = p.z - a.p.z;
          if (dx * dx + dz * dz < a.r * a.r) return true;
        }
        return false;
      },
      avoid: (p, r) => this.avoidPts.push({ p: p.clone(), r }),
      fieldY: (p) => this.fieldY(p),
      innerSide: (s) =>
        s.left.x * (centroid.x - s.point.x) +
          s.left.z * (centroid.z - s.point.z) >=
        0
          ? 1
          : -1,
      straightSpot: (f0, f1, ok) => this.straightSpot(f0, f1, ok),
    };
    const dressed =
      this.signature === 'pastoral'
        ? dressPastoral(ctx)
        : this.signature === 'ridge'
          ? dressRidge(ctx)
          : this.signature === 'neon'
            ? dressNeon(ctx)
            : { objects: [], animated: [] };
    this.group.add(...dressed.objects);
    this.animated.push(...dressed.animated);
  }

  /** Per-circuit signature props — the authored landmark vocabulary. */
  private buildSignatureProps(hw: number, rand: () => number): void {
    const n = this.samples.length;
    const m = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0);
    // fieldY resolves the leg actually under each prop — correct on folded
    // sections where the source sample isn't the nearest.
    if (this.signature === 'pastoral') {
      // Flower meadows: instanced low blossoms scattered on the infield —
      // bright confetti dots that make PG read as a friendly garden circuit.
      const geo = new THREE.IcosahedronGeometry(0.16, 0);
      const mat = new THREE.MeshStandardMaterial({ flatShading: true });
      const COUNT = 220;
      const flowers = new THREE.InstancedMesh(geo, mat, COUNT);
      const palette = [0xffe14a, 0xff7ab0, 0xfaf6ea, 0xff9a3c, 0xc86ef0];
      let placed = 0;
      for (let c = 0; c < COUNT; c++) {
        const s = this.samples[Math.floor(rand() * n)];
        const side = rand() < 0.5 ? 1 : -1;
        const dist = hw + 1.5 + rand() * 22;
        const p = s.point.clone().addScaledVector(s.left, side * dist);
        if (
          this.nearStand(p) ||
          this.nearStart(p) ||
          this.roadClearance(p) < 1.0
        )
          continue;
        const sc = 0.6 + rand() * 1.0;
        m.compose(
          p.setY(this.fieldY(p) + 0.18 * sc),
          new THREE.Quaternion().setFromAxisAngle(up, rand() * Math.PI * 2),
          new THREE.Vector3(sc, sc * 0.7, sc),
        );
        flowers.setMatrixAt(placed, m);
        flowers.setColorAt(
          placed,
          new THREE.Color(palette[Math.floor(rand() * palette.length)]),
        );
        placed++;
      }
      flowers.count = placed;
      this.group.add(flowers);
    } else if (this.signature === 'ridge') {
      // Ridge outcrops: big clustered rock formations on corner outsides —
      // sells the dry-ridge scale the small scatter rocks can't. Band ≥hw+12
      // with a 12 m clearance margin: on plateau sections they sit on the
      // valley floor below the road instead of towering into the driver
      // frame as near-black masses (wave-7 reject). Emissive floor lifts
      // the sun-away faces to rock-brown in the low golden-hour light.
      const geo = new THREE.DodecahedronGeometry(1.4, 0);
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(this.theme.rock).lerp(
          new THREE.Color(0xffffff),
          0.12,
        ),
        emissive: this.theme.rock,
        emissiveIntensity: 0.45,
        flatShading: true,
      });
      const COUNT = 26;
      const outcrops = new THREE.InstancedMesh(geo, mat, COUNT);
      let placed = 0;
      let guard = 0;
      while (placed < COUNT && guard++ < COUNT * 10) {
        const s = this.samples[Math.floor(rand() * n)];
        const side = rand() < 0.5 ? 1 : -1;
        const dist = hw + 12 + rand() * 16;
        const p = s.point.clone().addScaledVector(s.left, side * dist);
        if (
          this.nearStand(p) ||
          this.nearStart(p) ||
          this.roadClearance(p) < 12
        )
          continue;
        // Scale cap ~2.4 → ≤~5 m tall; at the 18 m minimum distance that
        // subtends ~15° of driver frame, not a looming wall.
        const sc = 1.1 + rand() * 1.3;
        m.compose(
          p.setY(this.fieldY(p) + 0.5 * sc),
          new THREE.Quaternion().setFromAxisAngle(up, rand() * Math.PI * 2),
          new THREE.Vector3(sc, sc * (0.6 + rand() * 0.5), sc),
        );
        outcrops.setMatrixAt(placed, m);
        placed++;
      }
      outcrops.count = placed;
      outcrops.castShadow = true;
      this.group.add(outcrops);
    } else if (this.signature === 'neon') {
      // Neon pylons: emissive glow pillars alternating cyan/magenta along
      // the wall — the circuit's light rails at night. Two instanced
      // meshes because instanceColor can't tint emissive.
      const geo = new THREE.CylinderGeometry(0.14, 0.18, 2.4, 8);
      const mats = [0x36f0ff, 0xff4ad8].map(
        (e) =>
          new THREE.MeshStandardMaterial({
            color: 0x101418,
            emissive: e,
            // 2.0 pushes the pylon emissive over the bloom gate so the
            // posts read as neon tubes, not just bright sticks.
            emissiveIntensity: 2.0,
            roughness: 0.4,
          }),
      );
      const HALF = 32;
      const pylons = mats.map(
        (mm) => new THREE.InstancedMesh(geo, mm, HALF),
      );
      const counts = [0, 0];
      let ord = 0;
      for (let i = 0; i < n; i += Math.floor(n / HALF), ord++) {
        const s = this.samples[i];
        const z = this.zoneAt(i);
        for (const side of [1, -1]) {
          // Alternating run on each edge, opposite phase per side —
          // reads as paired light rails sweeping the circuit.
          const which = (ord + (side < 0 ? 1 : 0)) % 2;
          if (counts[which] >= HALF) continue;
          // Skip a pylon whose side opens onto a gravel apron — it would
          // stand on the drivable shortcut surface.
          if (z && z.side === side) continue;
          const p = s.point.clone().addScaledVector(s.left, side * (hw + 1.1));
          if (this.nearStart(p)) continue;
          m.compose(
            p.setY(s.point.y + 1.2),
            new THREE.Quaternion(),
            new THREE.Vector3(1, 1, 1),
          );
          pylons[which].setMatrixAt(counts[which]++, m);
        }
      }
      pylons.forEach((pl, k) => (pl.count = counts[k]));
      this.group.add(...pylons);
    }
  }

  // ---------- production scenery (wave 6+) ----------
  // Animated props register here; tick(simTime) advances them. The kind
  // union comes from Props.ts — 'sign'/'gate'/'arch'/'scrub' are WS-DRESS
  // tags; tick pulses emissive sign/gate materials and leaves the rest
  // idle-stable for the follow-up animation stream.
  private readonly animated: AnimatedProp[] = [];

  /** Stepped grandstand + crowd + flags beside the start line. */
  private buildGrandstand(s0: Sample, hw: number): void {
    const g = new THREE.Group();
    const standMat = new THREE.MeshStandardMaterial({ color: 0x8a93a2, roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xd8443c, roughness: 0.7 });
    const crowdMat = new THREE.MeshBasicMaterial({
      map: TEX.crowd(),
      side: THREE.DoubleSide,
    });
    // Three stepped tiers rising away from the track.
    for (let i = 0; i < 3; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(22, 1.2, 2.6), standMat);
      step.position.set(0, 0.6 + i * 1.5, i * 2.4);
      step.castShadow = true;
      g.add(step);
      const crowd = new THREE.Mesh(new THREE.PlaneGeometry(21, 1.3), crowdMat);
      crowd.position.set(0, 1.65 + i * 1.5, i * 2.4 - 1.28);
      crowd.rotation.x = -0.12;
      g.add(crowd);
    }
    // Canopy roof on slim posts.
    const roof = new THREE.Mesh(new THREE.BoxGeometry(23, 0.3, 7.5), roofMat);
    roof.position.set(0, 6.4, 2.4);
    roof.castShadow = true;
    g.add(roof);
    for (const px of [-10.5, 10.5]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5.8, 0.35), standMat);
      post.position.set(px, 3.2, 2.4);
      g.add(post);
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(1.3, 0.8),
        new THREE.MeshBasicMaterial({ color: 0xffd54a, side: THREE.DoubleSide }),
      );
      flag.position.set(px, 6.9, 2.4);
      g.add(flag);
      this.animated.push({ obj: flag, kind: 'flag', phase: px, baseY: 6.9 });
    }
    // Anchor: well outside the left wall at the start line — a backdrop
    // landmark, not a roadside object (was hw+9 and loomed over the track).
    const anchor = s0.point.clone().addScaledVector(s0.left, hw + 20);
    // Flat field height (y=0) — same float-on-elevation fix as billboards.
    g.position.set(anchor.x, 0, anchor.z);
    g.rotation.y = Math.atan2(s0.left.x, s0.left.z) + Math.PI / 2;
    // Face the crowd toward the track.
    g.rotateY(Math.PI);
    this.group.add(g);
  }

  /** Sponsor billboards around the circuit — generated poster art. */
  private buildBillboards(hw: number): void {
    const n = this.samples.length;
    const spots = [0.12, 0.3, 0.45, 0.58, 0.72, 0.86, 0.95];
    const postMat = new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 0.8 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x222833, roughness: 0.6 });
    for (let i = 0; i < spots.length; i++) {
      const idx = Math.floor(spots[i] * n);
      const s = this.samples[idx];
      const side = i % 2 === 0 ? 1 : -1;
      // A board inside the title-orbit ring swallows the intro camera —
      // drop the spot rather than fight the framing (critic8 residual).
      const px = s.point.x + s.left.x * side * (hw + 7);
      const pz = s.point.z + s.left.z * side * (hw + 7);
      const sdx = px - this.spawnPt.x, sdz = pz - this.spawnPt.z;
      if (sdx * sdx + sdz * sdz < 24 * 24) continue;
      const g = new THREE.Group();
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.4, 0.5), postMat);
      post.position.y = 2.2;
      g.add(post);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.4, 0.25), frameMat);
      frame.position.y = 5.6;
      frame.castShadow = true;
      g.add(frame);
      const art = new THREE.Mesh(
        new THREE.PlaneGeometry(6.8, 3.0),
        new THREE.MeshBasicMaterial({ map: TEX.billboards[i % TEX.billboards.length]() }),
      );
      art.position.set(0, 5.6, 0.14);
      g.add(art);
      // Poster on the back face too — the looped track exposes the back
      // constantly, and a bare frame read as a black monolith (critic8).
      const back = art.clone();
      back.position.z = -0.14;
      back.rotation.y = Math.PI;
      g.add(back);
      const pos = s.point.clone().addScaledVector(s.left, side * (hw + 7));
      // Register the board's footprint so WS-DRESS scatter never stabs a
      // shrub/fence through the frame.
      this.avoidPts.push({ p: pos.clone(), r: 5 });
      // Sit on the flat field (y=0 beyond the skirt), not road height —
      // on elevated sections the old s.point.y floated the post (critic8).
      g.position.set(pos.x, 0, pos.z);
      // Face back along the travel direction so drivers see it on approach.
      g.rotation.y = Math.atan2(-s.tangent.x, -s.tangent.z) + (side > 0 ? 0.35 : -0.35);
      this.group.add(g);
    }
  }

  /** Waving pennant flags on the start gantry posts. */
  private buildFlags(s0: Sample, hw: number): void {
    const flagMat = new THREE.MeshBasicMaterial({
      color: 0xff8a3a, side: THREE.DoubleSide,
    });
    for (const side of [1, -1]) {
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), flagMat.clone());
      flag.position
        .copy(s0.point)
        .addScaledVector(s0.left, side * (hw + 1.2))
        .setY(s0.point.y + 6.2);
      this.group.add(flag);
      this.animated.push({ obj: flag, kind: 'flag', phase: side * 2.1, baseY: s0.point.y + 6.2 });
    }
  }

  /** Hot-air balloons drifting far overhead — pure kart-racer dressing. */
  private buildBalloons(): void {
    const stripe = (a: string, b: string) => {
      const cv = document.createElement('canvas');
      cv.width = 64; cv.height = 32;
      const g = cv.getContext('2d')!;
      for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 ? a : b;
        g.fillRect(i * 8, 0, 8, 32);
      }
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const palettes: [string, string][] = [
      ['#ff5a4a', '#f4f0e8'], ['#3fd8ff', '#f4f0e8'], ['#ffd54a', '#7a4ad8'],
    ];
    const rng = (() => { let s = 9001; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff); })();
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const env = new THREE.Mesh(
        new THREE.SphereGeometry(4, 14, 12),
        new THREE.MeshStandardMaterial({ map: stripe(...palettes[i % 3]), roughness: 0.8 }),
      );
      env.scale.y = 1.15;
      g.add(env);
      const basket = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 1.0, 1.4),
        new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1 }),
      );
      basket.position.y = -5.6;
      g.add(basket);
      const a = rng() * Math.PI * 2;
      const r = 120 + rng() * 160;
      g.position.set(Math.cos(a) * r, 55 + rng() * 45, Math.sin(a) * r);
      this.group.add(g);
      this.animated.push({ obj: g, kind: 'balloon', phase: rng() * 6.28, baseY: g.position.y });
    }
  }

  /** Advance ambient animations (flag flutter, balloon bob/drift, neon
   *  sign/gate emissive breathing). 'arch'/'scrub' stay tagged + idle for
   *  the follow-up animation stream. */
  tick(simTime: number): void {
    for (const a of this.animated) {
      if (a.kind === 'flag') {
        a.obj.rotation.y = Math.sin(simTime * 3.1 + a.phase) * 0.45;
        a.obj.rotation.z = Math.sin(simTime * 5.3 + a.phase * 2) * 0.12;
      } else if (a.kind === 'balloon') {
        a.obj.position.y = a.baseY + Math.sin(simTime * 0.4 + a.phase) * 3;
        a.obj.position.x += Math.sin(simTime * 0.05 + a.phase) * 0.004;
        a.obj.rotation.y = simTime * 0.03 + a.phase;
      } else if (a.kind === 'sign' || a.kind === 'gate') {
        // Neon breathing: whole instanced mesh shares one material, so a
        // single intensity write pulses every panel/bar together. baseY
        // carries the resting emissiveIntensity; amplitude stays over the
        // ~1.0 linear bloom gate on the night circuit.
        const mat = (a.obj as THREE.InstancedMesh)
          .material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity =
          a.baseY + Math.sin(simTime * 2.2 + a.phase) * 0.22;
      }
    }
  }
}
