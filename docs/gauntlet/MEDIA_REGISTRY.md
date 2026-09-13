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
