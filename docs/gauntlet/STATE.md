# Gauntlet Operational State

Last Updated: 2026-09-13
Coordinator: Devin Desktop (primary session)
Current Wave: 2→3 transition
Project Phase: Execution
Overall Status: EXECUTING

---

## Current Objective

Wave 4 + post-critic expansion COMPLETE and live-verified: 6 items (boost/missile/slick/shield/
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
Grand Prix cup mode (G): 3-race championship with 10/7/5/3 points and
final standings. Options menu fully modal + persisted + difficulty
(EASY/NORMAL/HARD scales AI skill). Night headlights on NEON NIGHT.
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

1. ~~Settings menu~~ — DONE: modal O options (volumes, difficulty,
   reduced-motion, minimap), persisted.
2. ~~Second track~~ — DONE ×2: Switchback Ridge + Neon Night, themed.
3. ~~Bot animation~~ — DONE: node-rig emotes + blinks.
4. ~~Item icons~~ — DONE: colored glyphs.
5. ~~Grand Prix~~ — DONE: 3-leg cup with standings.
6. **Key remapping** — fixed bindings only.
7. **Bot leg animation** — legs static; arms/head/eyes done.
4. ~~Item variety~~ — DONE: 6 kinds + position-weighted rolls.
5. ~~Track shortcut~~ — DONE: 2 inside gravel cuts, cap 15 m/s.

---

## Current Blockers

None.

---

## Build State

- `tsc --noEmit`: clean; `vite build`: clean (677 KB → 177 KB gzip).
- Live: 4 racers on grid, AI laps ~18-27 s depending on track, collision
  verified, position HUD live. Mid-race 68.9 fps / p95 15.1 ms /
  worst 15.6 ms at 494 draws / 67k tris — steady, no stutter.
- AI smoke all 3 tracks CLEAN — 0 wall hits, all skills, 3 laps:
  PG 22.69/19.22/18.12 · SR 26.42/22.46/21.62 · NN 25.54/21.61/20.90.
  NN V-kink (R≈6/110° at frac ~0.58) softened to a ~55° lean +
  braking horizon 1.3 s / 6 curvature probes → the 3-4 hit clip is gone.
- Full GP autopilot pass verified: leg points accumulate, final
  standings sort with ★ champion (BOT-A2 24), title re-arms fresh cup.
- Console audit: 0 errors / 0 warnings across the GP session.
- Latest commits: `ee3770f` critic3 fix batch → `3aaabcd` NN geometry +
  AI braking horizon.

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
- Wave-4 critic2: 7.5/10 — all new features verified working on both
  tracks (options gains plumbed, T-swap world rebuild, emotes, glyphs,
  75 fps both, 0 console errors). Defects fixed post-report: options
  menu now modal (pause-all-phases + key capture), Items.reset() on
  restart, Q quit-to-title, Backspace respawn, DebugHud hidden,
  title-start key whitelist. Score arc: 4→5→7.5→8→7.5(fixes in).
- Wave-4 critic3 (HARD playtest, 3 tracks + full GP): 8/10 PASS —
  `evidence/wave4/CRITIC3_REPORT.md`. 20-item verified-working list.
  Both HIGH defects fixed mid-session + critic re-verified at runtime:
  D1 GP state leak (leg 4/3 title, stale FINAL STANDINGS — resetCup +
  title re-arm + R-on-standings fresh cup + T locked while armed);
  D2 foldback beaching (nearest-sample snap onto wrong leg —
  nearestIndexNear continuity hints through kart/progress/AI lookups).
  LOW defects fixed post-report: D3 N leaking through paused results
  (pause-gated + pause cleared on phase transition), D4 wall-pin
  recovery undiscoverable (STUCK? ⌫/S hint after 2 s <1.5 m/s under
  throttle), D5 leg results "0 pts" (now "+earned → total").
- Final regression sweep: NN wall-clip watch item RESOLVED (V-kink
  softened + longer braking horizon — 0 hits all tracks); full GP on
  autopilot end-to-end (standings/champion/title re-arm correct);
  68.9 fps mid-race; 0 console errors; build clean.

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
