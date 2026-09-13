# CRITIC 3 — HARD-mode playtest report (wave 4)

**Game:** GROK KART (`http://localhost:5173/`, title: "Grok Bots Kart Racing")
**Method:** runtime playtest via `playwright-cli` against `window.__game` — no source-only claims. No game source files modified by the critic.
**Difficulty:** HARD (verified via `localStorage:grok-kart-settings` → `difficulty:2`; restored to NORMAL `1` at end of session).

## Session caveat — moving target

Parallel live development ran during this playtest (HMR reloads; `git diff` shows in-flight edits to `Game.ts`, `RaceHud.ts`, `AiDriver.ts`, `Items.ts`, `Kart.ts`, `Race.ts`, `Track.ts`). Two high-severity defects were **observed, screenshotted, then fixed mid-session**; each fix was re-verified at runtime on the final build and is marked **[FIXED — re-verified]** below. Scores reflect the final build.

Synthetic-driving contamination: an injected autopilot (`window.__ap`) caused wall-grinds and parked time — player finishes of 3:14–4:27 are harness artifacts, not representative laps. One console `TypeError` (`reading 'stuckFor'`) came from the injected harness, not game code. Final-build console: **2 messages, 0 errors, 0 warnings**.

## Score: 8/10

A complete, working kart racer: three distinct circuits, a functioning Grand Prix, all six item types, modal persisted options, night headlights, difficulty that measurably changes AI pace, clean 75 fps rendering, and zero game console errors on the final build. Held back from higher: both high-severity defects existed at session start (now fixed), wall-pin recovery still depends on the player discovering ⌫/S, a pause-overlay input leak remains, and synthetic input can't fully vouch for human steering feel on the tightest track.

## Verified working (runtime, with numbers)

1. **Full races, all three tracks, 3 laps, 4 finishers each.** PG: player laps 22.16/22.52/20.90 s; finish order BOT-B 59.95 → BOT-C 59.96 → YOU 65.57 → BOT-A2 84.04. SR (final build): laps 24.4/29.4/29.8; BOT-A2 1:09.13 → BOT-C 1:10.18 → BOT-B 1:11.42 → YOU 1:23.68. NN: BOT-C 74.8 → BOT-A2 ~75.0 → BOT-B 76.0 → YOU (contaminated). Evidence: `critic3-pg-results.png`, `critic3-sb-results.png`, `critic3-neon-race.png`.
2. **Results ordering = finish-time ordering** on every race; late AI finishers update the board live while `phase==='finished'`.
3. **Celebrations fire for all four racers** (`celebrated` flags true, ranks 1–4 assigned correctly).
4. **Minimap** draws the sampled centerline + racer dots; `display:none` when the setting is off, lit pixels when on; shapes match each circuit. Evidence: `critic3-minimap.png`.
5. **Gravel aprons on inside edges** via `track.surfaceAt` probes — PG fractions ~0.367 & 0.631; SR ~0.51 & 0.705; NN ~0.535/0.555/0.575/0.705/0.75/0.795; opposite side stays road.
6. **AI completes laps cleanly**: AI best laps 17.70–23.75 s; 30.7 s traffic watch — zero sub-3 m/s stalls, zero deadlock trains (24 close-pair samples were side-by-side racing, not pile-ups).
7. **Grand Prix end-to-end**: G arms cup ("GRAND PRIX — leg 1/3"); N advances PG→SR→NN; points 10/7/5/3 per leg; cumulative totals correct at every stage (leg-3 results showed 17/15/12/6; final standings BOT-B 27★, BOT-A2 22, BOT-C 17, YOU 9 — arithmetic verified); champion crown shown; footer swaps to `[R] restart · [Q] title`. Evidence: `critic3-gp-leg1-results.png`, `critic3-gp-leg2-results.png`, `critic3-gp-final.png`, `critic3-gp-final-v2.png`.
8. **Options are fully modal**: O during countdown freezes it at "3"; sim.time frozen; arrows adjust menu, don't drive; Esc/O closes → paused; P resumes. Evidence: `critic3-options` (prior wave), text dump this session.
9. **Settings persist across `location.reload()`**: track, master/music volume, difficulty, reduced motion, minimap all survived; stored under `grok-kart-settings`.
10. **Difficulty changes AI pace measurably**: HARD AI bests ~22.3–23.7 s vs EASY first laps ~27.7–31.2 s on the same circuit.
11. **Night headlights on NEON NIGHT**: night config active, player spotlight beam + two lamp objects present. Evidence: `night-headlights.png`, `critic3-neon-title.png`.
12. **Respawn (⌫)**: beached kart lateral offset ~5.2 → 0, heading re-aligned to track tangent; used repeatedly by the autopilot to recover — always worked.
13. **Items — pickup → glyph → use**: HUD glyph e.g. "✹ MISSILE [space]" (`critic3-item-hud.png`); Space consumes. Boost→`boostTimer 1.4`; shield→expiry set in future; ink→AI `inked` flags true; swap→positions exchanged; missile→travels range/fizzles, forced hit spins target; slick→`spinUntil ~0.89`, velocity ~0, slick removed.
14. **Wrong-way**: sustained reverse → `wrongWay:true` + HUD warning `display:block`; clears on forward travel. Evidence: `critic3-wrongway.png`.
15. **Rubber-banding**: leader AI pace assist ~−0.05; pack compresses when player trails.
16. **Pause**: P → PAUSED overlay `display:block` and `sim.time` frozen across a 600 ms probe; works mid-race and on the results screen. Evidence: `critic3-pause-on-results.png`.
17. **Eye blinks**: eye scaleY 0.066 → 0.00792; 29 blink events sampled live (earlier "no blinks" probe was a paused-sim artifact).
18. **Quit-to-title**: Q works from results and mid-race → `phase:'title'`.
19. **Performance**: 75.5 fps on all three tracks — PG 155 calls / 34,700 tris; SR 396 calls / 59,562 tris; NN 169 calls / 35,692 tris (incl. night lighting). 336 geometries, 1 texture.
20. **Console clean**: 0 errors / 0 warnings on the final build.

## Defects, ranked by severity

### D1 — Grand Prix state leak into title/normal race — **HIGH → [FIXED, re-verified at runtime]**
- **Observed (earlier build):** after cup completion, Q → title read "GRAND PRIX — leg 4/3"; a subsequent normal race rendered stale FINAL STANDINGS (27/19/18/11). Evidence: `critic3-gp-leg43.png`, `critic3-gp-stale-standings.png`.
- **Repro (original):** complete a 3-leg cup → Q → observe title → Enter a 1-race → standings overlay persists.
- **Fix (landed mid-session):** `Game.ts` adds `resetCup()`; title-return while `gpMode` re-arms a fresh cup (`buildWorld(0)`); R on final standings starts a fresh cup; T no-ops while a cup is armed.
- **Re-verified on final build:** post-cup Q → "GRAND PRIX — leg 1/3" (fresh); abandoning mid-cup → same fresh state; post-cup normal race → standings elements `checkVisibility()===false`. **Closed.**

### D2 — Switchback foldback beaching (nearest-sample snap) — **HIGH → [FIXED, re-verified at runtime]**
- **Observed (earlier build):** kart pinned at a wall seam near sample ~719 at a foldback; position froze despite forward velocity; wall contacts could not be steered out of. Evidence: `critic3-sb-stuck.png`, `critic3-stuck.png`, `critic3-sb-wallgrind.png`.
- **Fix (landed mid-session):** `Track.nearestIndexNear` continuity-aware lookup + `trackIdx` propagated through kart constraints and respawn.
- **Re-verified on final build:** full clean SR race — 4 finishers, laps 24.4/29.4/29.8 s, no beaching. **Closed.**

### D3 — N advances the cup while the results screen is paused — **LOW (open)**
- **Repro:** finish a GP leg → P (PAUSED overlay up) → press N → cup advances to next-leg countdown **behind the still-visible PAUSED overlay**; countdown waits at "3" (sim stays frozen); P resumes normally.
- **Impact:** overlay persists across a leg transition — inconsistent modal hygiene. Recoverable, no corruption. Fix: ignore advance keys while paused, or clear pause on phase transition.

### D4 — Wall-pinned recovery depends on discovering ⌫/S — **LOW (open)**
- **Repro:** nose into a wall → forward+steer crawls at ~0.5 m/s; steering authority fades below the min-speed threshold, so the kart can't rotate off the wall under W alone. S (reverse) or ⌫ (respawn) escapes.
- **Impact:** a new player who hasn't read the help line can think they're hard-stuck. Consider low-speed steering assist or an auto-hint/respawn prompt after ~2 s below 1 m/s.

### D5 — Leg results show pre-leg point totals — **LOW (cosmetic/by design)**
- Leg-1 winner's row reads "0 pts" — points are awarded on the N-press (`Game.ts:240-247`), so each results screen shows the tally *entering* that leg. Correct math, confusing presentation; consider "+10 → 17 pts".

### Harness artifacts (explicitly NOT game defects)
- `TypeError: reading 'stuckFor'` — injected autopilot code.
- Player finishes of 3:14–4:27 and repeated wall-grinds — autopilot deadband/parked time.
- Mid-race page reload — HMR from parallel source edits.
- Earlier ambiguous reading (P on results appeared not to freeze `sim.time`) was **not reproduced** on the final build: P reliably pauses on results now.

## Top 3 remaining improvements

1. **Unstick UX:** low-speed steering authority, or an on-screen "⌫ respawn" hint when speed < 1 m/s for > 2 s while throttle is held.
2. **Pause modal hygiene:** make N/R/Space inert while the PAUSED overlay is up (and clear pause on any phase transition).
3. **GP points presentation:** show points earned this leg on the results screen ("+10 → 17 pts") so leg-1 doesn't read "0 pts".

## Evidence index (wave4)

`critic3-title.png`, `critic3-title-gp.png`, `critic3-pg-go.png`, `critic3-pg-results.png`, `critic3-sb-race.png`, `critic3-sb-results.png`, `critic3-sb-stuck.png`, `critic3-sb-wallgrind.png`, `critic3-stuck.png`, `critic3-neon-race.png`, `critic3-neon-title.png`, `critic3-gp-leg1-results.png`, `critic3-gp-leg2-results.png`, `critic3-gp-final.png`, `critic3-gp-final-v2.png`, `critic3-gp-leg43.png`, `critic3-gp-stale-standings.png`, `critic3-item-hud.png`, `critic3-minimap.png`, `critic3-wrongway.png`, `critic3-pause-on-results.png`, plus earlier-wave `night-headlights.png`, `options.png`, `gp-standings.png`.
