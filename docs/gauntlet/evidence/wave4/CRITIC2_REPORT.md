# GROK KART — Release Candidate Playtest Review (Critic 2, Wave 4)

**Score: 7.5 / 10**

Browser-driven playtest via live Playwright session against `http://localhost:5173/` (dev server, Vite). All claims below were verified at runtime through `window.__game` probes and synthetic input — nothing assumed. ~25 min session, zero console errors/warnings the entire run.

Evidence screenshots: `critic2-*.png` in this folder (13 shots).

---

## Verified working (with numbers)

### Race core — PROVING GROUNDS, full 3-lap race
- Phase flow: `title → countdown (3.0s) → racing → finished`. HUD showed `3`, then `GO!` on transition; input correctly locked during countdown (karts inert until GO).
- Lap counting: exactly 3 laps recorded per racer (`racers[i].lapTimes`). Player laps 44.9 / 20.2 / 24.2 s; AI laps 19.3–24.4 s.
- Positions + results: `positionOf` consistent with finish order both live and on the results table. Results: `P1 BOT-B 1:02.21 (best 19.30) · P2 BOT-A2 1:05.06 · P3 BOT-C 1:05.44 · P4 YOU 1:29.29`. `raceTime` 89.29 s matches the results time (excludes countdown).
- Celebrations: all 4 karts `celebrating=true`; driver `arm_r` rotation at −2.2 rad vs base 0.0 (visible pump; `critic2-results-t1.png`).

### Track select — SWITCHBACK RIDGE
- `T` on title swaps `track.name` PROVING GROUNDS → SWITCHBACK RIDGE; title UI renders `◂ SWITCHBACK RIDGE ▸ [T]` (`critic2-title-track2.png`). `T` ignored while options open and mid-race (verified — no world rebuild, sim continued).
- Full track-2 race: AI lapped cleanly (lap times 20.8–27.6 s, 0–2 wall hits each, all finished); results ordered correctly (P1 BOT-B 1:12.04); celebrations fired (`critic2-racing-t2.png`, `critic2-results-t2.png`).
- Item boxes: 24/24 land on the road (lateral ±3 m vs 5.25 m drivable edge; 0 on gravel, 0 off-road).
- Gravel aprons exist inside both corners: `surfaceAt` returns `gravel` at 6–7.5 m lateral in zones [0.485–0.535, side −1] and [0.68–0.73, side +1].
- Minimap rebuilds per track — visibly different outline in the two racing screenshots; hidden on title as designed.

### Options menu (O)
- Opens on title **without** starting the race (`phase` stayed `title`); `Enter`/`T` blocked while open; `O` closes without starting.
- Arrow navigation wraps both directions (sel 3→0 via Down, 3→2→1→0 via Up×3 verified).
- MASTER VOL: 2×Left → bar reads 8, `audio.master.gain` 0.55 → 0.44 (= 0.55×0.8 — plumbing verified, not just the bar).
- MUSIC VOL: 2×Right → bar 10, `audio.musicBus.gain` 0.8 → 1.0.
- REDUCED MOTION → `chaseCam.reducedMotion` flips; `M` hotkey does the same and stays in sync.
- MINIMAP OFF → canvas `display:none` live mid-session; ON restores.
- O during `racing` pauses the sim (sim.time frozen while menu open) — the advertised behavior works on the main path.

### Driver limb emotes
- Finish: `arm_r` −2.2 rad vs base 0 on all 4 karts (pumping).
- Spin-out: AI kart with `isSpinning` → `arm_l` −1.40 / `arm_r` −2.19 vs base 0 (flail).
- Head-look: steering left (`steerVisual` −1) → `head` rotation.y +0.42 rad vs base 0 — looks into the turn.

### Items
- Pickup → HUD bottom-right shows `◯ SHIELD [space]` (glyph + name, `critic2-item-hud.png`) → Space consumes it.
- Verified end-to-end: shield (bubble mesh + `shieldUntil` +8 s), boost (`boostTimer` 1.4 s tier), missile (travels centerline by `progressIdx`, 90 m range), swap (teleported player 50.1 m to the kart ahead), slick (3 active in world, incl. AI drops), ink (`inked` flag → fullscreen splat, correctly gated to `racing`+unpaused; `critic2-ink.png`).
- AI use items autonomously: 4 expired missiles + 3 slicks observed mid-race.

### Systems / regressions
- Wrong-way: `wrongWay=true` + `WRONG WAY` banner while driving backward (`align` −1.00; `critic2-wrongway2.png`); clears on recovery.
- Pause: `P` and `Esc` both freeze the sim (sim.time byte-identical across samples; `critic2-paused.png`); resume works from both.
- Restart: `R` from paused and from finished → countdown, laps/finished/celebrating/results all reset — the P→R soft-lock stays dead.
- Drift → mini-turbo: Shift+steer at 16+ m/s latched `drift` state, charge accrued, release fired a ~0.7 s boost.
- Console: **0 errors, 0 warnings** for the whole session.
- Performance: **75.3 fps on both tracks** during live racing; 297–510 draw calls, 48–68 k tris depending on camera content. Smooth.

---

## Defects (ranked by severity)

### D1 — Medium: options menu can sit over a LIVE race, and arrows drive + adjust settings simultaneously
The auto-pause only triggers when `phase === 'racing'` at the moment `O` is pressed. Three ways into the broken state (all reproduced live):
- **a) O during countdown** → menu opens but countdown is *not* paused. Verified: `countdownLeft` 3.00 → 0.93 with menu `display:block`; race then started under the menu (`phase:'racing'`, no PAUSED overlay). Evidence: `critic2-defect-menu-over-race.png`.
- **b) O during racing (menu open + paused), then P** → sim unpauses while the menu stays open (simT advanced 321.66→323.2, PAUSED hidden, menu `block`).
- **c) R while menu open** → restart unpauses and leaves the menu up into the new countdown/race.

Effect once live: dual input — verified `ArrowDown` moved the menu selection while held `ArrowUp` accelerated the kart to 19.7 m/s. Steering with arrows changes your volume/selection mid-race. Recoverable (O or P gets you out) but a real shipping bug in the flagship new feature — the menu is not a modal.

### D2 — Low-medium: R restart does not reset the item field
`Items` is not rebuilt/cleared on restart. Repro: have slicks down / items held → press `R` → verified 3 active slicks and an AI-held `boost` persisted into the fresh countdown. Hazards from the dead race litter the new one; held items carry over too (debatable for held items, but live missiles/slicks surviving a restart is wrong).

### D3 — Low-medium: no quit-to-title and no respawn key
`T` only works on the title screen — once a race starts there is no path back to title/track-select except reloading the page. There is also no reset-kart-to-track button: my driver got pinned grinding a wall at the ~5.6 m/s wall-scrub equilibrium for ~70 s on track 2 (a human can steer off, but a genuinely beached kart has no recovery short of `R` restarting the entire race). Genre-standard recoverability is missing.

### D4 — Low: debug HUD ships visible by default
`DebugHud` starts `visible=true` — fps/draws/dev-keybind overlay renders top-left on every screen including the title (visible in the early evidence shots). Dev instrumentation in a release candidate; default it off or gate it on a dev flag.

### D5 — Trivial: sloppy key edges
`Escape`/any key (incl. `Space`) starts the race from title — "PRESS ENTER" but everything fires it. `Space` also fires the held item during countdown/finished phases when not paused. Harmless, untidy.

### D6 — Trivial: `RacerProgress.score` double-counts laps
`score = lap*n + progressIdx − spawnOffset` where `progressIdx` is already unwrapped — laps are counted twice. Ordering stays correct (still monotonic), but it's a latent footgun if score is ever compared against raw distance (e.g., rubber-band math already uses it — currently consistent because all racers share the quirk).

---

## Top 3 highest-value remaining improvements

1. **Make the options menu a true modal.** Pause on open in *every* non-title phase (not just `racing`), capture/block drive keys while open, and force-close on `R`-restart and on `P`/`Esc` resume. One central gate kills the whole D1 family.
2. **Add recoverability plumbing**: a respawn/reset-to-centerline key and a results-screen quit-to-title (`[T] title`) so track select is reachable without a page reload and a beached kart isn't race-ending.
3. **Reset `Items` on `race.restart`** — clear slicks, missiles, and held items so a fresh race starts on a clean field.

## Summary
The wave-4 additions all landed and *work*: options menu adjusts real audio gains, track 2 is a genuinely different circuit that laps correctly with on-road boxes and real gravel shortcuts, the emotes read well in numbers and on screen, and item glyphs are clear. The main path of every feature is solid and perf is a locked ~75 fps on both tracks. The deductions: the options menu isn't a modal (countdown/R/P holes → steering changes your volume mid-race), restarts leak item hazards, there's no respawn or quit-to-title, and a dev HUD ships on by default. Fix D1–D3 and this is a clean 8.5+.
