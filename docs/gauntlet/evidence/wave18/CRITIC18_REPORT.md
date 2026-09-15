# CRITIC REPORT — WAVE 18

**Commit under test:** `a7d28ca` — FIX-008: critic-17 batch (teleported-lap records, GP results traps)
**Date:** 2026-03-15 · **Build:** dev server :5173, Chrome, three.js 0.185.1
**Verdict:** ❌ **NOT CLEAN** — FIX-008 verified completely and the race-rules vein is closed, but the fresh hunt found two MEDIUM defects elsewhere plus one LOW fairness residual.

## Score: 7.6 / 10

The teleported-lap fix is airtight — a swap-matrix of six scenarios produced zero record/bestLap corruption, and every FIX-007 guarantee still holds. The wave's new findings moved outside race rules: persisted audio volumes are silently ignored after every reload, and a gamepad-connected player dead-ends on every results screen.

---

## Defects

| Sev | Defect | Repro | Evidence |
|---|---|---|---|
| **MED** | **Persisted master/music volume is ignored after every reload.** `Game.ts:482-483` calls `audio.setMasterVolume(settings.masterVol)` / `setMusicVolume` in the constructor, but `Audio.unlock()` only creates the `master`/`musicBus` GainNodes on the first user gesture — the setter's `if (this.master)` guard (`Audio.ts:117`) makes the persisted apply a silent no-op. `unlock()` (`Audio.ts:42-99`) then hardcodes `master=0.55`, `musicBus=0.8` and never reads settings. A muted user's game plays full volume on the next launch until they touch a slider. Same gap for musicVol. | `localStorage masterVol:0` → reload → press Enter (unlocks ctx) → `audio.master.gain.value === 0.55`, expected `0` | probe log: `ctx:'running', masterGain:0.5500, musicBus:0.8000` with persisted `masterVol:0` |
| **MED** | **Gamepad dead-ends on every results screen.** `pollPadCodes` (`Input.ts:190-204`) maps no button to `N`, `R`, or `Q`. On `phase==='finished'`, A→Enter, B→Escape, and Start→KeyP are all gated no-ops (Enter/R/N handlers don't fire, pause is restricted to racing/countdown). A pad-only player cannot advance a GP cup past leg-1 results, restart a single race, or quit — a hard dead-end for an advertised input class (🎮 hints render when a pad connects). | Mock standard pad → GP leg-2 results → press A, Start, B → `phase` stays `finished` on every press | probe log: `afterA:'finished'`, Start→`paused:false`, B→`finished` |
| **LOW** | **Post-finish swap grants asymmetric free advancement.** Swap targets by live `score` (`Items.ts:264-275`); a finished racer keeps a high frozen score and stays a valid target, but their result is locked by `finishTime` (`Race.ts:235`) — the "exchange" costs the victim nothing while the swapper gains a near-free lap → earlier `finishTime` → a better final position (and more GP points) than racers who drove. Verified live: post-finish `items.use(1,'swap')` teleported the locked player kart **85.7 m** and rebased the swapper to `progressIdx 3411` on lap 3. Fix: skip `r.finished` in the swap target loop. | Finish a race → eval `items.held[1]='swap'; items.use(1, simTime, scores, racers)` | probe log `moved:85.7, r1_tp:true, r1_pi:3411, r1_lap:3` |
| NIT | Finished player's kart visibly teleports during the results celebration — same root cause as the LOW above (the swap still resyncs/moves the locked kart). | same probe | — |

---

## FIX-008 verification — all hold

| Change | Result |
|---|---|
| `teleportedThisLap` set by `resync()` | ✅ `Race.ts:161`; observed `tp:true` immediately after resync |
| Teleported lap counts for position, excluded from `bestLapTime` + records | ✅ Resync to n-15 mid-lap-2 → crossing counted lap 2→3, `lastLapTime=13.32s`, **`bestLapTime` stayed 19.88**, `records` unchanged `{"0":19.88}` |
| Flag clears at lap boundary | ✅ `tp:true` → `tp:false` observed at the crossing |
| Flag clears on race reset | ✅ resync (`tp:true`) → R restart → `tp:false`, lap 1, `bestLapTime:0` (`Race.ts:53`) |
| AI teleported laps can't write records | ✅ Records read only `racers[0]` via `race.bestLapTime` (`Game.ts:692`, `Race.ts:215-217`); AI rows keep their own `bestLapTime` but never feed `grok-kart-records` |
| Normal laps still record | ✅ Lap-1 normal lap wrote `{"0":19.88}`; SR leg-2 normal lap wrote `{"1":22.60}` + `★REC` badge on the results row |
| R disabled on mid-cup results | ✅ No-op on **leg-1** results (phase stayed `finished`, same track) and **leg-2** results; footer correctly advertises `[N] next race · [Q] abandon cup` only |
| R on final standings | ✅ Fresh cup: leg-1 countdown on PG, clean lap/points state |
| R on single-race results | ✅ Restarts to countdown |
| Q-quit disarm keeps current track | ✅ Quit mid-leg-2 → title `◂ SWITCHBACK RIDGE ▸` in single-race mode, `track:1` persisted, cup fully disarmed |

## Swap matrix (the race-rules vein — closed)

| Scenario | Lap counts | bestLap | Record |
|---|---|---|---|
| resync near line, cross | ✅ counted | excluded ✅ | untouched ✅ |
| resync mid-lap then crash-free drive | counted | excluded | untouched |
| TWO teleported laps in one race (13.32s + 5.68s organic AI swap) | both counted | **both excluded** | untouched |
| all-teleported race (3 teleported laps) | finishes correctly | `bestLapTime:0` → results show `best --:--.--` cleanly | untouched |
| resync then R reset | n/a | flag cleared | n/a |
| post-finish AI swap targets locked player | see **LOW** — lap counting is sanctioned but the victim is locked | excluded | n/a |

## FIX-007 re-verification — holds

| Item | Result |
|---|---|
| Pause gate `racing‖countdown` only | ✅ `Game.ts:399-405` unchanged; P→R mid-race → countdown, PAUSED overlay cleared |
| Tab/Space/arrows preventDefault | ✅ Live probe: `defaultPrevented:true` for Tab, `document.hasFocus()` true, `activeElement` BODY |
| Same-tick tie display/award | ✅ Code unchanged (`RaceHud.ts:387-412`); c17 evidence stands |
| Champion tiebreak (final-leg position) | ✅ Comparator unchanged (`RaceHud.ts:364-371`); champion ★ observed on BOT-A2 (25 pts) |

---

## Fresh edge-case hunt

| Probe | Result |
|---|---|
| Mute/volume persistence across reload | ❌ **MED** — persisted values ignored post-unlock (above) |
| Ambience on title vs race | ✅ Per-circuit bed runs on title (2 PG sources live: crowd murmur + breeze), rebuilds per track on `buildWorld` |
| Music theme per track | ✅ `setTheme(trackIdx)` on every `buildWorld`; intensity ramps 0.1 title → 0.35+ racing → 0.2 finished |
| Reduced-motion postfx | ✅ Live at speed: 27.8 m/s normal → `uAberration 0.0020` (full ramp); reduced-motion on → `0.0000` at 24.3 m/s |
| Minimap | ✅ 168px canvas: `display:none` on title, `block` + 1549 painted px (outline + dots) during race; rebuilt per track in `buildWorld` (SR foldback legs shown in leg screenshots) |
| HUD during spin+boost+ink simultaneously | ✅ All three states active together; ink overlay + item readout + spin anim coexist (`c18-hud-spin-boost-ink.png`) |
| Gamepad full menu nav | ⚠️ Menus/drive work via the pad→key pipeline (c17); **results screens dead-end** — MED above |
| Restart from results vs from pause | ✅ R on single results → countdown; P→R → countdown, pause cleared |
| Lap display during final lap | ✅ `LAP min(lap,totalLaps)/totalLaps` clamp (`RaceHud.ts:308`) — shows 3/3, never 4/3 |
| Position HUD on teleports | ✅ resync P4→P1 reflected in HUD `P1/4` within ~1 s; resync backward kept P4 correctly |
| Post-finish swap | ⚠️ **LOW** — asymmetric advancement + locked-kart teleport (above) |
| Engine audio on title | ✅ Idle hum at gain 0.03 (`allowsDrive` false), atmospheric |

---

## Performance / console / GP stats

- **Perf (NEON NIGHT, ~10 s racing):** 681 frames, **68.0 FPS**, p50 **14.60 ms**, p95 **15.40 ms**, p99 **15.70 ms**, worst **15.80 ms** — no hitches (last wave's 23.5 ms spike absent).
- **Console:** **0 errors / 0 warnings** across every session — log contains only `[vite] connecting/connected` HMR debug lines.
- **GP:** one full 3-leg/4-racer cup end-to-end — totals **75 pts** (10+7+5+3 ×3), champion ★ BOT-A2 25 pts, final standings → fresh-cup R → leg-1 countdown verified; a second cup cleanly abandoned via Q mid-leg-2.
- **Swap-matrix laps driven:** 6 teleport scenarios + 1 post-finish probe — records clean throughout.

## Environment state

- Dev server left running `:5173`; CDP Chrome `:9333` left open (single game tab). Console monitor `scripts/c18/c18-conmon.mjs` left attached → `scripts/c18/console18.log`.
- Restored post-run: `masterVol` back to 1, `grok-kart-records` cleared (probe-era 19.88/22.60 removed), `grok-kart-bindings` cleared, mock gamepad removed (`getGamepads` → `[]`), autopilot disarmed, quit to title.
- Evidence: `docs/gauntlet/evidence/wave18/c18-*.png` (13 screenshots). Probes via `scripts/c18/c18-eval.mjs` + `c18-conmon.mjs`.

## Notes (not defects)

- `lapTimes[]` still records teleported laps (13.32s/5.68s) — honest history; results show `bestLapTime` (protected) + `LAST` (honest). `--:--.--` renders when a race has no honest best.
- Swap grants the *current* lap's tail to the teleport target (one shortened lap, not infinite) — sanctioned position-exchange power.
- `★REC` badge correctly appears on track-1 record (`best 0:22.60 ★REC` on leg-2 row).

## Bottom line

FIX-008 is verified end-to-end and the swap/resync record-corruption vein is closed across a six-scenario matrix plus live organic swaps. The two new MEDs are outside race rules: persisted audio volumes silently reset on every reload (`unlock()` overwrites them with hardcoded defaults — store pending volumes and apply them in `unlock()`), and gamepad input dead-ends on results (map results actions to pad buttons). The post-finish swap LOW is the last live edge of the swap vein — exclude `finished` racers from swap targeting.
