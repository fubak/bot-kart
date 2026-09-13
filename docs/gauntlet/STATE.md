# Gauntlet Operational State

Last Updated: 2026-09-13
Coordinator: Devin Desktop (primary session)
Current Wave: 1→2 transition
Project Phase: Execution
Overall Status: EXECUTING

---

## Current Objective

Wave 1 spine is shipped and stable. Now deepening the game: AI opponents are
integrated and racing; next gaps are rival-asset distinctness, track
identity, items, and the live-race critique currently in flight.

---

## Active Managed Devins

- Gameplay Critic (background, subagent_general): live 4-kart race critique —
  pacing, collision feel, grid start, race integrity, stuck-AI detection.

Prior agents this wave: Gameplay Critic #1 (slice FAIL 4/10, static audit),
Critic #2 (live drive FAIL 5/10 — drift model rebuilt), Grok Concept Builder
(3 bot candidates; A canonical), Blender Asset Builder (kart-a.glb +
grokbot-a.glb + bot-a.glb delivered), AI Builder (AiDriver.ts + smoke harness).

---

## Current Integration Wave

Wave 1 — Technical Spine: COMPLETE (drive, drift/boost, VFX, audio, race
flow, HUD, AI field all live-verified). Operating in Wave 2 territory:
AI depth, items, track character.

---

## Highest Priority Quality Gaps

1. **Rival distinctness** — AI karts differ only by tint; need Bot B/C
   geometry + personality (heavy/power, speed archetypes).
2. **Track identity** — flat circuit; needs signature corner, elevation,
   curb alternation, corner signage. AI grazes walls at idx 380/430/701.
3. **Items/pickups** — none exist; needed for kart-genre depth.
4. **AI-vs-player interplay** — collision works; no AI avoidance of each
   other yet (they share the centerline).
5. Finish = banner only; no results screen.

---

## Current Blockers

None.

---

## Build State

- `tsc --noEmit`: clean; `vite build`: clean.
- Live: 4 racers on grid, AI laps at ~21 s, collision verified, position HUD
  live (P n/N). Draws ~368 / tris ~57k @ 75 fps with 3 AI karts loaded.
- Latest commit: kart-vs-kart collision + tinted rivals + per-racer Race.

---

## Latest Critic Results

- Slice critic (static audit): FAIL 4/10 — all findings fixed.
- Live critic #2: FAIL 5/10 — drift yaw runaway (62–80° slip) rebuilt and
  re-verified (stable ~28° slip, tier-1 charge); wall rebound + camera lag
  fixed. Live race critic: RUNNING.

---

## Persistent Context

`DEVIN_GAME_DIRECTOR.md` is the project constitution.
`STATE.md` is current operational memory.
`progress.json` is machine-readable execution state.
`QUALITY_UNITS.md` is the quality-work registry.
`ASSET_REGISTRY.md` tracks authored 3D assets.
`MEDIA_REGISTRY.md` tracks generated media.
`DECISIONS.md` records important long-lived decisions.
`TOOLCHAIN.md` describes confirmed available tools and invocation.

The Skills under `.agents/skills/` contain reusable execution procedures.
At the end of initialization, update status appropriately.
