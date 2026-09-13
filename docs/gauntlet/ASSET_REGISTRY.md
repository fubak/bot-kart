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

*No assets registered yet.*
