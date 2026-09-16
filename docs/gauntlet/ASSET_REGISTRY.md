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

### kart-b — Grok Bot B Heavy Kart

- **Category:** karts
- **Status:** Production
- **Owner:** Blender Asset Builder subagent
- **Critic:** pending (in-game critic review happens later)
- **Quality Unit:** kart visuals (rival roster)
- **Blender Source:** `assets/blender/karts/kart-b.blend`
  (collection `kart_b`; build script `scripts/assets/build_kart_b.py`)
- **Runtime Export:** `assets/exported/karts/kart-b.glb`
- **Art-Direction Notes:** heavy/industrial box vocabulary matching
  `grokbot-b.glb`: gunmetal slab hull + blunt nose, orange ram bar / flank
  stripes / X-brace / wheel hubs, navy pods/dash/seat/rear deck, amber-glow
  headlights / dash strip / tail lights / exhaust-tip rings. Signature
  silhouette: full roll cage (two hoops + roof rails + orange rear
  X-brace), twin vertical exhaust stacks, hood scoop, whip antenna,
  squared fenders over chunky r=0.26 tires — wide, tall, heavy read vs
  kart-a's bubble pod and kart-c's wedge.
- **Triangles:** 6,004 | **Materials:** 5 (gunmetal, navy, orange,
  amber_glow, tire) | **Textures:** 0 (flat-color materials)
- **Animation:** none — wheels are separate named nodes `wheel_fl`,
  `wheel_fr`, `wheel_rl`, `wheel_rr` (pivots at axle centers, local X =
  axle) for runtime spin/steer | **Collision:** box clamp via track
  constraint | **LOD:** none
- **Performance Notes:** 56 nodes, 94.9 KB; same optimize pass as kart-a
  (`gltf-transform optimize --compress quantize --flatten false --join false
  --palette false --instance false` → `KHR_mesh_quantization` only, no
  decoder needed). Dims: 1.71 m wide × 2.67 m long × 1.46 m tall (cage
  top); nose at -Z; origin at ground center; wheels r=0.26 at axles
  ±0.88 m. Cockpit seat area clear at glTF ~(0, 0.6, 0.3) for the seated
  driver. Preview: `docs/gauntlet/evidence/wave3/kart-b_preview.png`.
- **Critic Result:** not yet reviewed in-game
- **Biggest Gap:** cage roof rails sit at driver chin height (head clears
  above, kart-a wing-style) — verify in-game that the seated B head/beacon
  doesn't clip the front rail; ~0.06 m wider and ~0.07 m longer than
  kart-a (intentional wide-stance heavy read).

### kart-c — Grok Bot C Speed Kart

- **Category:** karts
- **Status:** Production
- **Owner:** Blender Asset Builder subagent
- **Critic:** pending (in-game critic review happens later)
- **Quality Unit:** kart visuals (rival roster)
- **Blender Source:** `assets/blender/karts/kart-c.blend`
  (collection `kart_c`; build script `scripts/assets/build_kart_c.py`)
- **Runtime Export:** `assets/exported/karts/kart-c.glb`
- **Art-Direction Notes:** low wedge/blade vocabulary matching
  `grokbot-c.glb`: pearl monocoque — pointed nose loft + tapered tail,
  violet aero (front wing + endplates, rear wing on graphite stalks,
  swept dorsal shark fin, side winglets, pod blades, tub rims, seat
  shell), graphite floor/tub/steering, magenta-glow flank + pod strips /
  nose sliver / tail strip, dark wind deflector. Signature silhouette:
  ground-hugging open-wheel speed wedge vs kart-b's tall box.
- **Triangles:** 4,676 | **Materials:** 6 (pearl, violet, graphite,
  magenta_glow, visor_dark, tire) | **Textures:** 0 (flat-color materials)
- **Animation:** none — wheels are separate named nodes `wheel_fl`,
  `wheel_fr`, `wheel_rl`, `wheel_rr` (pivots at axle centers, local X =
  axle) for runtime spin/steer | **Collision:** box clamp via track
  constraint | **LOD:** none
- **Performance Notes:** 43 nodes, 82.8 KB; same optimize pass as kart-a
  (`KHR_mesh_quantization` only, no decoder needed). Dims: 1.55 m wide ×
  2.64 m long × 1.04 m tall (dorsal-fin tip); nose at -Z; origin at
  ground center; low-profile wheels r=0.22 at axles ±0.90 m. Cockpit seat
  area clear at glTF ~(0, 0.6, 0.3). Preview:
  `docs/gauntlet/evidence/wave3/kart-c_preview.png`.
- **Critic Result:** not yet reviewed in-game
- **Biggest Gap:** magenta flank strips sit flush on the lofted hull —
  check for z-fighting at grazing angles in-game; open wheels have no
  fenders so full tire tread is visible during spin (needs hub motion
  blur or tread texture if it reads static).

- **Category:** characters
- **Status:** Integrated (avatar redesign — wave 23)
- **Owner:** Blender Asset Builder session
- **Quality Unit:** character visuals — xAI Grok Bot avatar identity
- **Blender Source:** `assets/blender/characters/grokbot-avatars.blend`
  (build script `scripts/assets/build_grokbot_avatars.py`; supersedes
  `grokbot-a.blend`)
- **Runtime Export:** `assets/exported/characters/grokbot-a.glb`
- **Art-Direction Notes:** remodeled after the Grok Bot avatar
  (x.ai/bot): oversized white gloss `shell` dome head carrying ~60% of the
  silhouette, two tall black `eye_lens` ovals with tops tilted inward,
  dark `joint` collar/chin ring/ear pods, xAI `x_mark` emblem on the dome
  back (the chase-cam signature), thin `antenna` + cyan `tip_glow` beacon,
  white pod torso with `accent_a` cyan chest bar/dot/cuff rings/knee dots.
  Seated pose, origin at seat base.
- **Triangles:** 4,332 | **Materials:** 5 (shell, joint, eye_lens,
  accent_a, tip_glow) | **Textures:** 0 (flat-color materials)
- **Animation:** runtime empties — `head` look-around/blink squash on
  `eye_l`/`eye_r` scale.y, `arm_l/r` celebration/flail, `leg_l/r` pedal
  press | **Collision:** none (cockpit-mounted) | **LOD:** none
- **Performance Notes:** 50 nodes pre-merge → ~20 draws after runtime
  static-merge, 156 KB. Faces -Z; seated height ~1.2 m to dome top.
- **Critic Result:** verified in-game — dome + oval eyes read at chase
  distance; X emblem visible from behind; blink verified (scale.y 1→0.12)
- **Biggest Gap:** eyes are opaque lenses — no emissive variant for night
  pop (deliberate: matches the matte-black avatar look).

### grokbot-b — Grok Bot B Rival (heavy/power, standing)

- **Category:** characters
- **Status:** Deprecated (wave-23 avatar redesign — game loads the new
  `grokbot-b-seated.glb` dome-bot; this standing export is retained as
  source history only)
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
- **Status:** Integrated (avatar redesign — wave 23)
- **Owner:** Blender Asset Builder session
- **Quality Unit:** character visuals — xAI Grok Bot avatar identity (heavy)
- **Blender Source:** `assets/blender/characters/grokbot-avatars.blend`
  (collection `avatar_b`; build script `build_grokbot_avatars.py`;
  supersedes `grokbot-b.blend` seated hierarchy)
- **Runtime Export:** `assets/exported/characters/grokbot-b-seated.glb`
- **Art-Direction Notes:** same Grok-Bot-avatar identity as A (white dome,
  black oval eyes, X emblem) with heavy reads: thicker limbs, squared
  `shoulderpad_l/r` with `accent_b` stripes, three chest `vent_*` slats,
  no antenna. Orange `accent_b` hue-shifts with team tint.
- **Triangles:** 4,972 | **Materials:** 4 (shell, joint, eye_lens,
  accent_b) | **Textures:** 0
- **Animation:** same runtime-empty scheme as A | **Collision:** none |
  **LOD:** none
- **Performance Notes:** 55 nodes pre-merge → ~20 draws after runtime
  merge, 203 KB. Origin at seat base, faces -Z.
- **Critic Result:** verified in-game (shoulder pods + vents read at speed)
- **Biggest Gap:** none flagged — silhouette distinct from A/C via pads.

### grokbot-c — Grok Bot C Rival (speed, standing)

- **Category:** characters
- **Status:** Deprecated (wave-23 avatar redesign — see grokbot-c-seated)
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
- **Status:** Integrated (avatar redesign — wave 23)
- **Owner:** Blender Asset Builder session
- **Quality Unit:** character visuals — xAI Grok Bot avatar identity (speed)
- **Blender Source:** `assets/blender/characters/grokbot-avatars.blend`
  (collection `avatar_c`; build script `build_grokbot_avatars.py`;
  supersedes `grokbot-c.blend` seated hierarchy)
- **Runtime Export:** `assets/exported/characters/grokbot-c-seated.glb`
- **Art-Direction Notes:** same Grok-Bot-avatar identity with speed reads:
  swept `fin_top` wedge on the dome crown with `accent_c` violet leading
  edge, slim limbs, violet knee dots/cuff rings/chest accents.
- **Triangles:** 4,252 | **Materials:** 4 (shell, joint, eye_lens,
  accent_c) | **Textures:** 0
- **Animation:** same runtime-empty scheme as A | **Collision:** none |
  **LOD:** none
- **Performance Notes:** 50 nodes pre-merge → ~20 draws after runtime
  merge, 153 KB. Origin at seat base, faces -Z.
- **Critic Result:** verified in-game
- **Biggest Gap:** none flagged — dorsal fin clears the kart-c seat back.
