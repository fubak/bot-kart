# Asset Registry

Tracks every authored 3D asset from concept through in-game integration.
Blender sources live under `assets/blender/<category>/`; runtime exports under
`assets/exported/<category>/`.

## Statuses

`Planned` → `Concept` → `Blockout` → `Production` → `Critic Review` →
`Revision` → `Approved` → `Integrated` (→ `Deprecated`)

## Entry Template

```markdown
### <asset-id> — <name>

- **Category:** characters | karts | environments | track-props | items | effects | shared
- **Status:** <status>
- **Owner:** <Builder session>
- **Critic:** <Critic session>
- **Quality Unit:** <unit-id>
- **Blender Source:** `assets/blender/<category>/<file>.blend`
- **Runtime Export:** `assets/exported/<category>/<file>.glb`
- **Art-Direction Notes:** <palette/silhouette/material intent>
- **Triangles:** <count> | **Materials:** <n> | **Textures:** <n, sizes>
- **Animation:** <clips> | **Collision:** <shape> | **LOD:** <levels>
- **Performance Notes:** <draw calls, memory, streaming>
- **Critic Result:** <score + in-game verdict>
- **Biggest Gap:** <single most important deficiency>
```

---

### kart-a — Grok Bot A Bubble-Pod Kart

- **Category:** karts
- **Status:** Production
- **Owner:** Blender Asset Builder subagent
- **Critic:** pending (in-game critic review happens later)
- **Quality Unit:** kart visuals (placeholder swap in `Kart.ts`)
- **Blender Source:** `assets/blender/karts/kart-a.blend`
- **Runtime Export:** `assets/exported/karts/kart-a.glb`
- **Art-Direction Notes:** rounded bubble-pod body per `grokbot-explore-A.png`:
  cream shell #F0E6D2, coral #E8634F accents — twin nose stripes, cockpit rim,
  side bands, candy-stripe rear wing + curled antenna; teal seat/interior;
  translucent dome windshield echoing the driver head; dark balloon tires with
  cream hubs, coral caps, cyan glow rings; cyan glow dots on flanks/nose.
- **Triangles:** 5,228 | **Materials:** 7 (cream, coral, teal, tub_dark,
  tire, cyan_glow, windshield) | **Textures:** 0 (flat-color materials)
- **Animation:** none — wheels are separate named nodes `wheel_fl`, `wheel_fr`,
  `wheel_rl`, `wheel_rr` (pivots at axle centers, local X = axle) for runtime
  spin/steer | **Collision:** box clamp via track constraint | **LOD:** none
- **Performance Notes:** 50 nodes, 81.6 KB; `gltf-transform optimize` applied
  with join/flatten/palette disabled + `--compress quantize` → only
  `KHR_mesh_quantization` required (no decoder needed). Dims: 1.65 m wide ×
  2.60 m long; nose at -Z; origin at ground center; wheels r=0.225.
  **Integration note:** `Kart.ts` selects wheels via
  `name.startsWith('Cylinder')` — update to the `wheel_` prefix at integration;
  kart already loads through `GLTFLoader` (placeholder swap path).
- **Critic Result:** not yet reviewed in-game
- **Biggest Gap:** windshield alpha sorting unverified in-game; candy-stripe
  antenna is segmented cylinders rather than a smooth curve.

### grokbot-a — Grok Bot A Driver (seated)

- **Category:** characters
- **Status:** Production
- **Owner:** Blender Asset Builder subagent
- **Critic:** pending (in-game critic review happens later)
- **Quality Unit:** character visuals (replaces placeholder icosahedron bot)
- **Blender Source:** `assets/blender/characters/grokbot-a.blend`
- **Runtime Export:** `assets/exported/characters/grokbot-a.glb`
- **Art-Direction Notes:** seated pose per `grokbot-explore-A.png`: cream
  capsule body #F0E6D2, coral #E8634F belt/collar/cuffs/knees/ear pods/
  chest-panel frame, dark glossy dome visor #141E28 with two cyan emissive
  eyes + smile arc, coral dome stripe, candy-stripe antenna with cyan glow
  tip, coral-soled feet.
- **Triangles:** 6,208 | **Materials:** 4 (cream, coral, cyan_glow,
  visor_dark) | **Textures:** 0 (flat-color materials)
- **Animation:** none — `head` node (17 children) pivots at the neck for
  future head animation | **Collision:** none (cockpit-mounted) | **LOD:** none
- **Performance Notes:** 62 nodes, 111.5 KB; same optimize settings as kart-a
  (`KHR_mesh_quantization` only). Origin at seat base; faces -Z. Seated height
  ~1.28 m to head top / ~1.53 m including antenna appendage.
- **Critic Result:** not yet reviewed in-game
- **Biggest Gap:** minor surface interpenetration where limb capsules meet the
  torso; smile curve hugs the visor — watch for z-fighting at grazing angles.
