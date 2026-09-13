# The Gauntlet

The Gauntlet is this project's autonomous multi-agent development system.
A **Coordinator Devin** decomposes the game into quality units, launches
**Builder Devins** to implement them, and **Critic Devins** to verify real
in-game results — repeating in waves until the game meets the quality bar.

```text
Coordinator Devin
    │
    ├── Gameplay / Engineering Devins
    │       └── Independent Critics
    │
    ├── Grok Imagine Concept / Media Devins
    │       └── Concept Critics
    │
    ├── Blender Asset Devins
    │       └── In-Game Visual Critics
    │
    ├── QA / Performance Devins
    │
    └── Integration Devin
            └── Whole-Game Critics
```

## File map

| File | Role |
|---|---|
| `DEVIN_GAME_DIRECTOR.md` | **Project constitution.** Authoritative operating spec for every Devin. The owner pastes the full Game Director specification here. |
| `STATE.md` | Operational memory — current wave, objective, blockers, next actions. |
| `progress.json` | Machine-readable execution state (feeds `/__gauntlet` dashboard). |
| `QUALITY_UNITS.md` | Registry of decomposed, independently verifiable work units. |
| `ASSET_REGISTRY.md` | 3D assets: `.blend` source → GLB export → integration status. |
| `MEDIA_REGISTRY.md` | Grok Imagine outputs selected for refinement or shipment. |
| `DECISIONS.md` | ADR log of significant, long-lived decisions. |
| `ART_DIRECTION.md` | Art principles; detailed direction filled in by Art Director. |
| `PERFORMANCE_BUDGET.md` | Perf goals; hard budgets after baseline profiling. |
| `TEST_MATRIX.md` | Testing categories the project must exercise. |
| `TOOLCHAIN.md` | Verified tools, versions, invocations. Trust this over memory. |

## Where things live

- **Skills:** `.agents/skills/<name>/SKILL.md` — reusable execution procedures
  every Devin can invoke (project scope, committed to git).
- **Blender source:** `assets/blender/<category>/` — editable `.blend` files.
- **Runtime 3D assets:** `assets/exported/<category>/` — optimized GLB.
- **Generated media:** `assets/media/<category>/` — Grok Imagine output.
- **Prompts:** `assets/media/prompts/` — archived prompts for kept generations.
- **Scripts:** `scripts/dev|assets|qa|media/` — repo automation.
- **Dashboard:** `/__gauntlet` (dev-only) reads `progress.json` via the
  Vite middleware in `vite.config.ts`.

## Roles

- **Coordinator Devin** — interprets `DEVIN_GAME_DIRECTOR.md`, sequences waves,
  launches and reviews managed sessions, owns `STATE.md`/`progress.json`.
- **Builder Devins** — implement quality units; claims require evidence.
- **Critic Devins** — verify units *in the running game*, never from Builder
  summaries. Visual/gameplay acceptance requires captured evidence.
- **Integration Devin** — merges waves, resolves cross-unit conflicts, runs
  whole-game critics.
- **Media/Asset Devins** — Grok Imagine and Blender pipelines per the skills;
  their output is critiqued in-engine before integration.

## Ground rules

1. Read `DEVIN_GAME_DIRECTOR.md` before any substantial work.
2. `TOOLCHAIN.md` lists *verified* tools — do not invent commands or MCP names.
3. Everything shipped is original; never reproduce protected Nintendo or
   third-party assets.
4. Update `STATE.md` and `progress.json` at the end of every session.
