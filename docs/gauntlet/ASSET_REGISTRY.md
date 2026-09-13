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

### kart-a — Bot A's kart (rounded pod)

- **Category:** karts
- **Status:** Integrated (unoptimized — 212 KB, 6.2k verts; meshopt deferred)
- **Owner:** Blender Asset Builder subagent
- **Quality Unit:** kart visuals (placeholder swap)
- **Blender Source:** `assets/blender/karts/kart-a.blend`
- **Runtime Export:** `assets/exported/karts/kart-a.glb`
- **Art-Direction Notes:** rounded pod body, rear roll-cage — matches
  Candidate A "friendly" silhouette language
- **Triangles:** ~27k render / 6.2k upload verts | **Materials:** ~6 |
  **Textures:** 0 (vertex/plain materials)
- **Animation:** none | **Collision:** box clamp via track constraint |
  **LOD:** none
- **Performance Notes:** +55 draw calls (72 total) — many small primitives;
  batch/merge when karts are finalized
- **Critic Result:** pending fresh critic
- **Biggest Gap:** no named wheel animation hooks (Cylinder.* heuristic);
  driver is still the placeholder icosahedron bot
