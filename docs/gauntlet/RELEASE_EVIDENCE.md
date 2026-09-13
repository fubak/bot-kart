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
| Release critic | pending | wave-3 whole-game pass |

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
