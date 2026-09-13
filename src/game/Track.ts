import * as THREE from 'three';
import { TRACK } from '../config/tuning';

// Test track: a closed Catmull-Rom circuit ("Proving Grounds").
// Provides the road/barrier meshes plus a sampled centerline lookup used for
// kart constraint (on-road test + wall push-back). Flat for the Wave 1 slice;
// elevation becomes its own quality unit.

// Control points (XZ, meters). Roughly a 190×100 m circuit: long back
// straight, sweeping right hander, S-curves, hairpin. Clockwise.
const CONTROL_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [55, 0],
  [88, 8],
  [102, 32],
  [92, 58],
  [62, 66],
  [52, 88],
  [24, 96],
  [-4, 86],
  [-18, 62],
  [-34, 48],
  [-48, 60],
  [-70, 58],
  [-84, 38],
  [-78, 14],
  [-56, 4],
  [-30, -6],
  [-12, -4],
];

interface Sample {
  point: THREE.Vector3;
  tangent: THREE.Vector3;
  left: THREE.Vector3; // unit vector toward TRUE road-left (driver's left)
}

export class Track {
  readonly group = new THREE.Group();
  private readonly curve: THREE.CatmullRomCurve3;
  private readonly samples: Sample[] = [];

  constructor() {
    this.curve = new THREE.CatmullRomCurve3(
      CONTROL_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      true,
      'centripetal',
    );
    this.buildSamples();
    this.buildMeshes();
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
  private nearestIndex(pos: THREE.Vector3): number {
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

  /** Push a position back inside the road if it exceeds the drivable edge. */
  constrain(pos: THREE.Vector3): { lateral: number; clamped: boolean } {
    const { lateral } = this.query(pos);
    const limit = TRACK.roadHalfWidth - 0.9; // kart half-width + margin
    if (Math.abs(lateral) <= limit) return { lateral, clamped: false };
    const i = this.nearestIndex(pos);
    const s = this.samples[i];
    pos.copy(s.point).addScaledVector(s.left, Math.sign(lateral) * limit);
    return { lateral: Math.sign(lateral) * limit, clamped: true };
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
        s.point.x + s.left.x * hw, 0, s.point.z + s.left.z * hw,
        s.point.x - s.left.x * hw, 0, s.point.z - s.left.z * hw,
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
          s.point.clone().addScaledVector(s.left, side * (hw + 0.2)).setY(0.06),
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
      const off = hw + 0.35;
      const h = TRACK.wallHeight;
      for (let i = 0; i <= n; i++) {
        const s = this.samples[i % n];
        const bx = s.point.x + s.left.x * side * off;
        const bz = s.point.z + s.left.z * side * off;
        wallPos.push(bx, 0, bz, bx, h, bz);
        if (i < n) {
          const a = i * 2;
          // CCW when viewed from the road side.
          if (side > 0) wallIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
          else wallIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
      const wallGeo = new THREE.BufferGeometry();
      wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
      wallGeo.setIndex(wallIdx);
      wallGeo.computeVertexNormals();
      this.group.add(new THREE.Mesh(wallGeo, wallMat));
    }

    // Start/finish stripe.
    const s0 = this.samples[0];
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(hw * 2, 2),
      new THREE.MeshStandardMaterial({ color: 0xf5f5f5 }),
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.rotation.z = -Math.atan2(s0.tangent.x, s0.tangent.z) + Math.PI / 2;
    stripe.position.copy(s0.point).setY(0.03); // above road, below wheels
    this.group.add(stripe);
  }
}
