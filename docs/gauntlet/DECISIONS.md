# Decision Log

ADR-style record of significant architectural and product decisions.
Only long-lived decisions belong here — not implementation trivia.

## Template

```markdown
## ADR-<n>: <title>

- **Date:** YYYY-MM-DD
- **Status:** Proposed | Accepted | Superseded by ADR-<m> | Reverted
- **Decided by:** <role/session>
- **Context:** <forces and constraints that make this decision necessary>
- **Decision:** <what was decided>
- **Consequences:** <what becomes easier/harder; what this rules out>
```

---

## ADR-000: Runtime stack — Vite + TypeScript + Three.js

- **Date:** 2026-09-13
- **Status:** Accepted
- **Decided by:** Initialization Devin
- **Context:** The project is a browser-based 3D kart racer. Repository was
  empty; a lean, fast-iterating stack was needed that suits WebGL development
  and headless browser testing.
- **Decision:** Vite 8.2.2 + TypeScript 7.0.2 + Three.js 0.185.1, npm as the
  package manager. No UI framework — menus/HUD will be DOM-over-canvas until
  proven insufficient (see `PERFORMANCE_BUDGET.md`).
- **Consequences:** Minimal dependency surface; hot-reload iteration; trivial
  to automate with playwright-cli / chrome-devtools MCP. If HUD complexity
  later demands a framework, that requires a new ADR.

## ADR-001: Asset pipeline — Blender source → GLB → optimization tools

- **Date:** 2026-09-13
- **Status:** Accepted
- **Decided by:** Initialization Devin
- **Context:** Assets must be editable, reviewable, and optimized for browser
  delivery.
- **Decision:** `.blend` sources under `assets/blender/`; runtime GLB exports
  under `assets/exported/`; optimization via `gltf-transform`, `gltfpack`, and
  `toktx` (KTX2). Exact coordinate/scale conventions are deferred to the
  Coordinator's first wave.
- **Consequences:** Clear source/runtime split; format is the Three.js-native
  GLB; compression tools verified installed.

## ADR-002: World scale, axes, and pivots

- **Date:** 2026-09-13
- **Status:** Accepted
- **Decided by:** Coordinator Devin (preflight, Wave 1)
- **Context:** All 3D work (runtime geometry, Blender assets, physics tuning)
  needs one convention before any production (spec §52).
- **Decision:**
  - 1 world unit = 1 meter. Y-up, right-handed; "forward" is **-Z**
    (Three.js camera convention; kart heading θ=0 faces -Z).
  - Kart: ~1.6 m wide × ~2.6 m long, origin at ground center between wheels.
  - Racer: ~1.2–1.6 m tall seated, origin at feet/seat base.
  - Wheels: ~0.45 m diameter, pivot at axle center.
  - Track: ~12 m road width (≈7 kart widths), origin at spline start.
  - GLB export: +Y up (`export_yup=True`), apply transforms, keep pivots
    semantic (wheels at axles, kart at ground center).
- **Consequences:** Physics constants are human-scale (speeds in m/s);
  Blender assets authored to these dims drop in without rescaling.

## ADR-003: Fixed-timestep sim + debug hooks

- **Date:** 2026-09-13
- **Status:** Accepted
- **Decided by:** Coordinator Devin (preflight, Wave 1)
- **Context:** Kart physics must be deterministic and testable; Critics and
  Playwright need introspection (skills: browser-game-testing,
  performance-profiling).
- **Decision:** Simulation runs at fixed 120 Hz with an accumulator and a
  clamped frame delta; rendering decoupled via `setAnimationLoop`. All tuning
  constants live in `src/config/tuning.ts` (data-driven, spec §48). A
  `window.__game` handle exposes scene/renderer/sim state for QA
  (`evaluate_script`, `playwright-cli eval`). Custom arcade physics — no
  physics engine; kart feel needs bespoke slip/drift, not rigid-body realism.
- **Consequences:** Deterministic sim enables replay tests and seeded
  scenarios later; debug handle is the QA contract — keep it stable.

## ADR-009: Track layouts are data, worlds are rebuilt on select

- **Date:** 2026-09-13
- **Status:** Accepted
- **Decided by:** Coordinator Devin
- **Context:** A second circuit was the biggest longevity gap. Track
  geometry/scenery/items/minimap/race all derive from a Track instance,
  which was constructed once at Game init.
- **Decision:** `TRACKS[]` holds `TrackLayout { name, points, gravel }`;
  `Game.buildWorld(idx)` disposes the old track (GPU traversal) + items +
  minimap, rebuilds everything, and re-grids the persistent karts.
  Track select lives on the title screen (`T`) — swapping mid-race is
  out of scope (karts would need re-spawning anyway).
- **Consequences:** New circuits are pure data additions; gravel-zone
  placement must be curvature-verified per layout (a zone on the wrong
  edge is a detour, not a cut — see TRACK-006). `__game` uses live
  getters so QA handles survive world rebuilds.

## ADR-010: Grand Prix is game-mode state, not a separate scene

- **Date:** 2026-09-13
- **Status:** Accepted
- **Decided by:** Coordinator Devin
- **Context:** With 3 layouts live, a championship mode needed only
  leg tracking + points — not a second scene graph or menu system.
- **Decision:** `gpMode/gpLeg/gpPoints` live on Game; `N` on the
  results screen scores the leg by finishing position and calls
  `buildWorld(nextIdx)` + `beginCountdown`. The results table doubles
  as the standings screen (ranked by cup points on the final leg).
- **Consequences:** Cup legs reuse the standard race/results flow —
  no parallel UI to keep in sync. Fixed order (Proving → Switchback →
  Neon); cup selection/difficulty-cup variants remain future gaps.
