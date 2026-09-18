# Media Registry

Tracks meaningful Grok Imagine outputs — concept art, textures, decals,
sprites, VFX sources, UI art, reference imagery, motion studies, video
reference, promotional art.

**Do not register disposable experiments.** Register an output when it is
selected for refinement, used as a reference for further work, or shipped
into the game/marketing.

## Statuses

`Generated` → `In Review` → `Selected` → `Refined` → `Approved` →
`Integrated` (→ `Rejected` | `Deprecated`)

## Entry Template

```markdown
### <media-id> — <name>

- **Category:** concepts/characters | concepts/karts | concepts/tracks |
  concepts/environments | textures | decals | sprites | vfx | ui |
  backgrounds | references | video-reference | promotional
- **Status:** <status>
- **Owner:** <session>
- **Critic:** <session>
- **Model/Tool:** image_gen | image_edit | image_to_video | reference_to_video
- **Prompt File:** `assets/media/prompts/<file>.md`
- **Reference Media:** <paths of seed/reference images>
- **Output:** `assets/media/<category>/<file>`
- **Quality Unit:** <unit-id or n/a>
- **Generation Parameters:** <aspect ratio, duration, etc.>
- **Selection Rationale:** <why this output over alternatives>
- **Downstream Use:** <Blender reference, texture source, HUD art, ...>
- **Critic Result:** <score + notes>
```

---

### grokbot-explore-A — Grok Bot Explore A (Rounded-Friendly)

- **Category:** concepts/characters
- **Status:** Selected — CANONICAL signature-racer seed (Coordinator review 2026-09-13)
- **Owner:** grok-imagine-concept-builder (subagent session, 2026-09-13)
- **Critic:** Coordinator (visual review of rendered PNG)
- **Model/Tool:** image_gen (grok CLI 1.0.30, headless `-p`)
- **Prompt File:** `assets/media/prompts/2026-09-13_grokbot-explore-A-rounded_v1.md`
- **Reference Media:** none
- **Output:** `assets/media/concepts/characters/grokbot-explore-A.png`
- **Quality Unit:** n/a
- **Generation Parameters:** aspect_ratio 4:3, output 1152×864 PNG
- **Selection Rationale:** Rounded/spherical shape-language candidate — ball
  torso, dome head, capsule limbs; kart dome windshield echoes the head.
  Most approachable, mascot-like read of the three candidates.
- **Downstream Use:** Blender modeling reference for signature Grok Bot
  racer; seed for `image_edit` consistency pass if selected as canonical.
- **Critic Result:** pending

### grokbot-explore-B — Grok Bot Explore B (Chunky-Square)

- **Category:** concepts/characters
- **Status:** Selected — heavyweight archetype seed (Coordinator review 2026-09-13)
- **Owner:** grok-imagine-concept-builder (subagent session, 2026-09-13)
- **Critic:** Coordinator (visual review of rendered PNG)
- **Model/Tool:** image_gen (grok CLI 1.0.30, headless `-p`)
- **Prompt File:** `assets/media/prompts/2026-09-13_grokbot-explore-B-square_v1.md`
- **Reference Media:** none
- **Output:** `assets/media/concepts/characters/grokbot-explore-B.png`
- **Quality Unit:** n/a
- **Generation Parameters:** aspect_ratio 4:3, output 1152×864 PNG
- **Selection Rationale:** Square/box shape-language candidate — cube head,
  appliance torso, mitten hands; kart roll-bar and squared fenders echo
  the cube motif. Reads as the dependable heavy archetype.
- **Downstream Use:** Blender modeling reference for a rival/heavyweight
  Grok Bot; seed for `image_edit` consistency pass if selected.
- **Critic Result:** pending

### grokbot-explore-C — Grok Bot Explore C (Sleek-Wedge)

- **Category:** concepts/characters
- **Status:** Selected — speed archetype seed (Coordinator review 2026-09-13)
- **Owner:** grok-imagine-concept-builder (subagent session, 2026-09-13)
- **Critic:** Coordinator (visual review of rendered PNG)
- **Model/Tool:** image_gen (grok CLI 1.0.30, headless `-p`)
- **Prompt File:** `assets/media/prompts/2026-09-13_grokbot-explore-C-wedge_v1.md`
- **Reference Media:** none
- **Output:** `assets/media/concepts/characters/grokbot-explore-C.png`
- **Quality Unit:** n/a
- **Generation Parameters:** aspect_ratio 4:3, output 1152×864 PNG
- **Selection Rationale:** Triangle/wedge shape-language candidate — swept
  head fin, forward-leaning wedge torso, blade limbs; kart nose and fins
  echo the fin motif. Reads as the speed archetype.
- **Downstream Use:** Blender modeling reference for a speed-class Grok
  Bot; seed for `image_edit` consistency pass if selected.
- **Critic Result:** pending

### tex-grass — Grass Field Tile

- **Category:** textures
- **Status:** Integrated
- **Owner:** Coordinator Devin (wave-6 visual pass, 2026-09-14)
- **Critic:** Coordinator (in-game review — `wave6/vis-*.png`)
- **Model/Tool:** image_gen (grok CLI 1.0.31, headless `-p`)
- **Prompt File:** `assets/media/prompts/2026-09-14_wave6-texture-batch_v1.md`
- **Reference Media:** none
- **Output:** `assets/media/textures/grass_tile.png` → `assets/textures/grass_tile.png` (512²)
- **Quality Unit:** ENV-004 (surface textures)
- **Generation Parameters:** aspect_ratio 1:1, 1024² → resized 512²
- **Selection Rationale:** clean tileable painterly grass; tint-multiplies
  per-track theme so one tile serves all three circuits.
- **Downstream Use:** ground plane + embankment skirt `map` (Track.ts).
- **Critic Result:** accepted — reads crisp at speed, no visible seams.

### tex-asphalt — Asphalt Road Tile

- **Category:** textures
- **Status:** Integrated
- **Owner:** Coordinator Devin
- **Critic:** Coordinator
- **Model/Tool:** image_gen
- **Prompt File:** `assets/media/prompts/2026-09-14_wave6-texture-batch_v1.md`
- **Output:** `assets/media/textures/asphalt_tile.png` → `assets/textures/asphalt_tile.png` (512²)
- **Quality Unit:** ENV-004
- **Generation Parameters:** 1:1, 1024² → 512²
- **Selection Rationale:** dark slate-blue speckle; road ribbon UV'd
  ~6 m/tile gives optical flow without busy noise.
- **Downstream Use:** racing-surface `map` (Track.ts).
- **Critic Result:** accepted.

### tex-gravel — Gravel Apron Tile

- **Category:** textures
- **Status:** Integrated
- **Owner:** Coordinator Devin
- **Critic:** Coordinator
- **Model/Tool:** image_gen
- **Prompt File:** `assets/media/prompts/2026-09-14_wave6-texture-batch_v1.md`
- **Output:** `assets/media/textures/gravel_tile.png` → `assets/textures/gravel_tile.png` (512²)
- **Quality Unit:** ENV-004
- **Generation Parameters:** 1:1, 1024² → 512²
- **Downstream Use:** shortcut-apron `map` (Track.ts).
- **Critic Result:** accepted — apron reads as loose dirt vs asphalt.

### tex-cloud — Cloud Billboard Sprite

- **Category:** sprites
- **Status:** Integrated
- **Owner:** Coordinator Devin
- **Critic:** Coordinator
- **Model/Tool:** image_gen
- **Prompt File:** `assets/media/prompts/2026-09-14_wave6-texture-batch_v1.md`
- **Output:** `assets/media/textures/cloud_sprite.png` → `assets/textures/cloud_sprite.png` (512²)
- **Quality Unit:** ENV-003 (sky system)
- **Generation Parameters:** 1:1, white-on-black → luminance = `alphaMap`.
- **Downstream Use:** 14 drifting `THREE.Sprite` clouds, per-theme tint (Sky.ts).
- **Critic Result:** accepted — clean silhouette, no halo artifacts.

### tex-smoke — Smoke Puff Sprite

- **Category:** sprites / vfx
- **Status:** Integrated
- **Owner:** Coordinator Devin
- **Critic:** Coordinator
- **Model/Tool:** image_gen
- **Prompt File:** `assets/media/prompts/2026-09-14_wave6-texture-batch_v1.md`
- **Output:** `assets/media/textures/smoke_puff.png` → `assets/textures/smoke_puff.png` (512²)
- **Quality Unit:** VFX-001 (particle system)
- **Generation Parameters:** 1:1, white-on-black → luminance-as-alpha in
  the Fx shader (`lumaAlpha` path).
- **Downstream Use:** smoke pool texture — tire smoke, gravel dust,
  exhaust, explosion puffs (Fx.ts).
- **Critic Result:** accepted — soft edges, no box outline.

### tex-crowd — Grandstand Crowd

- **Category:** textures
- **Status:** Integrated
- **Owner:** Coordinator Devin
- **Critic:** Coordinator
- **Model/Tool:** image_gen
- **Prompt File:** `assets/media/prompts/2026-09-14_wave6-texture-batch_v1.md`
- **Output:** `assets/media/textures/crowd.png` → `assets/textures/crowd.png` (1024×288)
- **Quality Unit:** ENV-005 (scenery)
- **Generation Parameters:** 16:9 → center-band crop 1024×288.
- **Selection Rationale:** dense colorful blob-robot rows on navy;
  unlit material doubles as lit grandstand at night.
- **Downstream Use:** 3 grandstand tier faces (Track.ts buildGrandstand).
- **Critic Result:** accepted — reads as packed crowd at race distance.

### bb-grokkart / bb-turbo / bb-botpower — Sponsor Billboards

- **Category:** decals / backgrounds
- **Status:** Integrated
- **Owner:** Coordinator Devin
- **Critic:** Coordinator
- **Model/Tool:** image_gen
- **Prompt File:** `assets/media/prompts/2026-09-14_wave6-texture-batch_v1.md`
- **Output:** `assets/media/textures/billboard_*.png` → `assets/textures/billboard_*.png` (1024×576)
- **Quality Unit:** ENV-005
- **Generation Parameters:** 16:9, three poster variants (GROK KART /
  TURBO ZONE / BOT POWER) cycling across 7 trackside boards.
- **Selection Rationale:** bold retro-poster read at speed; original
  robot mascot + text rendered cleanly.
- **Downstream Use:** billboard panels along each circuit (Track.ts).
- **Critic Result:** accepted — legible, on-brand, no IP issues.
- **Rebrand (2026-09-17):** `bb-grokkart` replaced by `bb-grokbotkart` —
  `image_edit` on the original poster swapping only the logo text to
  "GROK BOT KART" (prompt archive `2026-09-17_billboard-rename_v1.md`).
  Artwork, palette, and tagline unchanged; re-sized to 1024×576.
