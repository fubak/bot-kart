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

### grokbot-b — Grok Bot B Rival (heavy/power, standing)

- **Category:** characters
- **Status:** Exported
- **Owner:** Blender Asset Builder subagent
- **Critic:** pending (in-game critic review happens later)
- **Quality Unit:** character visuals (rival roster)
- **Blender Source:** `assets/blender/characters/grokbot-b.blend`
  (collection `bot_b`; build script `scripts/assets/build_grokbot_b.py`)
- **Runtime Export:** `assets/exported/characters/grokbot-b.glb`
- **Art-Direction Notes:** B "Chunky" box vocabulary per
  `grokbot-explore-B.png`, industrial palette per wave-2 brief: gunmetal
  boxy body + shoulder pads/knee pads/cuffs/soles/head-stripe in warning
  orange, navy limbs/joints, dark CRT screen visor with amber-glow pixel
  eyes (2×2 clusters) + pixel-row mouth, amber chest vent slats, ear
  beacons, stub antenna + amber warning tip, backpack + twin exhausts.
  Broad-shouldered, low-CoG heavy silhouette: 1.17 m wide at the pads vs
  Bot A's ~0.7 m — clearly heavier at the same ~1.3 m head height
  (1.46 m to beacon tip).
- **Triangles:** 4,848 | **Materials:** 5 (gunmetal, navy, orange,
  amber_glow, visor_dark) | **Textures:** 0 (flat-color materials)
- **Animation:** none — `head` empty pivots at the neck; `arm_*`, `leg_*`,
  `torso` empties are animation hooks | **Collision:** none | **LOD:** none
- **Performance Notes:** 56 nodes, 75.6 KB; same optimize pass as kart-a
  (`gltf-transform optimize --compress quantize --flatten false --join false
  --palette false --instance false` → `KHR_mesh_quantization` only, no
  decoder needed). Origin at feet, faces -Z. Key node names: `body`,
  `visor`, `eye_l`, `eye_r`, `mouth`, `antenna`, `antenna_tip`, `head_box`,
  `chest_panel`, `vent_glow`, `foot_l/r`, `hand_l/r`, `shoulder_l/r`,
  `hipj_l/r`, `knee_l/r`, `sole_l/r`, `backpack`, `exhaust_l/r`,
  `stripe_l/r`, `ear_l/r`, `ear_dot_l/r`, `head_stripe`, `belt`, `hip`,
  `collar`, `cuff_l/r`, `thumb_l/r`, `elbow_l/r`, `upperarm_l/r`,
  `forearm_l/r`, `shin_l/r`, `thigh_l/r`.
- **Critic Result:** not yet reviewed in-game
- **Biggest Gap:** CRT mouth is subtle at distance; exhaust tips may clip
  shoulder pads at extreme head-rotation angles (unanimated, low risk).

### grokbot-b-seated — Grok Bot B Rival (kart-driving pose)

- **Category:** characters
- **Status:** Exported
- **Owner:** Blender Asset Builder subagent
- **Critic:** pending (in-game critic review happens later)
- **Quality Unit:** character visuals (rival in-kart driver)
- **Blender Source:** `assets/blender/characters/grokbot-b.blend`
  (collection `bot_b_seated`; same build script — seated pose is a separate
  hierarchy inside the one .blend, objects carry `_seat` suffix in source)
- **Runtime Export:** `assets/exported/characters/grokbot-b-seated.glb`
- **Art-Direction Notes:** same palette/silhouette as standing B; torso
  dropped 0.17 m, knees folded forward, feet forward toe-up on pedals,
  hands forward inboard to wheel height — mirrors grokbot-a seating
  convention. Root node `grokbot_b_seated`; all child node names identical
  to the standing rig (`head`, `foot_l`, `hand_r`, …).
- **Triangles:** 4,848 | **Materials:** 5 | **Textures:** 0
- **Animation:** none | **Collision:** none (cockpit-mounted) | **LOD:** none
- **Performance Notes:** 56 nodes, 76.0 KB; same quantize pass. Origin at
  seat base, faces -Z; seated height ~1.29 m to beacon tip, feet reach
  ~0.52 m forward.
- **Critic Result:** not yet reviewed in-game
- **Biggest Gap:** seat fit vs kart-b cockpit unverified — may need hip-y
  trim when a kart-b exists.

### grokbot-c — Grok Bot C Rival (speed, standing)

- **Category:** characters
- **Status:** Exported
- **Owner:** Blender Asset Builder subagent
- **Critic:** pending (in-game critic review happens later)
- **Quality Unit:** character visuals (rival roster)
- **Blender Source:** `assets/blender/characters/grokbot-c.blend`
  (collection `bot_c`; build script `scripts/assets/build_grokbot_c.py`)
- **Runtime Export:** `assets/exported/characters/grokbot-c.glb`
- **Art-Direction Notes:** C "Wedge" blade vocabulary per
  `grokbot-explore-C.png`, light palette per wave-2 brief: pearl-white
  swept teardrop fuselage body (elliptical-ring loft, nose-forward taper),
  violet angular armor — blade pauldrons, flank stripes, pointed knee pads,
  forearm blades, soles; graphite joints/hands/feet; angular wedge head
  with narrow slit visor + single magenta emissive `eye_band`; three
  swept-back antenna fins (`fin_l`, `fin_r`, dorsal `fin_top`) replace the
  stalk antenna; magenta chest chevron `chest_glow`. 0.76 m wide × 1.42 m
  to fin tip — narrow, aggressive speed silhouette vs B's bulk.
- **Triangles:** 3,204 | **Materials:** 5 (pearl, violet, graphite,
  magenta_glow, visor_dark) | **Textures:** 0 (flat-color materials)
- **Animation:** none — same empty-hook scheme as A/B (`head` neck pivot,
  `arm_*`, `leg_*`, `torso`) | **Collision:** none | **LOD:** none
- **Performance Notes:** 44 nodes, 56.8 KB; same quantize pass
  (`KHR_mesh_quantization` only). Origin at feet, faces -Z. Key node names:
  `body`, `visor`, `eye_band`, `head_shell`, `fin_l`, `fin_r`, `fin_top`,
  `chest_glow`, `stripe_l/r`, `blade_l/r`, `foot_l/r`, `hand_l/r`,
  `shoulder_l/r`, `hipj_l/r`, `knee_l/r`, `sole_l/r`, `belt`, `hip`,
  `collar`, `elbow_l/r`, `upperarm_l/r`, `forearm_l/r`, `shin_l/r`,
  `thigh_l/r`.
- **Critic Result:** not yet reviewed in-game
- **Biggest Gap:** slit visor is thin — eye-band readability at race
  distance depends on bloom/emissive handling in-engine.

### grokbot-c-seated — Grok Bot C Rival (kart-driving pose)

- **Category:** characters
- **Status:** Exported
- **Owner:** Blender Asset Builder subagent
- **Critic:** pending (in-game critic review happens later)
- **Quality Unit:** character visuals (rival in-kart driver)
- **Blender Source:** `assets/blender/characters/grokbot-c.blend`
  (collection `bot_c_seated`; `_seat` suffix in source)
- **Runtime Export:** `assets/exported/characters/grokbot-c-seated.glb`
- **Art-Direction Notes:** same palette/silhouette as standing C; torso
  dropped 0.15 m, knees folded forward, feet forward toe-up on pedals,
  hands forward to wheel. Root node `grokbot_c_seated`; child node names
  identical to the standing rig.
- **Triangles:** 3,204 | **Materials:** 5 | **Textures:** 0
- **Animation:** none | **Collision:** none (cockpit-mounted) | **LOD:** none
- **Performance Notes:** 44 nodes, 57.6 KB; same quantize pass. Origin at
  seat base, faces -Z; seated height ~1.27 m to fin tip, feet reach ~0.52 m
  forward.
- **Critic Result:** not yet reviewed in-game
- **Biggest Gap:** dorsal fin may poke through a kart-b/c-style seat back
  if one is added later — check clearance at integration.
