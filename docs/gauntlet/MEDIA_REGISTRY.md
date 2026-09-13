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

*No media registered yet.*
