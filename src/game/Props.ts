import * as THREE from 'three';
import { SCENERY } from '../config/tuning';

// Set-dressing prop factories (WS-DRESS). Everything here is procedural and
// instanced — flat-shaded low-poly matching the existing scenery. Each theme
// gets a distinct second vocabulary so the circuits silhouette differently:
//   pastoral — tall flowers, shrubs, hay bales, orchard trees, wood fences
//   ridge    — strata slabs, stacked cairns, dry scrub, snags, a stone arch
//   neon     — road-spanning glow gates, sign boards, holo columns, crates,
//              runway studs
// Placement safety lives in the ScatterCtx: every candidate is re-tested
// against the NEAREST centerline leg (folded layouts put parallel legs
// inside the scatter band), the start-orbit/stand exclusions, and any
// authored-prop exclusion circles registered via ctx.avoid().

export interface ScatterSample {
  point: THREE.Vector3;
  tangent: THREE.Vector3;
  left: THREE.Vector3; // unit vector toward true road-left
}

/** Animated-prop registry entry — Track.animated consumes these. New kinds
 *  beyond 'flag'/'balloon' are tags for the follow-up animation stream;
 *  unknown kinds are left idle-stable by tick(). */
export type AnimatedKind =
  | 'flag'
  | 'balloon'
  | 'sign'
  | 'arch'
  | 'gate'
  | 'scrub'
  // WS-ANIM kinds:
  | 'crowd' // instanced bobbing heads over the grandstand tiers
  | 'crowdUV' // subtle UV wobble on the shared crowd texture
  | 'sway' // instanced canopy micro-oscillation (wind)
  | 'spin' // continuous rotation — rotating boards, windmill rotor
  | 'scan'; // UV offset.y scroll — NN holo-pylon scanline

export interface AnimatedProp {
  obj: THREE.Object3D;
  kind: AnimatedKind;
  phase: number;
  baseY: number;
  /** 'spin': rotation axis (default 'y'). */
  axis?: 'x' | 'y' | 'z';
  /** 'spin': rad/s (default 0.25). 'scan': texture rows/s (default 0.35).
   *  'sway': amplitude multiplier (default 1). */
  speed?: number;
}

/** Per-instance animation payload hung on InstancedMesh.userData.anim by
 *  the builders; tick() recomposes matrices from it — zero per-frame
 *  allocation. 'crowd' packs stride 3 (x,y,z); 'sway' packs stride 7
 *  (x,y,z,yaw,sx,sy,sz). */
export interface InstanceAnim {
  base: Float32Array;
  phase: Float32Array;
}

export interface ScatterCtx {
  samples: readonly ScatterSample[];
  /** Road half width (m). */
  hw: number;
  rand: () => number;
  /** Theme hooks so shared factories tint per circuit. */
  canopy: number;
  rock: number;
  night: boolean;
  /** Clearance (m) past the drivable edge on the leg NEAREST p — positive
   *  means off the road/wall/gravel. Rejects band candidates that land on
   *  a folded sibling leg or a shortcut apron. */
  roadClearance(p: THREE.Vector3): number;
  /** Exclusion anchors: title-orbit ring, grandstand footprint, and any
   *  circles registered via avoid(). */
  excluded(p: THREE.Vector3): boolean;
  /** Register an extra exclusion circle (arches, gates, sign clusters). */
  avoid(p: THREE.Vector3, r: number): void;
  /** Terrain height under a world point — resolves the leg actually under
   *  the prop so nothing floats on elevated/terraced sections. */
  fieldY(p: THREE.Vector3): number;
  /** +1 when the loop interior lies to this sample's left, else -1 — used
   *  to weight 'inner' scatter into the infield. */
  innerSide(s: ScatterSample): number;
  /** Index of the straightest centerline sample within frac range
   *  [f0, f1] that passes the optional predicate — used to site road-
   *  spanning set pieces (stone arch, neon gates) on real straights. */
  straightSpot(f0: number, f1: number, ok?: (i: number) => boolean): number;
}

export interface DressResult {
  objects: THREE.Object3D[];
  animated: AnimatedProp[];
}

export interface ScatterOpts {
  /** Lateral band (abs m from centerline). Defaults to SCENERY band. */
  min?: number;
  max?: number;
  /** Min clearance past the drivable edge on the nearest leg. */
  margin?: number;
  /** Which lateral side: random, or biased to the loop interior/exterior. */
  side?: 'both' | 'inner' | 'outer';
}

/** Generic safe scatter: picks random sample/side/distance inside the band
 *  and calls `place` only for candidates that clear every leg's drivable
 *  edge plus all exclusion anchors. Returns the number placed. */
export function scatter(
  ctx: ScatterCtx,
  count: number,
  opts: ScatterOpts,
  place: (p: THREE.Vector3, s: ScatterSample, dist: number, side: number) => void,
): number {
  const n = ctx.samples.length;
  const min = opts.min ?? SCENERY.bandMin;
  const max = opts.max ?? SCENERY.bandMax;
  const margin = opts.margin ?? SCENERY.margin;
  let placed = 0;
  let guard = 0;
  while (placed < count && guard++ < count * 8) {
    const s = ctx.samples[Math.floor(ctx.rand() * n)];
    const side =
      opts.side === 'inner'
        ? ctx.innerSide(s)
        : opts.side === 'outer'
          ? -ctx.innerSide(s)
          : ctx.rand() < 0.5
            ? 1
            : -1;
    const dist = min + ctx.rand() * (max - min);
    const p = s.point.clone().addScaledVector(s.left, side * dist);
    if (ctx.excluded(p) || ctx.roadClearance(p) < margin) continue;
    place(p, s, dist, side);
    placed++;
  }
  return placed;
}

// ---------- shared scratch + small factories ----------
const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);

function yawQuat(s: ScatterSample): THREE.Quaternion {
  return Q.setFromAxisAngle(UP, Math.atan2(s.tangent.x, s.tangent.z));
}

// ============================ PASTORAL ============================
export function dressPastoral(ctx: ScatterCtx): DressResult {
  const objects: THREE.Object3D[] = [];
  const animated: AnimatedProp[] = [];
  const S = SCENERY.pastoral;
  const rand = ctx.rand;
  const hw = ctx.hw;

  // Tall stem flowers: green stalk + bright blossom head — vertical meadow
  // accents the low confetti flowers can't provide. Two instanced meshes.
  const stemGeo = new THREE.CylinderGeometry(0.035, 0.055, 0.95, 5);
  const stemMat = new THREE.MeshStandardMaterial({
    color: 0x3f7a34,
    flatShading: true,
  });
  const headGeo = new THREE.IcosahedronGeometry(0.17, 0);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, // tinted per-instance
    flatShading: true,
  });
  const stems = new THREE.InstancedMesh(stemGeo, stemMat, S.tallFlowers);
  const heads = new THREE.InstancedMesh(headGeo, headMat, S.tallFlowers);
  const petals = [0xffe14a, 0xff7ab0, 0xfaf6ea, 0xff9a3c, 0xc86ef0, 0xff5a4a];
  let fi = 0;
  const placeFlower = (p: THREE.Vector3) => {
    const gy = ctx.fieldY(p);
    const sc = 0.7 + rand() * 0.9;
    const tilt = (rand() - 0.5) * 0.35;
    Q.setFromAxisAngle(UP, rand() * Math.PI * 2);
    M.compose(
      p.clone().setY(gy + 0.45 * sc),
      Q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(X_AXIS, tilt)),
      new THREE.Vector3(sc, sc, sc),
    );
    stems.setMatrixAt(fi, M);
    M.compose(
      p.clone().setY(gy + 0.98 * sc),
      Q,
      new THREE.Vector3(sc, sc, sc),
    );
    heads.setMatrixAt(fi, M);
    heads.setColorAt(
      fi,
      new THREE.Color(petals[Math.floor(rand() * petals.length)]),
    );
    fi++;
  };
  scatter(ctx, Math.floor(S.tallFlowers * 0.6), { max: hw + 26 }, placeFlower);
  scatter(
    ctx,
    S.tallFlowers - fi,
    { max: hw + 30, side: 'inner', margin: 2 },
    placeFlower,
  );
  stems.count = heads.count = fi;
  objects.push(stems, heads);

  // Rounded shrubs — instanced squashed icosahedra in canopy greens,
  // weighted into the infield so the loop interior isn't bald.
  const bushGeo = new THREE.IcosahedronGeometry(0.85, 0);
  const bushMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    flatShading: true,
  });
  const bushes = new THREE.InstancedMesh(bushGeo, bushMat, S.bushes);
  const bushPalette = [0x3e8a4e, 0x35793f, 0x4a9a44, ctx.canopy, 0x5a8a3a];
  let bi = 0;
  const placeBush = (p: THREE.Vector3) => {
    const gy = ctx.fieldY(p);
    const sc = 0.6 + rand() * 1.3;
    M.compose(
      p.clone().setY(gy + 0.4 * sc),
      Q.setFromAxisAngle(UP, rand() * Math.PI * 2),
      new THREE.Vector3(sc, sc * (0.55 + rand() * 0.25), sc),
    );
    bushes.setMatrixAt(bi, M);
    bushes.setColorAt(
      bi,
      new THREE.Color(bushPalette[Math.floor(rand() * bushPalette.length)])
        .offsetHSL(0, (rand() - 0.5) * 0.1, (rand() - 0.5) * 0.08),
    );
    bi++;
  };
  scatter(ctx, Math.floor(S.bushes * 0.55), { margin: 1.8 }, placeBush);
  scatter(ctx, S.bushes - bi, { side: 'inner', margin: 2 }, placeBush);
  bushes.count = bi;
  objects.push(bushes);

  // Hay bales — straw cylinders on their sides, farm-circuit dressing.
  const baleGeo = new THREE.CylinderGeometry(0.72, 0.72, 1.35, 9);
  baleGeo.rotateZ(Math.PI / 2); // axis along X — lying on its side
  const baleMat = new THREE.MeshStandardMaterial({
    color: 0xd8b45a,
    flatShading: true,
    roughness: 1,
  });
  const bales = new THREE.InstancedMesh(baleGeo, baleMat, S.hayBales);
  let hi = 0;
  scatter(
    ctx,
    S.hayBales,
    { min: hw + 2, max: hw + 32, margin: 1.8 },
    (p, s) => {
      const gy = ctx.fieldY(p);
      const sc = 0.8 + rand() * 0.5;
      M.compose(
        p.clone().setY(gy + 0.62 * sc),
        yawQuat(s)
          .clone()
          .multiply(Q.setFromAxisAngle(UP, (rand() - 0.5) * 1.2)),
        new THREE.Vector3(sc, sc, sc),
      );
      bales.setMatrixAt(hi, M);
      bales.setColorAt(
        hi,
        new THREE.Color(0xd8b45a).offsetHSL(0, 0, (rand() - 0.5) * 0.12),
      );
      hi++;
    },
  );
  bales.count = hi;
  bales.castShadow = true;
  objects.push(bales);

  // Orchard trees — round flattened-canopy second species vs the cloned
  // pines; reads as a tended garden circuit.
  const oTrunkGeo = new THREE.CylinderGeometry(0.24, 0.34, 1.7, 6);
  const oCanopyGeo = new THREE.IcosahedronGeometry(1.9, 0);
  const oTrunkMat = new THREE.MeshStandardMaterial({
    color: 0x7a5232,
    flatShading: true,
  });
  const oCanopyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    flatShading: true,
  });
  const oTrunks = new THREE.InstancedMesh(oTrunkGeo, oTrunkMat, S.orchardTrees);
  const oCanopies = new THREE.InstancedMesh(
    oCanopyGeo,
    oCanopyMat,
    S.orchardTrees,
  );
  // WS-ANIM: per-instance sway payload — stride 7 (x,y,z,yaw,sx,sy,sz) +
  // phase. Phase derives from yaw/scale (NOT rand()) so the scatter RNG
  // stream — and therefore prop placement — is unchanged vs baseline.
  const oSway: InstanceAnim = {
    base: new Float32Array(S.orchardTrees * 7),
    phase: new Float32Array(S.orchardTrees),
  };
  const orchardPalette = [0x4a9a44, 0x5aab4e, 0x3e8a4e, 0x6aa040];
  let oi = 0;
  scatter(
    ctx,
    S.orchardTrees,
    { min: hw + 4, max: hw + 44, margin: 2 },
    (p) => {
      const gy = ctx.fieldY(p);
      const sc = 0.85 + rand() * 0.8;
      const yaw = rand() * Math.PI * 2;
      const rot = Q.setFromAxisAngle(UP, yaw).clone();
      M.compose(
        p.clone().setY(gy + 0.85 * sc),
        rot,
        new THREE.Vector3(sc, sc, sc),
      );
      oTrunks.setMatrixAt(oi, M);
      const cy = gy + (1.7 + 1.15) * sc;
      M.compose(
        p.clone().setY(cy),
        rot,
        new THREE.Vector3(sc, sc * 0.8, sc),
      );
      oCanopies.setMatrixAt(oi, M);
      oCanopies.setColorAt(
        oi,
        new THREE.Color(
          orchardPalette[Math.floor(rand() * orchardPalette.length)],
        ).offsetHSL((rand() - 0.5) * 0.04, (rand() - 0.5) * 0.12, 0),
      );
      const j = oi * 7;
      oSway.base[j] = p.x;
      oSway.base[j + 1] = cy;
      oSway.base[j + 2] = p.z;
      oSway.base[j + 3] = yaw;
      oSway.base[j + 4] = sc;
      oSway.base[j + 5] = sc * 0.8;
      oSway.base[j + 6] = sc;
      oSway.phase[oi] = yaw * 1.618 + sc * 2.3;
      oi++;
    },
  );
  oTrunks.count = oCanopies.count = oi;
  oTrunks.castShadow = true;
  oCanopies.castShadow = true;
  oCanopies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  oCanopies.userData.anim = oSway;
  objects.push(oTrunks, oCanopies);
  // Round canopies are light foliage — sway a touch wider than the pines.
  animated.push({ obj: oCanopies, kind: 'sway', phase: 0, baseY: 0, speed: 1.3 });

  // Wooden fence runs — posts + two rails hugging gentle stretches. Built
  // from collected matrices because run length adapts to clearance.
  const postGeo = new THREE.BoxGeometry(0.14, 0.95, 0.14);
  const railGeo = new THREE.BoxGeometry(1, 0.09, 0.05);
  const fenceMat = new THREE.MeshStandardMaterial({
    color: 0x8a6a42,
    roughness: 1,
  });
  const postMats: THREE.Matrix4[] = [];
  const railMats: THREE.Matrix4[] = [];
  const n = ctx.samples.length;
  for (let r = 0; r < S.fenceRuns; r++) {
    const start = Math.floor(rand() * n);
    const s0 = ctx.samples[start];
    // Fences mostly line the outfield edge — infield stays open meadow.
    const side = rand() < 0.7 ? -ctx.innerSide(s0) : ctx.innerSide(s0);
    const len =
      S.fenceLenMin + Math.floor(rand() * (S.fenceLenMax - S.fenceLenMin));
    let prev: THREE.Vector3 | null = null;
    let prevY = 0;
    for (let k = 0; k < len; k += 5) {
      const s = ctx.samples[(start + k) % n];
      const p = s.point.clone().addScaledVector(s.left, side * (hw + 2.7));
      // A fence may cross a gravel apron mouth — drop that post (and the
      // rails into it) rather than stab through the drivable dirt.
      if (ctx.excluded(p) || ctx.roadClearance(p) < 1.6) {
        prev = null;
        continue;
      }
      const gy = ctx.fieldY(p);
      const postY = gy + 0.42;
      M.compose(
        p.clone().setY(postY),
        yawQuat(s),
        new THREE.Vector3(1, 1, 1),
      );
      postMats.push(M.clone());
      if (prev) {
        for (const ry of [0.28, 0.66]) {
          const pa = prev.clone().setY(prevY - 0.42 + ry);
          const pb = p.clone().setY(gy + ry);
          const d = pb.clone().sub(pa);
          const segLen = d.length();
          if (segLen < 0.5 || segLen > 5) continue;
          Q.setFromUnitVectors(X_AXIS, d.normalize());
          M.compose(
            pa.clone().add(pb).multiplyScalar(0.5),
            Q,
            new THREE.Vector3(segLen, 1, 1),
          );
          railMats.push(M.clone());
        }
      }
      prev = p;
      prevY = postY;
    }
  }
  const posts = new THREE.InstancedMesh(postGeo, fenceMat, postMats.length);
  postMats.forEach((mm, i) => posts.setMatrixAt(i, mm));
  const rails = new THREE.InstancedMesh(railGeo, fenceMat, railMats.length);
  railMats.forEach((mm, i) => rails.setMatrixAt(i, mm));
  posts.castShadow = true;
  rails.castShadow = true;
  objects.push(posts, rails);

  objects.forEach((o) => (o.userData.dress = 'pastoral'));
  return { objects, animated };
}

// ============================= RIDGE =============================
export function dressRidge(ctx: ScatterCtx): DressResult {
  const objects: THREE.Object3D[] = [];
  const animated: AnimatedProp[] = [];
  const S = SCENERY.ridge;
  const rand = ctx.rand;
  const hw = ctx.hw;

  // Lifted rock materials — SR runs a low golden-hour sun whose hemisphere
  // ground bounce is dark olive, so sun-away faces of big rock props went
  // near-black and read as sky blobs (wave-7 integration reject). A rock-
  // colored emissive floor (~0.45, far under the ~1.0 linear bloom gate)
  // keeps backlit faces warm brown; flat shading still reads the facets.
  // Instanced meshes get a near-white base — instanceColor MULTIPLIES the
  // material color, so a rock-colored base would square the tone (rock² is
  // what made slabs read so dark). Non-instanced props use `rockSolid`.
  const rockLift = new THREE.MeshStandardMaterial({
    color: 0xf5efe8,
    emissive: ctx.rock,
    emissiveIntensity: 0.45,
    flatShading: true,
    roughness: 1,
  });
  const rockSolid = new THREE.MeshStandardMaterial({
    color: new THREE.Color(ctx.rock).lerp(new THREE.Color(0xffffff), 0.12),
    emissive: ctx.rock,
    emissiveIntensity: 0.45,
    flatShading: true,
    roughness: 1,
  });
  // Big ridge props live at ≥ ~hw+12 from EVERY leg — on plateau sections
  // that drops them onto the valley floor below the road instead of letting
  // them tower into the driver frame. Scrub stays close (it's knee-high).
  const BIG_MARGIN = 12;

  // Strata slabs — tilted layered plates, the ridge's geology signature.
  const slabGeo = new THREE.BoxGeometry(2.3, 0.5, 1.5);
  const slabs = new THREE.InstancedMesh(slabGeo, rockLift, S.strataSlabs);
  let si = 0;
  scatter(ctx, S.strataSlabs, { min: hw + 12, margin: BIG_MARGIN }, (p) => {
    const gy = ctx.fieldY(p);
    // Scale cap ~1.6: at the 18 m min distance a max slab subtends ~15° of
    // driver frame, not a wall of rock.
    const sc = 0.7 + rand() * 0.9;
    Q.setFromAxisAngle(UP, rand() * Math.PI * 2);
    // Bedding-plane tilt — slabs read as exposed strata, not crates.
    Q.multiply(
      new THREE.Quaternion().setFromAxisAngle(X_AXIS, (rand() - 0.5) * 0.5),
    );
    M.compose(
      // Base buried ~0.3 of the slab height — the tilt otherwise left the
      // high corner hovering over the dirt, reading as a floating wedge
      // against the sky (critic9 floating-prop fix).
      p.clone().setY(gy - 0.06 * sc),
      Q,
      new THREE.Vector3(sc, sc * (0.7 + rand() * 0.5), sc),
    );
    slabs.setMatrixAt(si, M);
    // Instance tint carries the full rock tone (base is near-white) —
    // variation only in lightness, and biased bright vs the old rock².
    slabs.setColorAt(
      si,
      new THREE.Color(ctx.rock).offsetHSL(0, 0, rand() * 0.1),
    );
    si++;
  });
  slabs.count = si;
  slabs.castShadow = true;
  objects.push(slabs);

  // Cairns — 3 stacked stones per marker; trail-language for a ridge course.
  const stoneGeo = new THREE.DodecahedronGeometry(0.55, 0);
  const cairnStones = new THREE.InstancedMesh(
    stoneGeo,
    rockLift,
    S.cairns * 3,
  );
  let ci = 0;
  scatter(
    ctx,
    S.cairns,
    { min: hw + 12, max: hw + 40, margin: BIG_MARGIN },
    (p) => {
    const gy = ctx.fieldY(p);
    let y = gy;
    for (let t = 0; t < 3; t++) {
      const sc = (1.0 - t * 0.28) * (0.9 + rand() * 0.5);
      y += 0.34 * sc;
      M.compose(
        p
          .clone()
          .add(
            new THREE.Vector3((rand() - 0.5) * 0.2, 0, (rand() - 0.5) * 0.2),
          )
          .setY(y),
        Q.setFromAxisAngle(UP, rand() * Math.PI * 2),
        new THREE.Vector3(sc, sc * 0.72, sc),
      );
      cairnStones.setMatrixAt(ci, M);
      cairnStones.setColorAt(
        ci,
        new THREE.Color(ctx.rock).offsetHSL(0, 0, rand() * 0.1),
      );
      y += 0.3 * sc;
      ci++;
    }
  });
  cairnStones.count = ci;
  cairnStones.castShadow = true;
  objects.push(cairnStones);

  // Dry scrub tufts — small squashed cones in straw tones; tagged 'scrub'
  // for the animation stream (idle-stable for now).
  const scrubGeo = new THREE.ConeGeometry(0.42, 0.6, 5);
  const scrubMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    flatShading: true,
    roughness: 1,
  });
  const scrub = new THREE.InstancedMesh(scrubGeo, scrubMat, S.scrub);
  const scrubPalette = [0xb8a050, 0xa8903f, 0xc0b060, 0x9a8848];
  let ti = 0;
  scatter(ctx, S.scrub, { margin: 1.4 }, (p) => {
    const gy = ctx.fieldY(p);
    const sc = 0.6 + rand() * 1.1;
    M.compose(
      p.clone().setY(gy + 0.2 * sc),
      Q.setFromAxisAngle(UP, rand() * Math.PI * 2),
      new THREE.Vector3(sc * (0.8 + rand() * 0.6), sc * 0.75, sc),
    );
    scrub.setMatrixAt(ti, M);
    scrub.setColorAt(
      ti,
      new THREE.Color(scrubPalette[Math.floor(rand() * scrubPalette.length)]),
    );
    ti++;
  });
  scrub.count = ti;
  objects.push(scrub);
  animated.push({ obj: scrub, kind: 'scrub', phase: 0, baseY: 0 });

  // Snags — bare dead-trunk spikes, silhouette variety vs the pines.
  // Lighter dry-wood brown + emissive floor so the backlit side stays
  // readable at distance instead of going silhouette-black.
  const snagGeo = new THREE.CylinderGeometry(0.1, 0.3, 2.8, 5);
  const snagMat = new THREE.MeshStandardMaterial({
    color: 0x6a4f3a,
    emissive: 0x5a4030,
    emissiveIntensity: 0.4,
    flatShading: true,
    roughness: 1,
  });
  const snags = new THREE.InstancedMesh(snagGeo, snagMat, S.snags);
  let gi = 0;
  scatter(
    ctx,
    S.snags,
    { min: hw + 12, max: hw + 42, margin: BIG_MARGIN },
    (p) => {
    const gy = ctx.fieldY(p);
    const sc = 0.7 + rand() * 0.8;
    Q.setFromAxisAngle(UP, rand() * Math.PI * 2);
    Q.multiply(
      new THREE.Quaternion().setFromAxisAngle(X_AXIS, (rand() - 0.5) * 0.24),
    );
    M.compose(
      p.clone().setY(gy + 1.2 * sc),
      Q,
      new THREE.Vector3(sc, sc, sc),
    );
    snags.setMatrixAt(gi, M);
    gi++;
  });
  snags.count = gi;
  snags.castShadow = true;
  objects.push(snags);

  // Stone arch over the straightest post-start stretch — the ridge's big
  // authored landmark. Lintel underside sits ~4.5 m over the road surface;
  // pillars stand well outside the walls.
  const ai = ctx.straightSpot(0.05, 0.16, (i) => {
    const s = ctx.samples[i];
    for (const side of [1, -1]) {
      const p = s.point.clone().addScaledVector(s.left, side * (hw + 2.6));
      if (ctx.excluded(p) || ctx.roadClearance(p) < 1.2) return false;
    }
    return true;
  });
  if (ai >= 0) {
    const s = ctx.samples[ai];
    const arch = new THREE.Group();
    // Solid lifted rock (not the near-white instanced base — these meshes
    // have no per-instance tint). The arch is roadside (±hw+2.6), so its
    // sun-away face needs the emissive floor most.
    const archMat = rockSolid;
    const pillarGeo = new THREE.DodecahedronGeometry(1.5, 0);
    for (const side of [1, -1]) {
      const base = s.point.clone().addScaledVector(s.left, side * (hw + 2.6));
      const gy = ctx.fieldY(base);
      const lower = new THREE.Mesh(pillarGeo, archMat);
      lower.position.set(side * (hw + 2.6), gy - s.point.y + 1.6, 0);
      lower.scale.set(1.3, 1.5, 1.3); // wide enough to read as a pillar at range
      lower.rotation.y = rand() * Math.PI;
      const upper = new THREE.Mesh(pillarGeo, archMat);
      upper.position.set(side * (hw + 2.6), gy - s.point.y + 3.9, 0);
      upper.scale.set(0.95, 0.95, 0.95); // meets the lintel — no floating slab
      upper.rotation.y = rand() * Math.PI;
      lower.castShadow = upper.castShadow = true;
      arch.add(lower, upper);
      ctx.avoid(base, 3.2);
    }
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(2 * (hw + 2.6) + 1.6, 1.0, 1.7),
      archMat,
    );
    lintel.position.y = 5.1; // road-relative — underside ≈4.6 m clearance
    lintel.rotation.z = 0.02;
    lintel.castShadow = true;
    arch.add(lintel);
    arch.position.copy(s.point);
    arch.rotation.y = Math.atan2(s.left.x, s.left.z); // +X spans the road
    ctx.avoid(s.point, hw + 5);
    objects.push(arch);
    animated.push({
      obj: arch,
      kind: 'arch',
      phase: 0,
      baseY: arch.position.y,
    });
  }

  objects.forEach((o) => (o.userData.dress = 'ridge'));
  return { objects, animated };
}

// ============================= NEON =============================
export function dressNeon(ctx: ScatterCtx): DressResult {
  const objects: THREE.Object3D[] = [];
  const animated: AnimatedProp[] = [];
  const S = SCENERY.neon;
  const rand = ctx.rand;
  const hw = ctx.hw;
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x161b26,
    roughness: 0.55,
    metalness: 0.4,
  });
  const neonMats = [0x36f0ff, 0xff4ad8].map(
    (e) =>
      new THREE.MeshStandardMaterial({
        color: 0x101418,
        emissive: e,
        // 1.45 (was 2.1): still over the ~1.0 linear bloom gate at the
        // pulse peak, but the road-spanning bars no longer bloom into
        // giant sabers slashing the sky at raking angles (critic9).
        emissiveIntensity: 1.45,
        roughness: 0.4,
      }),
  );

  // Glow gates spanning the road on straights — two dark posts outside the
  // walls + an emissive bar overhead (≥4.5 m clearance). Instanced posts,
  // bars split cyan/magenta because instanceColor can't tint emissive.
  const gateSpots: number[] = [];
  for (const [f0, f1] of [
    [0.08, 0.16],
    [0.3, 0.4],
    [0.55, 0.65],
    [0.8, 0.9],
  ] as const) {
    const i = ctx.straightSpot(f0, f1, (idx) => {
      const s = ctx.samples[idx];
      for (const side of [1, -1]) {
        const p = s.point.clone().addScaledVector(s.left, side * (hw + 1.0));
        if (ctx.excluded(p) || ctx.roadClearance(p) < 0.4) return false;
      }
      return true;
    });
    if (i >= 0) gateSpots.push(i);
  }
  const postGeo = new THREE.BoxGeometry(0.4, 5.6, 0.4);
  const gatePosts = new THREE.InstancedMesh(
    postGeo,
    darkMat,
    gateSpots.length * 2,
  );
  // Slimmer, shorter crossbar (was 0.55 h × 0.6 d spanning hw+1.6): the
  // long hot bar read as a light saber from low chase angles. Still spans
  // the full road — the overhang past the posts is what made it giant.
  const barGeo = new THREE.BoxGeometry(2 * (hw + 0.7), 0.4, 0.45);
  const gateBars = neonMats.map(
    (mm) => new THREE.InstancedMesh(barGeo, mm, Math.ceil(gateSpots.length / 2)),
  );
  const barCounts = [0, 0];
  let pi = 0;
  gateSpots.forEach((ai, g) => {
    const s = ctx.samples[ai];
    const yaw = Math.atan2(s.left.x, s.left.z);
    const rot = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
    for (const side of [1, -1]) {
      const p = s.point.clone().addScaledVector(s.left, side * (hw + 1.0));
      ctx.avoid(p, 1.2);
      M.compose(
        p.setY(s.point.y + 2.75), // base embeds ~5 cm into the skirt
        rot,
        new THREE.Vector3(1, 1, 1),
      );
      gatePosts.setMatrixAt(pi++, M);
    }
    M.compose(
      s.point.clone().setY(s.point.y + 5.0), // underside ≈4.7 m over road
      rot,
      new THREE.Vector3(1, 1, 1),
    );
    const which = g % 2;
    gateBars[which].setMatrixAt(barCounts[which]++, M);
  });
  gatePosts.count = pi;
  gateBars.forEach((b, k) => (b.count = barCounts[k]));
  objects.push(gatePosts, ...gateBars);
  // baseY = resting emissiveIntensity for the tick pulse — must match
  // neonMats (1.45) or the breathing animation restores the saber-hot 2.1.
  animated.push(
    { obj: gateBars[0], kind: 'gate', phase: 0, baseY: 1.45 },
    { obj: gateBars[1], kind: 'gate', phase: 2.1, baseY: 1.45 },
  );

  // Glow sign boards — post + emissive panel facing the road, scattered on
  // both shoulders. Panels register as 'sign' for the pulse hook.
  const signPostGeo = new THREE.BoxGeometry(0.16, 2.8, 0.16);
  const panelGeo = new THREE.BoxGeometry(2.3, 1.3, 0.12);
  const signPosts = new THREE.InstancedMesh(signPostGeo, darkMat, S.signs);
  const panels = neonMats.map(
    (mm) => new THREE.InstancedMesh(panelGeo, mm, Math.ceil(S.signs / 2)),
  );
  const panelCounts = [0, 0];
  let spi = 0;
  scatter(
    ctx,
    S.signs,
    { min: hw + 2.2, max: hw + 14, margin: 1.8 },
    (p, s) => {
      const gy = ctx.fieldY(p);
      // Face back along travel so drivers read the glow on approach.
      const yaw =
        Math.atan2(-s.tangent.x, -s.tangent.z) + (rand() - 0.5) * 0.5;
      const rot = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
      M.compose(
        p.clone().setY(gy + 1.3),
        rot,
        new THREE.Vector3(1, 1, 1),
      );
      signPosts.setMatrixAt(spi, M);
      M.compose(
        p.clone().setY(gy + 2.6),
        rot,
        new THREE.Vector3(1, 1, 1),
      );
      const which = spi % 2;
      panels[which].setMatrixAt(panelCounts[which]++, M);
      spi++;
    },
  );
  signPosts.count = spi;
  panels.forEach((pl, k) => (pl.count = panelCounts[k]));
  objects.push(signPosts, ...panels);
  panels.forEach((pl, k) =>
    animated.push({ obj: pl, kind: 'sign', phase: k * 2.4, baseY: 1.45 }),
  );

  // Holo-strip light columns — thin emissive bars weighted into the infield
  // so the loop interior glows instead of reading as a dark hole.
  const colGeo = new THREE.BoxGeometry(0.16, 3.4, 0.16);
  const colMat = new THREE.MeshStandardMaterial({
    color: 0x101418,
    emissive: 0x36f0ff,
    emissiveIntensity: 2.0,
    roughness: 0.4,
  });
  const columns = new THREE.InstancedMesh(colGeo, colMat, S.holoColumns);
  let li = 0;
  const placeCol = (p: THREE.Vector3) => {
    const gy = ctx.fieldY(p);
    const sc = 0.7 + rand() * 0.9;
    M.compose(
      p.clone().setY(gy + 1.6 * sc),
      Q.setFromAxisAngle(UP, rand() * Math.PI * 2),
      new THREE.Vector3(1, sc, 1),
    );
    columns.setMatrixAt(li, M);
    li++;
  };
  scatter(
    ctx,
    Math.floor(S.holoColumns * 0.65),
    { side: 'inner', margin: 2.2, max: hw + 38 },
    placeCol,
  );
  scatter(
    ctx,
    S.holoColumns - li,
    { margin: 2, max: hw + 30 },
    placeCol,
  );
  columns.count = li;
  objects.push(columns);
  animated.push({ obj: columns, kind: 'sign', phase: 4.2, baseY: 2.0 });

  // Dark tech crates — matte boxes, some stacked two-high near the walls.
  const crateGeo = new THREE.BoxGeometry(1.15, 1.15, 1.15);
  const crateMat = new THREE.MeshStandardMaterial({
    color: 0x1a2130,
    roughness: 0.7,
    flatShading: true,
  });
  const crates = new THREE.InstancedMesh(crateGeo, crateMat, S.crates + 18);
  let cri = 0;
  scatter(ctx, S.crates, { min: hw + 2, max: hw + 20, margin: 1.9 }, (p, s) => {
    const gy = ctx.fieldY(p);
    const sc = 0.7 + rand() * 0.6;
    const rot = yawQuat(s)
      .clone()
      .multiply(Q.setFromAxisAngle(UP, (rand() - 0.5) * 0.8));
    M.compose(
      p.clone().setY(gy + 0.5 * sc),
      rot,
      new THREE.Vector3(sc, sc, sc),
    );
    crates.setMatrixAt(cri, M);
    crates.setColorAt(
      cri,
      new THREE.Color(0x1a2130).offsetHSL(0, 0, rand() * 0.06),
    );
    cri++;
    if (rand() < 0.3 && cri < S.crates + 18) {
      const sc2 = sc * 0.8;
      M.compose(
        p.clone().setY(gy + 1.15 * sc + 0.5 * sc2),
        rot.clone().multiply(Q.setFromAxisAngle(UP, 0.4)),
        new THREE.Vector3(sc2, sc2, sc2),
      );
      crates.setMatrixAt(cri, M);
      cri++;
    }
  });
  crates.count = cri;
  objects.push(crates);

  // Runway studs — low emissive pucks scattered through the near band;
  // dense light texture on the dark field. Two colors, two meshes.
  const studGeo = new THREE.BoxGeometry(0.34, 0.16, 0.34);
  const studMats = [0xffb03a, 0x36f0ff].map(
    (e) =>
      new THREE.MeshStandardMaterial({
        color: 0x101418,
        emissive: e,
        emissiveIntensity: 1.9,
        roughness: 0.5,
      }),
  );
  const studs = studMats.map(
    (mm) => new THREE.InstancedMesh(studGeo, mm, Math.ceil(S.studs / 2)),
  );
  const studCounts = [0, 0];
  scatter(ctx, S.studs, { min: hw + 1.8, max: hw + 16, margin: 1.6 }, (p) => {
    const gy = ctx.fieldY(p);
    M.compose(
      p.clone().setY(gy + 0.06),
      Q.setFromAxisAngle(UP, rand() * Math.PI * 2),
      new THREE.Vector3(0.8 + rand() * 0.7, 1, 0.8 + rand() * 0.7),
    );
    const which = Math.floor(rand() * 2);
    if (studCounts[which] >= Math.ceil(S.studs / 2)) return;
    studs[which].setMatrixAt(studCounts[which]++, M);
  });
  studs.forEach((st, k) => (st.count = studCounts[k]));
  objects.push(...studs);

  objects.forEach((o) => (o.userData.dress = 'neon'));
  return { objects, animated };
}
