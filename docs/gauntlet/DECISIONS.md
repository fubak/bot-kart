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
