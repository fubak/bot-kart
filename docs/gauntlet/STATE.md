# Gauntlet Operational State

Last Updated: 2026-09-14
Coordinator: Devin Desktop (primary session)
Current Wave: 7 — meta-gauntlet (bounded sub-gauntlets per workstream)
Project Phase: Execution
Overall Status: EXECUTING

---

## Meta-Gauntlet (wave 7) — active plan

Assessed live: 75 fps / p95 14.9 ms baseline, 0 console errors, smoke
baseline intact (PG 22.69/19.22/18.12 · 0 hits · stalled 0).
Coordinator fix committed: title/menu legibility + 25 m prop-exclusion
ring around the spawn orbit + checkered gantry banner (commit cfda739,
evidence `wave7/fix-title-*.png`).

Workstreams (serial sub-gauntlets, file-owned):
1. WS-POST post-processing — INTEGRATED (3417943, POST-001)
2. WS-DRESS set-dressing density — INTEGRATED (b981dea, DRESS-001)
3. Critic 9: 7.0/10 (0H/4M/8L) — `wave7/CRITIC9_REPORT.md`
4. FIX-001 critic-9 batch — INTEGRATED (this wave): kerbs grounded,
   AI progress watchdog + 5 s wedge rung (16/16 finishes), NN gate
   sabers tamed, speed CA halved, organic ink splats, title hints,
   PRESS ENTER floor, headlight/item-box bloom, GP delta, flag masts,
   billboard z-fight, minimap alpha. Smoke identical ×3; NN live
   67.7 fps p95 15.3 ms.
5. WS-ANIM world animation — INTEGRATED (ANIM-001): crowd wave,
   spin boards, canopy sway, windmill PG+SR, NN scanline pylon
6. WS-MAT material richness — INTEGRATED (MAT-001): kart clearcoat,
   RoomEnvironment IBL 0.3/0.22, road roughnessMap, gantry lamps,
   checkShaderErrors off for benign X4122 noise
7. Critic 10: 7.0/10 (1H/7M/6L) — `wave10/CRITIC10_REPORT.md`
8. FIX-002 critic-10 batch — INTEGRATED: battered wall footings to
   grade, kerbs 0.08, item-box under bloom gate, GP provisional rows,
   rubber-band honored (gain 0.006/up 0.14), head matte-down, Q-quit
   disarms cup. Smoke exact; NN 68.2 fps p95 15.4.
9. Next: WS-CHAR (kart/char life) → WS-AUDIO → critic 11 → final gate.
Critic after every 1–2 integrated streams; final critic ≥8.5/10 or two
consecutive clean passes to ship.

## Current Objective

**META-GAUNTLET CLOSED — criterion met at wave 19.** Critic-19 scored
**8.5/10, CLEAN PASS** (no defect ≥MED), satisfying the ≥8.5 close
rule. All six wave-7+ workstreams integrated and independently
verified (WS-POST, WS-DRESS, WS-ANIM, WS-MAT, WS-AUDIO, CHAR-005);
ten fix batches (FIX-001…010) closed every critic finding through
wave 19. Final numbers: ~68 fps / p95 ~15.4 ms on NN busiest scene;
smoke baselines exact on all 3 tracks; 0 console errors/warnings;
full 3-leg GP + gamepad-only results navigation verified end-to-end.
Close-out record: `evidence/wave19/CRITIC19_REPORT.md`,
`QUALITY_UNITS.md` FIX-001…010, `RELEASE_EVIDENCE.md` final section.

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
6. ~~Key remapping~~ — DONE: 6 bind rows + RESET in options, persisted,
   conflict-safe, reserved keys rejected (evidence `options-rebind.png`).
7. ~~Bot leg animation~~ — DONE: pedal work (throttle/brake), spin kicks,
   celebration kicks via leg_l/leg_r nodes.
4. ~~Item variety~~ — DONE: 6 kinds + position-weighted rolls.
5. ~~Track shortcut~~ — DONE: 2 inside gravel cuts, cap 15 m/s.
8. **Remaining gaps:** none documented — all critic-identified items closed.

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
- Latest commits: `2a85fa4` lap records → `61c433b` critic5 batch →
  `f593a78` vendor chunk split → `54c82ea`/`5fe6294` critic6 batch →
  wave-6 visual production (uncommitted at doc time — see below).
- **Wave 6 — Visual Production (this session):** grok-image texture
  batch (9 assets → `assets/textures/`), `Sky.ts` gradient dome +
  sun/stars + drifting clouds + fog-proof mountain silhouettes,
  `Fx.ts` shared instanced particle system (sparks + smoke, replaces
  per-kart KartVfx), textured road/grass/gravel with real UVs +
  checker start, grandstand+crowd, sponsor billboards, balloons,
  flags, ACES + PCF shadow-mapped sun + per-theme lighting + night
  fill light, missile/trail/box/slick/pad item-visual rebuild.
  Live-verified on all 3 tracks; AI smoke identical baselines
  (0 wall hits, stalled 0 ×3); 68.3 fps / p95 15.2 ms @ ~600–790
  draws / ~100k tris; build clean (game 92 kB + three vendor 612 kB,
  textures as cached assets). Evidence: `evidence/wave6/`.
- Wave-6 critic8 (visual review): 7/10 —
  `evidence/wave6/CRITIC8_REPORT.md` (60 shots). Skies, particles,
  items, GP, records, 0 console errors all held. Fixed: D1 billboard
  black-monolith backs (mirrored poster planes), D2/D3 title orbit
  gantry clip + SR rock burial (r 8.5→5.2 inside the gantry footprint,
  look +1.3 drops kart below menu text), D4 scatter through grandstand
  (16 m exclusion), D5 AI wall-creep stragglers — escape required only
  displacement so grinders looped forever; now requires !onWall plus a
  grind detector (onWall && speed<8, 4 s → ladder). Smoke identical,
  stalled 0. LOW batch: chevron boards → posted thin boxes, billboards +
  grandstand grounded to field level, anisotropy 4→8.
- **Wave-6 whole-game gauntlet: PASS.** Full GP on the final build —
  all 3 legs, every racer finished every leg (grind fix eliminated
  straggler beaches), FINAL STANDINGS sorted (★ YOU 23 pts champion,
  ★REC legit), console 0 errors/0 warnings, 68.7 fps p95 15.1 ms @
  639 draws / 96k tris on Neon Night. Evidence: `gp-*.png`,
  `fix8-*.png` in `evidence/wave6/`.
- Wave-4 critic5 (lap-records playtest): 6/10 —
  `evidence/wave4/CRITIC5_REPORT.md`. Records verified end-to-end
  (per-track persist, toast timing, no-overwrite, AI can't set).
  Defects fixed + verified: D1 HIGH AI permanent wall-beach (wedge
  escape ladder reverse→forward→lakitu-respawn), D2 ★REC leak across
  buildWorld, D3 corrupt record values brick track (per-value
  validation), D4 phantom 1.6 m/s pin defeats hint (displacement-based
  detection), D5 M not persisted, D6 PAUSED over RESULTS, D7 "—AJD"
  unbound hint. Score arc: …8→7.5→6 (all fixed).
- Wave-4 critic6 (fix re-verify): 6/10 —
  `evidence/wave4/CRITIC6_REPORT.md`. 6/7 critic5 fixes re-verified
  clean. Defects fixed: D1 residual — ladder's speed-exit reset
  stuckTime into a reverse/re-wedge limit cycle (nose-in pins froze
  65-150 s); now anchor-based wedge state (wall-clock, clears only on
  >2.5 m real displacement, guaranteed lakitu at 6 s — live nose-in
  tests escape ~2 s). D8 NEW — swap teleports desynced RacerProgress
  (progress inflation, wrongWay lock, foldback wrong-leg): resync()
  re-anchors trackers to the landing position/leg, mask resets so
  teleports can't skip gates. SR smoke identical + stall probe 0.

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
- Wave-4 critic4 (post key-remap playtest): 7.5/10 —
  `evidence/wave4/CRITIC4_REPORT.md`. All prior fixes held; full
  verified-working list incl. mid-race rebind hot-swap. Defects fixed
  + verified (bd09ab8): HIGH nose-in wall velocity runaway (frame-
  derived contact normal — parked kart read 28 m/s, defeated stuck
  hint, stored a free launch; now 0.03 m/s + hint fires), MED universal-
  alternate bind footgun (arrows/RShift rejected in capture), MED stale
  key hints (item/stuck/title all render live bindings), LOW ×5 (M on
  title, options-over-PAUSED, silent reserved denial → NOT A DRIVE KEY
  flash, malformed binding validation, Esc closes options on title).
- Leg animation shipped (a23641e): pedal work + spin/celebration kicks —
  every documented quality gap now closed.

### Meta-gauntlet arc (waves 7–19) — CLOSED at 8.5/10

- Wave-7 workstreams: WS-POST (3417943 — MSAA HDR bloom/ACES/grade/
  vignette/speed-CA), WS-DRESS (b981dea — 2.2–3.2× themed scatter with
  foldback-safe clearance), FIX-001 (84bd608 — critic-9 batch: seated
  kerbs, AI progress watchdog, NN gate-saber bloom, organic ink).
- Wave-8: WS-ANIM (71dde86 — crowd wave, spinning feature boards,
  canopy sway, windmill, NN scanline pylon).
- Wave-9: WS-MAT (c2e49ee — kart clearcoat, RoomEnvironment IBL,
  road roughnessMap + tire polish, gantry lamp strip) + FIX-002
  (8b7d7d6 — battered wall footings to grade, GP provisional rows,
  rubber-band cap honored, Q-quit cup disarm).
- Wave-10: WS-AUDIO (2173ae0 — full item SFX, per-track music themes,
  ambience beds, UI cues, champion jingle) + CHAR-005 (a882d68 —
  idle driver look-around).
- Critic-11 7.5 → FIX-003 (7c24ccb — player-only standstill pivot
  steering, AI post-recovery careful mode, NN sky lift, hat() buffer
  cache, banner underside emissive, title-ink-overlay cleanup).
- Critic-12 7.6 → FIX-004 (ae63043 — dirSign hysteresis kills pin
  jitter, grind-assist pursuit pulls bots along wall faces, stuck-hint
  pivot immunity, AudioParam finite guards).
- Critic-13 **8.4 — first CLEAN PASS**; coordinator pivot-fade widen.
- Critic-14 7.8 → FIX-005 (afa0fe4 — swap resync gate-mask preserves
  lap eligibility both directions, respawn-during-spin fix, texture
  disposal on rebuild 39→36 flat, `…` provisional glyph).
- Critic-15 8.0 → FIX-006 (8ebe5c0 — resync score rebase preserves
  back-grid unwrapped progress, results pause-trap fix, shadow map
  2048→1536 for p95 headroom, results row nowrap).
- Critic-16 7.7 → FIX-007 (39873a2 — pause gate on `finished`,
  Tab/Space/arrow preventDefault, tie-consistent GP positions/points,
  final-leg champion tiebreak).
- Critic-17 7.7 → FIX-008 (a7d28ca — teleportedThisLap excludes swap
  laps from records, R disabled mid-GP, G-disarm keeps track).
- Critic-18 → FIX-009 (dbf5dbb — persisted volume applied post-unlock,
  Enter/Esc pad aliases on results, finished racers excluded from
  swap targets).
- Critic-19 **8.5/10 — CLEAN PASS — GAUNTLET CLOSED** → FIX-010
  (9e50551 — GO camera settle 10.5→0.18 m, per-field settings
  validation, blur auto-pause, footer pad-alias hints, sky mountain
  disposal kills ~2 geo/rebuild leak).
- Domain master gauntlet (waves 20–21): SG-11..15 shipped
  roulette/drafting/hop/UMT, streak+tier VFX, 15 SFX cues, HUD
  ticker/lamps, hero AI karts + NN mid-band; critic-21 **8.5 CLEAN**
  (d58111f docs).
- Wave-22 **performance gauntlet CLOSED**: >30 fps + no-stutter met at
  68 fps flat — p99 15.6 ms / worst ≤15.9 ms / 0 frames >25 ms on all
  three tracks racing. Fixes: GLB kart static-mesh merge (1043→~390
  draws), per-frame alloc elimination (324→~0 KB/frame GC churn),
  shader/texture prewarm at buildWorld + item prewarm group (no
  mid-race compiles). 4× CPU throttle: 47.6 fps. Evidence in
  PERFORMANCE_BUDGET.md + RELEASE_EVIDENCE.md.

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
