# CRITIC 5 — Wave-4 Adversarial Review: Grok Bots Kart Racing

**Verdict: 6/10**

The game is real and mostly functional: three tracks, four racers, working items, a complete Grand Prix, options/rebind with persistence, and the new per-track lap-record system works end-to-end. But it is not clean. I found a **reproducible, systematic AI deadlock** that permanently removes racers from play (observed 3×), a provable **cross-race leak of the `★REC` results badge**, and a handful of robustness/persistence gaps. Records themselves — the headline new feature — are otherwise solid: persisted per track, correctly gated on lap completion, slower laps never overwrite, AI laps can't touch them, and corrupted only by malformed stored data.

Session notes: ~90 min of live play in Chromium via playwright-cli. Real races on all 3 tracks (manual + autopilot driving), a full 3-leg GP, options/rebind on title and mid-race, pause in every phase. Several record values were injected into `grok-kart-records` to create controlled beatable/unbeatable cases — those are called out where used. Console: **0 errors, 0 warnings** all session (only Vite debug chatter). Gamepad could not be tested (no physical pad).

---

## Verified working (with evidence)

- **Lap record set + display**: first gate-validated lap writes `grok-kart-records`; title shows `rec M:SS.ss` next to the track name (`critic5-title-rec-t1.png`, DOM text `◂ PROVING GROUNDS ▸ [T] 1 RACE [G] rec 0:19.31`).
- **Record persistence**: survives in-place `location.reload()` — `{"0":19.31}` intact and re-shown on title.
- **Per-track keying**: T-cycling shows each track's own record; tracks with none show no `rec` (verified across all 3).
- **Slower laps never overwrite**: 19.55 vs 19.31 record → unchanged; 20.71 vs 19.51 → unchanged; entire races under an unbeatable 1.0s seed wrote nothing.
- **Toast fires only on record laps**: `★ NEW LAP RECORD!` element hit `display:block` on each record lap (63 consecutive 40 ms polls ≈ full 2.5 s window) and **zero times** across every non-record lap observed.
- **`★REC` on results when a record is truly set**: `P4 YOU 2:35.51 best 0:19.31 ★REC` (`critic5-results-rec.png`), `P1 YOU best 0:21.96 ★REC`, `best 0:19.51 ★REC` (`critic5-results-legit.png`).
- **AI laps can't set the player record**: BOT-C logged 0:18.42 vs my 0:19.31 record — record untouched (code: only `race.bestLapTime`, racer 0, is compared — `Game.ts:540`).
- **GP cup**: 3 legs PG→SR→NN, points 10/7/5/3, N-advance, per-leg `+10 → 17 pts` running totals, `FINAL STANDINGS` with `P1 ★ YOU 27 pts` champion (`critic5-gp-standings.png`). Leg-1 record (19.54) persisted through all legs.
- **Options**: volumes, difficulty (persists, drives AI skill ±delta), reduced motion, minimap, 6 bind rows, RESET BINDINGS (`critic5-options-title.png`).
- **Rebind**: `PRESS KEY…` capture, reserved-key → **`NOT A DRIVE KEY` denial** (verified: KeyP, KeyR, Enter, arrows all denied), conflict clears displaced action to `—`, persists to `grok-kart-bindings`, rebound key works in-race (brake→J reversed at −5.99 m/s).
- **HUD hints follow live bindings**: title drive hint rebuilt from `bindings`, stuck hint showed `J reverse` when brake was J, item badge shows `[SPACE]`.
- **Esc closes options** on title and mid-race; **O opens modal options mid-race and freezes the sim** (`simFrozen:true`); options-close returns to PAUSED state.
- **M toggles reduce motion on title** (live `chaseCam.reducedMotion` flips — see D5 for the persistence gap).
- **Pause works in countdown** (`countdownLeft` froze), **racing**, **finished**; **P→R has no soft-lock** (restart unpauses + regrids); 6× R-mash stable.
- **Respawn** (`Backspace`) instantly resets onto the line, clears wall state.
- **Stuck hint** fires (`STUCK? ⌫ respawn · S reverse`, `critic5-player-stuck.png`) — but see D4.
- **Wrong-way** flags while reversing (`wrongWay:true`), clears on stop.
- **Night headlights** on Neon Night: beam cone + lamp quads visible (`critic5-neon-race.png`).
- **Items**: box pickup, HUD glyph + bound key (BOOST ⚡, SHIELD ◯, SLICK ◍, MISSILE ✹), boost fires (`boostTimer 0.91 s`).
- **Nose-into-wall no longer reads 28 m/s** — reads ~1.6–1.7 (critic4's HIGH is fixed, with a residual caveat in D4).
- **Track restore on reload**: last-played track persists via `settings.track`.
- **Universal alternates survive rebind**: arrows still drive when throttle is unbound (28.2 m/s).
- **Quit-to-title / restart / GP-abandon** all regrid cleanly; cup re-arms on title.

## Defects

### D1 — HIGH: AI karts beach permanently against walls; recovery deadlocks

Three separate instances, all on **Switchback Ridge**, all ending at the wall-clamp limit (`lateral ±5.25`, `roadHalfWidth 6 − kart 0.75`):

| Kart | Where | State | Observation |
|---|---|---|---|
| BOT-B (GP leg 2) | (6.2, 0.8, 20.4) | lap 1, **0 laps in ~80 s**, `wallContact`, `align −0.35`, speed 0.16 | `moved 0.00` over 4 s and still there minutes later → `P4 … best --:--.--` forever (`critic5-botb-stuck.png`) |
| BOT-A2 (single race) | (110.8, 2.7, 34.1) | beached on lap 2, `align −0.60`, speed 0.29 | `moved 0.00` over 4 s, DNF (`critic5-bota2-stuck.png`) |
| Player kart under autopilot | (84, 0.5, 11.2) | pinned lap 1, `align +0.24`, speed 0.51 | 80+ s until manual `Backspace` (`critic5-player-stuck.png`) |

**Root cause** — `AiDriver.update` (`src/game/AiDriver.ts:81–129`) has exactly two escape paths, both of which only ever emit `{brake, steer}`:
- `recovering` (align < −0.45): exits when align > 0.2 — but **steering has zero authority at ~0 speed** (`Kart.ts:402–409`, `speedFactor` smoothsteps to 0 below `steerMinSpeed`), so a kart that can't translate can't rotate back.
- Wedge (`stuckTime ≥ 2`, zero displacement): `{brake:1}` — correct only when the nose is into the wall. BOT-B sat **tail-to-wall** (nose −0.94·left vs the +lateral wall) so brake pushes it *deeper*; `forwardSpeed < −1` never arrives, the branch never exits.

Meanwhile `wallScrub` (`Kart.ts:467`) decays the *whole* velocity vector every step while clamped, so the kart can never build escape speed. AI drivers have no respawn/time-out fallback — the kart is gone for the rest of the race, results show `…`/no time forever, and in GP it still banks points for last place (BOT-B: `+0 → 3 pts`). The player has `Backspace`; bots have nothing.

**Repro**: race Switchback Ridge and wait — wall-side wedges happen organically (3 in ~8 races here, incl. one inflicted on the autopilot-driven player).

### D2 — MED: `★REC` badge leaks into races where no record was set

`recordSetThisRace` is only cleared in `restartRace()`'s non-GP path (`Game.ts:474`). `buildWorld()` never resets it, so every transition that routes through buildWorld carries the flag forward:

- **GP leg advance** (`Game.ts:339`): leg-1 record → leg-2 results showed `P2 YOU 1:12.37 best 0:22.39 ★REC` with the track record seeded unbeatable at 1.00 s and **0 toasts fired** (`critic5-gp-leg2-leak.png`); same false star on leg-3 results **and** `FINAL STANDINGS` (`critic5-gp-standings.png`).
- **Abandon cup → single race** (`Game.ts:456–462` early-returns before the reset): leg-1 record → Q → fresh single race on SR (record 1.00 s unbeatable, laps 22.7/22.1/22.4) → results showed `P1 YOU 1:07.15 best 0:22.08 ★REC` (`critic5-defect-recleak.png`).

Control case: the same screen after a legit `R` restart correctly shows no star — so the leak is specifically the buildWorld paths. Cosmetic, but it mislabels results in a feature that exists precisely to certify "a record was set **this race**".

### D3 — MED: corrupt record values render `rec NaN:00NaN` and permanently brick that track's record

`grok-kart-records` is loaded with `Object.assign(records, JSON.parse(...))` (`Game.ts:213–217`) with **no per-value validation** (the settings loader two blocks earlier does check types, `Game.ts:207`).

- `{0:"garbage"}` → title shows `rec NaN:00NaN` (`critic5-defect-nanrec.png`).
- `{1:-5}` → title shows `rec --:--.--` as if a record exists.
- Worse: `bt < records[i]` is then always false — **no legitimate lap can ever overwrite the corrupt entry**; the track's record is bricked until storage is hand-cleared.

Seeded during testing — malformed JSON is caught by the try/catch, but well-formed JSON with wrong types is not.

### D4 — MED: wall-pinned kart reports phantom ~1.6 m/s, defeating the stuck hint

Pinned fully stationary against a wall with throttle held (`moved 0.000` over 2.5 s), `kart.speed` holds **1.59–1.72 m/s** — critic4's 28 m/s is gone but the residual sits **just above the 1.5 m/s `stuckFor` threshold** (`Game.ts:507`), so the `STUCK?` hint never fires for that pin state (verified: hint `display:none` while fully pinned ~10 s). A differently-oriented pin (0.51 m/s, `critic5-player-stuck.png`) *did* fire the hint, so coverage is partial, not absent. Related: the hint's `S reverse` advice can just slide the kart along a curved wall into a *new* pin (observed: reversed 10.6 m, re-wedged). Sources: `Kart.ts:435–475` wall scrub/restitution equilibrium.

### D5 — LOW: M-key reduce-motion toggle is not persisted

`toggleMotion()` (`Game.ts:101–104`) mutates `settings.reducedMotion` but never calls `saveSettings()` — the options-menu row does (`Game.ts:96`). Verified: after M on title, `chaseCam.reducedMotion === true` while stored `reducedMotion === false`; a reload reverts it. Inconsistent persistence between the two entry points.

### D6 — LOW: PAUSED overlays on top of the RESULTS panel

`P` on the results screen stacks `PAUSED / P · Esc to resume` directly over the results table (`critic5-pause-finished.png`) — the same overlay-collision class of bug critic4 got fixed for options (`paused && !opts?.open`), but the results panel wasn't given the same treatment. Cosmetic.

### D7 — LOW: unbound action renders cryptic title hint

Clearing a binding (conflict or deliberate) leaves the title hint as `—AJD / arrows — drive` — technically "following live bindings" but reads like a bug to a normal player. Cosmetic.

## Things tried that did NOT break it

- Record survives mid-race quit (written at lap completion, not at finish) — by design.
- Toast during pause: flash window is sim-time based, so pause freezes it — resumes correctly after unpause.
- Item use gated to `phase==='racing'` — Space at/after the finish is safely ignored.
- Rapid restart mashing (6× R) — stable, lands on fresh countdown.
- Wrong-way on reverse — flags and clears correctly; gate-mask lap validation held under my off-line excursions.
- Malformed (non-JSON) storage — caught cleanly (bindings and settings too).
- Countdown pause, pause-on-results, modal options — all freeze sim correctly.
- Records in GP leg 1 visible/persisted through legs 2–3 and final standings.
- AI best-lap times never contaminate the player record.

## Untestable / not verified

- **Gamepad** (no physical pad) — `pollPadCodes` path exists but unexercised.
- **Audio/music** — AudioContext unlock + volume sliders exist; can't hear output in this harness.
- **Ink item visual** — held `ink` observed on a bot; I never got inked myself this session (prior waves covered it).
- Driver rig animates (pedals/steer pose visible in screenshots) — present, low scrutiny.
