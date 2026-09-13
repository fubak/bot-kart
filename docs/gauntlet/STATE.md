# Gauntlet Operational State

Last Updated: 2026-09-13
Coordinator: Devin Desktop (primary session)
Current Wave: 2→3 transition
Project Phase: Execution
Overall Status: EXECUTING

---

## Current Objective

Wave 4 COMPLETE and live-verified: 6 items (boost/missile/slick/shield/
ink/swap) with position-weighted rolls, distinct rival chassis, gravel
inside-cuts at both hairpins (geometry corrected to the true inside edge),
rubber-band pacing (2.96 s pack spread verified), driver celebrations,
anti-wedge AI recovery, Bot C AI shortcut-taker, confetti + positional
audio, title-orbit framing fix. Options menu live (`O`): master/music
volume bars, reduced-motion + minimap toggles — evidence `options.png`.
Second track SWITCHBACK RIDGE selectable on title via `T` (buildWorld
rebuild; AI laps verified; both gravel cuts probed to correct inside
edges). Driver limb emotes via the seated bots' articulated rigs —
victory arm-pump, spin flail, head-into-turn tracking.
Release evidence at RELEASE_EVIDENCE.md.

---

## Active Managed Devins

None running.

Prior agents: Critics #1 (4/10) and #2 (5/10 — both fixed), Grok Concept
Builder (A canonical), Blender Asset Builders (kart-a, grokbot-a, bot-a,
grokbot-b, grokbot-c + seated variants), AI Builder (AiDriver + smoke).

---

## Current Integration Wave

Wave 1 — Technical Spine: COMPLETE (drive, drift/boost, VFX, audio, race
flow, HUD, AI field all live-verified). Operating in Wave 2 territory:
AI depth, items, track character.

---

## Highest Priority Quality Gaps

1. ~~Settings menu~~ — DONE: O options overlay (volumes, reduced-motion,
   minimap) with arrow navigation.
2. ~~Second track~~ — DONE: Switchback Ridge, T to cycle on title.
3. ~~Bot animation~~ — DONE: node-rig emotes (arm pump/flail, head look).
4. **Item HUD iconography** — held item shows as text only; icons/pips
   would polish readability.
4. ~~Item variety~~ — DONE: 6 kinds + position-weighted rolls.
5. ~~Track shortcut~~ — DONE: 2 inside gravel cuts, cap 15 m/s.

---

## Current Blockers

None.

---

## Build State

- `tsc --noEmit`: clean; `vite build`: clean.
- Live: 4 racers on grid, AI laps at ~18-22 s, collision verified, position
  HUD live (P n/N). Draws ~160-400 / tris ~35-58k @ 73-75 fps.
- AI smoke (post-shortcut): all 3 skills 3 laps, 0 wall hits, traffic 7.8%
  lock — identical lap times to pre-shortcut baseline (no regression).
- Latest commit: gravel shortcut + wallHitCount metric split.

---

## Latest Critic Results

- Slice critic (static audit): FAIL 4/10 — all findings fixed.
- Live critic #2: FAIL 5/10 — drift yaw runaway + wall + camera fixed.
- Live critic #3: PASS 7.5/10 — re-verified all 4 wave-2 fixes working
  (finish ranking math, traffic model 3-4% contact, drift economy
  14-20s boost/racer, elevation+airtime). Defects fixed post-report:
  results DNF-freeze (2 Hz live re-render), landing squash/dust/thump,
  FINISH text overlap, -0 km/h. Minor noted: crest-lip contact 1/12
  passes, missiles beat off-line karts, no grass state.
- Release critic: PASS 8/10 — every wave-3 feature verified live across
  3 full races (player won one legitimately). Fixed post-report: P→R
  soft-lock, Space items while paused, pause coverage countdown/finished.
  Score arc: 4/10 → 5/10 → 7.5/10 → 8/10.

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
