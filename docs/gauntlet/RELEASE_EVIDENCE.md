# Release Evidence Index — Grok Bots Kart Racing

Dated: 2026-09-13. Index of verification evidence across all waves.
All captures are live in-game (Playwright-driven Chromium at :5173).

## Feature verification map

| Feature | Evidence | Status |
|---|---|---|
| Drive/drift/boost core | wave1/critic-3-drift-held, critic-7-boost | verified |
| Wall contact + barriers | wave1/walls, wall-check | verified |
| Drift/boost VFX | wave1/vfx-drift, vfx-drift2 | verified |
| Blender kart + Bot A | wave1/glb-kart, glb-drive, bot-a_preview | verified |
| Bot B/C rivals | wave2/grokbot-b-c previews, rival-bot-b, grid-rival-bots | verified |
| Race flow (3-2-1-GO→3 laps→finish) | wave1/race-countdown, race-finish | verified |
| AI opponents (skills, laps, collisions) | wave1/ai-field-01, ai-tinted-* | verified |
| AI traffic/overtake | smoke: 7.8% contact (was 91% pair-lock) | verified |
| Items: boxes/boost/missile | wave1/items-01, critic2 live hits | verified |
| Elevation + airtime | wave2/elevation-crest, critic2-crest-jump | verified |
| Chevrons + boost pads | wave2/chevrons-crest, chevrons-hairpin | verified |
| Results screen (live updates) | wave2/fix-results-live, wave3/gauntlet-results | verified |
| Title screen + press-to-start | wave3/title-screen | verified |
| Pause (P/Esc) | live eval — overlay + sim freeze | verified |
| Minimap | wave3/minimap-slick, gauntlet-results | verified |
| Slick item + spin-out | live teleport test (spinUntil fired) | verified |
| Driver expressiveness | code + live rotation checks | verified |
| Reduced motion (M) | code — shake+FOV gate | verified |
| Music (procedural) | wired into Audio, gesture-gated | verified |

## Whole-game gauntlet results

**Wave-3 autopilot race (full 3 laps, real race):**
- P1 BOT-B 1:00.59 · P2 BOT-C 1:04.01 · P3 BOT-A2 1:08.58 · P4 YOU 1:09.31
- All 4 racers finished; best laps 18.27–20.58s; 73 fps, 160 draws
- `wave3/gauntlet-results.png` — live results + minimap

## Critic score history

| Pass | Score | Outcome |
|---|---|---|
| Slice audit | 4/10 FAIL | drag/boost-jolt/steer/drift-slip fixed |
| Live critic #2 | 5/10 FAIL | drift runaway, wall rebound, camera lag fixed |
| Live critic #3 | 7.5/10 PASS | results DNF-freeze, landing feedback, cosmetics fixed |
| Release critic | 8/10 PASS | all wave-3 verified; pause soft-lock + item leak fixed |
| Wave-4 critic3 | 8/10 PASS | GP leak + foldback beaching fixed & re-verified; 3 LOW fixed post-report |

## Release-critic highlights (wave-3)

- 3 full races completed; player legitimately won race 3 (0:58.36 vs AI
  1:01–1:04) — the field is beatable but not free
- AI–AI proximity 0.8% of samples <2.75m (bar: <20%)
- ~47 boost-samples/20s across field (baseline target: >0; was 0 pre-fix)
- Minimap dots ≤1.3px error vs computed positions
- Pause/resume exact: sim/vel/pos frozen 0.000, 1:1 resume, no burst
- Music running (~20 osc/gain nodes/s), 0 console errors, 67–75 fps

## Performance

| Scene | fps | frame ms | draws | tris |
|---|---|---|---|---|
| Baseline slice | 75 | 13.3 (p99 18.1) | 14 | 5.6k |
| Wave-2 busiest | 75 | 13.4 (p99 18.3) | ~400 | 58k |
| Wave-3 finish | 73 | 13.7 | 160 | 34.6k |

Vsync-capped at ~75 Hz throughout; no frame drops observed.

## Regression harnesses

- `__gauntlet/ai-smoke.ts` — AI laps on elevated track (all 3 skills, 0 wall
  hits, monotonic pace) + multi-kart traffic-lock regression (7.8%).
- `__gauntlet/autopilot.js` — in-page player autopilot for full-race tests.

## Wave-4 additions (post-8/10)

- **Shield item** — absorb/consume verified live both paths
- **Rival chassis** — kart-b/kart-c GLBs integrated; 4 distinct silhouettes
- **Gravel shortcut** — hairpin inside-cut; 15 m/s cap, dust+rumble,
  visible apron + berms, minimap deviation confirmed
- **Finish confetti + positional rival audio**
- **wallHitCount split** — landing thumps no longer inflate wall metric

**Wave-4 gauntlet race:** P1 BOT-B 1:00.73 · P2 BOT-A2 1:00.95 ·
P3 BOT-C 1:02.68 · P4 YOU 1:54.53 (autopilot) — all finished,
`wave4/results-wave4.png` — 75 fps, 162 draws, 34.5k tris, 0 console
errors.

**Post-shortcut AI smoke:** solo 0.85/1.0/1.1 → 3 laps each, 0 wall hits,
best laps 22.02/18.65/17.73 (identical to pre-shortcut baseline);
traffic lock 7.8% unchanged.

## Wave-4 round 2 (pacing + items)

- **Rubber-band** — AI paceAssist vs player score; leaders clamp -0.05,
  trailing symmetric +0.08 cap. Live race: AI pack compressed to 14
  score-points apart at lap 3.
- **Ink item** — 5th kind; blooper semantics verified (all leaders
  inkedUntil+4s, shield absorbs, AI wander, player splat overlay
  `wave4/ink-splat.png`).
- **Celebration** — drivers bounce 0.012→0.12 + arm-rock on finish;
  all 3 AI confirmed `celebrating=true` post-race.
- **Gauntlet race (rubber-band build):** P1 BOT-B 1:01.10 · P2 BOT-C
  1:04.75 · P3 BOT-A2 1:08.68 · P4 YOU 1:23.13 — `wave4/results-rb.png`;
  75 fps, 160 draws, 34.5k tris, all celebrating.

## Wave-4 round 3 (pacing proof + shortcut fix + wedge recovery)

- **Rubber-band proof:** full race — all 4 finishers within 2.96 s
  (BOT-C 0:58.26 / BOT-A2 0:59.22 / BOT-B 0:59.27 / YOU 1:01.22),
  vs 7.6 s+ spreads before. `wave4/results-final.png`.
- **Shortcut geometry fix:** corner measured +1.79 rad LEFT — zone-1 was
  on the outside edge (detour); moved to the true inside cut.
  `wave4/shortcut-inside.png`. Bot C (takesShortcuts) verified riding
  the apron mid-apex (`surf=gravel` lat +6.0).
- **Anti-wedge recovery:** displacement detector + reverse-out; freed a
  pinned bot in 251 ms live.
- **Item set:** 6 kinds — boost/missile/slick/shield/ink/swap +
  position-weighted rolls.
- **Watch item:** BOT-B best lap 0:13.88 — likely a swap-teleport
  foreshortened lap (genre-consistent chaos; monitor).

## Wave 4 — Round 4 Additions (options menu, track 2, emotes, icons)

- **Options menu** — `O` overlay: master/music volume, reduced-motion,
  minimap; auto-pauses racing. `wave4/options.png`.
- **Track select** — `T` cycles PROVING GROUNDS / SWITCHBACK RIDGE on the
  title; `wave4/track-select-title.png`, `wave4/track2-title.png`.
- **Switchback Ridge race** — full 3-lap gauntlet: all 4 finishers
  (BOT-C 69.23 / YOU 72.06 / BOT-A2 73.83 / BOT-B 76.81), correct
  ranking, 75fps/152 draws, 0 console errors. `wave4/track2-racing.png`,
  `wave4/track2-results.png`.
- **Driver emotes** — arm pump/flail + head-into-turn via the seated
  rigs' nodes. `wave4/driver-emote.png`.
- **Item icons** — colored glyph + name on the held-item readout.
  `wave4/item-icon.png`.
- **Smoke regression** — identical baseline after the Track refactor:
  3 skills × 3 laps, 0 wall hits, traffic 7.8%.

## Wave 4 — Round 5 Additions (GP cup, track 3, difficulty, headlights)

- **Grand Prix** — `G` cup toggle, `N` leg advance, 10/7/5/3 points,
  FINAL STANDINGS champion. `wave4/gp-title.png`, `wave4/gp-standings.png`.
- **NEON NIGHT** — third circuit: flowing speed course, moonlit theme
  (hemi 1.35), gravel cuts verified at fracs 0.55/0.75 inside edges,
  AI ~20s laps. `wave4/track3-night.png`.
- **Difficulty** — options row scales AI skill −0.13/0/+0.05, persisted.
  `wave4/options-difficulty.png`.
- **Night headlights** — lamp quads on all karts + player SpotLight
  beam on night tracks. `wave4/night-headlights.png`.
- **Settings persistence** — volumes/difficulty/reduced-motion/minimap/
  last-track restored across reloads (localStorage).
- **Per-track themes** — sky/fog/sun/hemi per layout; Switchback golden
  hour vs Neon moonlight. `wave4/track2-sunset.png`.
- **Emote expansion** — eye blinks (120ms squash, 2.5–5.5s), rank-aware
  celebrations (winner pump vs gracious nod).
- **Smoke regression** — identical baseline after every refactor.
- **Critic2 post-fixes verified live** — modal menu (kart 0.0 m/s while
  arrows adjust), items cleared on R, Q→title, Backspace→centerline,
  Escape no longer starts race.

## Wave 4 — Critic3 pass (8/10) + fix batch

Full report: `wave4/CRITIC3_REPORT.md` (HARD difficulty, all 3 tracks,
full Grand Prix, 20-item verified-working list, clean console).

**HIGH defects — fixed mid-session + critic re-verified at runtime:**
- **D1 Grand Prix state leak** — post-cup title read "leg 4/3" and a
  later normal race rendered stale FINAL STANDINGS
  (`critic3-gp-leg43.png`, `critic3-gp-stale-standings.png`). Fix:
  `resetCup()` + title-return re-arms a fresh cup on PG + R on final
  standings starts a new cup + T locked while a cup is armed.
  Re-verified: fresh "leg 1/3" after abandon AND completion;
  `gp-final-v2.png` shows a second complete cup (BOT-B 27★).
- **D2 Foldback beaching** — global `nearestIndex` snapped karts/queries
  to parallel legs; a kart could sit on infield grass inside another
  leg's limit (`critic3-stuck.png`, `critic3-sb-stuck.png`). Fix:
  `Track.nearestIndexNear` (±48-sample windowed lookup) + per-kart
  `trackIdx` continuity hints through constrain/query/surfaceAt/
  heightAt/lookahead/progress + swap/respawn re-anchoring. Verified:
  mid-infield teleport clamps back to `lat -5.25` on-road.

**LOW defects — fixed post-report:**
- **D3 pause-input leak** — N advanced the cup behind the PAUSED
  overlay; now pause-gated + pause cleared on leg transition.
  Verified: N inert while paused, advances after unpause.
- **D4 wall-pin recovery** — new players couldn't discover ⌫/S;
  HUD now shows "STUCK? ⌫ respawn · S reverse" after ~2 s of
  throttle-held crawling <1.5 m/s (`wave4/d4-stuck-hint.png`).
- **D5 leg points presentation** — results rows show "+earned → total"
  instead of stale "0 pts".

**AI smoke post-refactor (all 3 tracks):** PG identical baseline
(0 hits, 22.22/18.72/17.72); SR 0 hits (best 21.5); NN 3 laps all
skills, 3-4 hits at frac ~0.61 (first NN baseline — watch item).

## Wave 4 — NN wall-clip fix + final regression sweep

**NN geometry fix (commit `3aaabcd`):** the frac ~0.58 control point
forced an R≈6/110° direction reversal that the AI's 1.1 s braking
horizon could not anticipate. Respread over two points → ~55° lean
(R 11-14) into an R 17-36 sweeper (`nn-switchback-fixed.png`,
`nn-rightlean.png`); braking horizon 1.1→1.3 s and curvature probes
3→6 (mirrored in `__gauntlet/autopilot.js`); gravel zone 1 tightened
to end before the new right-lean's outside edge.

**AI smoke — all clean (3 laps, all skills, 0 wall hits):**
- PG: 22.69 / 19.22 / 18.12 s
- SR: 26.42 / 22.46 / 21.62 s
- NN: 25.54 / 21.61 / 20.90 s (faster than the clipped baseline)

**Full Grand Prix on autopilot (all 3 legs, live browser):**
- Leg 1 PG: BOT-A2 1:01.27 (+10), BOT-B (+7), BOT-C (+5), YOU (+3)
- Leg 2 SR: BOT-C 1:11.69 (+10→15), cumulative 17/15/12/6
- Leg 3 NN: BOT-B 1:13.91 (+10→22); N → FINAL STANDINGS sorted
  24/22/20/9, ★ BOT-A2 champion (`gp-champion.png`)
- Q → title shows fresh "GRAND PRIX — leg 1/3" (no leg-4/3 leak)
- Autopilot wall-contact events reflect the simple harness driver;
  the shipped AI's 0-hit smoke results are the regression metric.

**Performance (mid-race, busiest scene):** 68.9 fps avg, p50 14.6 ms,
p95 15.1 ms, worst 15.6 ms, 494 draws / 67k tris — steady pacing,
no stutter; comfortably above the 60 fps floor.

**Console audit:** 0 errors / 0 warnings across the full GP session.
**Build:** `tsc --noEmit` clean; `vite build` clean (677 KB → 177 KB
gzip; >500 kB chunk advisory is Three.js in the main bundle).

**Key remapping (commit `21fdfad`):** options gains six bind rows
(THROTTLE/BRAKE/STEER L/STEER R/DRIFT/ITEM) + RESET BINDINGS, persisted
to `grok-kart-bindings`. Verified live: W→I rebind survives reload, a
bound key starts the race from title and drives (28 m/s), duplicate
binds displace to `—`, reserved keys (P) rejected without pausing,
Esc cancels capture, RESET restores defaults (`options-rebind.png`).

**Persisted lap records (this commit):** per-track best-lap records
stored under `grok-kart-records` (`{trackIdx: seconds}`). Detected
only on gate-validated player laps (post `race.update` lap-count
delta). Verified live: seeded 999 s record → title shows
`rec 16:39.00` → three autopilot laps rewrote it 19.87 → 19.36 →
19.35, `★ NEW LAP RECORD!` toast flashed ~2.5 s on each record
crossing, results row shows `best 0:19.35 ★REC`
(`lap-records-results.png`). Slower laps do not overwrite (a ~140 s
wall-pinned lap left the 105 s record intact). PG smoke re-run:
18.12 s best, 0 wall hits — identical baseline.

**Critic5 (6/10) fix batch (this commit):** 7 defects fixed + verified.
D1 HIGH — AI wall-beach deadlock: wedge escape is now a ladder
(reverse ~3 s → forward ~3 s → lakitu respawn onto the racing line,
the same recovery the player gets); wedge sampling runs before the
recovery early-return so a misaligned+frozen kart still reaches it.
Verified: a deliberately wall-pinned AI kart recovered and finished
its race (all 3 AI finishers); SR smoke identical (26.42/22.46/21.62,
0 hits). D2 — ★REC no longer leaks: recordSetThisRace clears in
buildWorld (covers GP legs, cup abandon, T-switch) plus the existing
restartRace reset. D3 — records load validates per-value (finite
positive numbers): seeded {"0":"garbage","1":-5} shows no rec instead
of NaN/bricked. D4 — player stuck hint is displacement-based
(<2 cm/frame) — fires on a pinned kart reporting phantom ~1.6 m/s.
D5 — M reduce-motion persists via saveSettings. D6 — PAUSED no
longer stacks over RESULTS. D7 — unbound drive bindings render
"arrows — drive · drift unbound" instead of "—AJD".
