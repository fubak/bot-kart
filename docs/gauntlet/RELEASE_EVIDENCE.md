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
