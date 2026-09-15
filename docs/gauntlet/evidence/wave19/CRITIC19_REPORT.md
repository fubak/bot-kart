# CRITIC REPORT — WAVE 19

**Commit under test:** `dbf5dbb` — FIX-009: critic-18 batch (volume persistence, pad results aliases, swap skips finished)
**Date:** 2026-03-15 · **Build:** dev server :5173, Chrome, three.js 0.185.1
**Verdict:** ✅ **CLEAN** — all three FIX-009 items verified end-to-end (including the real pad pipeline), every prior guarantee holds, and the fresh hunt produced only LOWs/NITs outside the state/rules vein.

## Score: 8.5 / 10

The FIX-009 batch is airtight. Volume persistence now survives reload→unlock→live-slider; gamepad A/B drive every results screen through the actual `pollPadCodes`→synthetic-keydown pipeline (verified with a mocked standard pad, not just key injection); swap targeting skips finished racers while still exchanging two live racers symmetrically. The remaining findings are presentation/robustness edges: a random-magnitude camera jump-cut at GO, uncaught `TypeError` spam when persisted settings hold non-numbers, no auto-pause on window blur, and a ~1.7-geometry/rebuild creep.

---

## Defects

| Sev | Defect | Repro | Evidence |
|---|---|---|---|
| **LOW** | **Hard camera jump-cut at GO — the countdown orbit doesn't land on the chase position.** `ChaseCamera.update` (`ChaseCamera.ts:52-56`) sets `initialized=false` during title/countdown so the first racing frame `camera.position.copy(targetPos)` *snaps* — the orbit angle at GO is arbitrary (advances a flat 0.55 rad/s, never steered toward `-fwd`), so the cut magnitude is random per start. The comment claims "sweeps toward the chase position and hands over smoothly at GO" — that handover isn't implemented. | Start a race → sample `camera.position` across the countdown→racing flip | Measured jumps: **10.46 m** (PG start) and **1.88 m** (second start) — coin-flip visible reframe every GO. MK8 lands the intro cam behind the kart before GO. Fix: bias `introAngle` toward the chase azimuth during countdown, or blend `targetPos` orbit→chase over the last ~0.4 s instead of `copy()`. |
| **LOW** | **Corrupt persisted settings → uncaught `TypeError` on every input event.** `Game.ts:271-279` `Object.assign`s `grok-kart-settings` blindly — records get per-value validation (`Game.ts:284-291`) but `masterVol`/`musicVol`/`difficulty`/`reducedMotion`/`minimap` don't. `masterVol:"banana"` → `0.55 * 'banana'` = NaN → `AudioParam.value` rejects non-finite (`Audio.ts:117`). The FIX-009 re-apply inside `unlock()` (`Game.ts:501-505`) means **every keydown/pointerdown throws** — unbounded console error spam (audio still works at the 0.55 default; the game plays). | `localStorage.setItem('grok-kart-settings','{"masterVol":"banana","track":99}')` → reload → press any key | `exception: TypeError: Failed to set the 'value' property on 'AudioParam': non-finite` at `Audio.setMasterVolume` ← `unlock`. `track:99` correctly rejected by bounds check; unparseable JSON recovers cleanly. Fix: numeric-guard the assign (`typeof v==='number' && isFinite`) same as records. |
| **LOW** | **No auto-pause on window blur — the field races on while the player's kart coasts dead.** `Input.ts:139` `blur → keys.clear()` releases held keys (c16 fix works — no stuck input), but nothing pauses the sim: a blurred-but-visible tab keeps rendering, AI keeps racing, and the player gets parked. | Race → `window.dispatchEvent(new Event('blur'))` mid-drive | Player score froze at **1564** while AI scores advanced 3152→3307 / 2018→3110 in ~3 s; kart decelerated to 0; controls recover fully on refocus. Most web racers auto-pause on `blur`/`visibilitychange` — this is a fairness/UX gap for an accidental focus loss. |
| NIT | **~1.7 geometries leaked per `buildWorld`** — 60 title T-cycles climbed `info.memory.geometries` 423→541 while textures stayed flat (~33) and programs oscillated (55-59). Something small escapes `Track.dispose()`'s group traverse each rebuild. Invisible to players; ~100 geos per 60 swaps is a few MB at worst. | Mash T ×60 on title | `geo: 423→460→526→541`; per-rebuild deltas +0..+3, linear trend. |
| NIT | **Results footer doesn't advertise the new aliases.** Footer renders `[N] next race / [R] restart / [Q] title` only — a keyboard user can't discover Enter works, and a pad player (who gets 🎮 hints on the *title*) sees no 🎮 hint on results, the exact screen the aliases exist for. | Finish any race with a pad connected | `c19-gp-leg1-results.png` footer; 🎮 row present on `c19-title-nn.png` only. |
| NIT | **Item pickup grants instantly — no roulette spin.** `Items.ts:401` `held[k] = roll(k)` on contact; the HUD badge appears same-frame. MK spins the slot ~1 s for anticipation. Design choice, but a genre reviewer will clock it. | Drive over a box | `itemEl` populates instantly; `roll()` is positional-weighted correctly. |

---

## FIX-009 verification — all hold

| Change | Result |
|---|---|
| Persisted volumes re-apply inside `unlock()` | ✅ `masterVol:0, musicVol:0` persisted → reload → first keydown built graph at **`master.gain=0`, `musicBus=0`** (was hardcoded 0.55/0.8). Live sliders then applied (0.2→gain 0.11 = 0.55×0.2; music 0.1→0.1). `unlock` re-applies on every gesture — consistent because `settings` is the only writer |
| Enter→N mid-cup | ✅ Leg-1 results +Enter → **SR countdown**; leg-2 +Enter → NN countdown; leg-3 +Enter → FINAL STANDINGS (gpDone). One transition per press, no double-fire |
| Enter→R otherwise | ✅ Single-race results +Enter → same-track countdown; final standings +Enter → **fresh cup leg-1 countdown on PG** (resetCup verified) |
| Escape→Q on results | ✅ Mid-cup leg-2 results +Escape → title on SWITCHBACK RIDGE, cup disarmed ("1 RACE" shown), leg-2 `rec 0:22.02` + ★REC kept |
| Full pad pipeline (mock standard pad) | ✅ `navigator.getGamepads` mocked → pad A started race from title, **A restarted** single-race results (Enter→KeyR), **B quit** results to title (Escape→KeyQ). 🎮 hint row appears/disappears live on connect/disconnect |
| Swap skips `finished` | ✅ Post-finish `items.use(1,'swap')` with only the finished player ahead → **fizzle, moved 0 m** (item consumed, launch cue — sanctioned). Racing-vs-racing `items.use(3,'swap')` → symmetric **23.7 m exchange** both ways |
| No double-fire | ✅ Remap is single-code-path inside one keydown; every advance needed a fresh press; `e.repeat` guard holds |

## Prior-fix re-verification — all hold

| Item | Result |
|---|---|
| Pause gate `racing‖countdown` | ✅ P mid-race → PAUSED `block` + sim froze (t 69.72→69.72); P on results → overlay `none`, no pause |
| Teleported-lap record exclusion | ✅ Live: resync mid-lap-1 → `tp:true` → lap counted (19.64 s) but **`bestLapTime` stayed 0**; later honest lap wrote 20.62. End-to-end: artificial lap-3 teleport finish showed `0:03.40` + `best --:--.--` and wrote **no record** |
| Tab/Space/arrows preventDefault | ✅ Tab: `document.hasFocus()` true, `activeElement` BODY — focus never left |
| Same-tick tie display/award | ✅ Code unchanged (`RaceHud.ts:387-412`); standings consistent all session |
| Champion tiebreak | ✅ Comparator unchanged; ★ rendered on BOT-B (25 pts) |
| Records validation | ✅ `{"0":20.94,"1":22.02,"2":22.41}` — all honest autopilot laps; `★REC` badges shown |

## Fresh-hunt results (outside the state/rules vein)

| Probe | Result |
|---|---|
| Camera GO transition | ⚠️ **LOW** — random 1.9–10.5 m snap (above) |
| Camera under NN gates / orbit clipping / respawn snap | ✅ Gate bars at ~4.55 m vs cam 3.2 m — passes under cleanly (`c19-nn-race2`); countdown orbit stays inside gantry/prop band (`c19-countdown-orbit`); respawn lerps smoothly (camDist 7.4 m) |
| Kart-vs-kart collision fairness | ✅ Symmetric: AI dropped 1.0 m inside the player's circle → separated to 4.47 m in 0.4 s, both retained speed (23.2 vs 19.3 m/s). Push/impulse/scrub split evenly (`Game.ts:796-829`) |
| Drift→boost cadence | ✅ 9 drift episodes / 5 boosts over ~48 s NN; AI charge max 0.6 s (tier-1 reachable, tier-2 rare on sweepers — sane) |
| Boost pads | ✅ 4/track at fixed fractions, pulse animates, drive-over grants `boostTime[0]` |
| Blur mid-race | ⚠️ **LOW** — keys cleared + kart coasts (c16 works) but no auto-pause (above) |
| Rapid T-mash ×60 | ✅ No errors, world rebuilds each press; ⚠️ NIT geo creep (above) |
| Corrupt localStorage | ⚠️ **LOW** — unparseable JSON recovers; `track:99` bounds-rejected; **non-number `masterVol` → TypeError spam** (above) |
| title→race→title ×3 + settings mid-loop | ✅ Clean incl. options open/close mid-loop; reduced-motion persisted + applied |
| Shadow acne / z-fighting / pop-in / billboard dusk | ✅ SR golden-hour clean at 1536²; pads/curbs stable at grazing angles; instanced props, no LOD pops |
| Per-track identity | ✅ Coherent: PG pastoral day, SR dusk + cairns/strata/arch, NN night + gates/studs/holo + headlight beams (player-only spot) |
| Title attract | ✅ Orbit + per-circuit ambience bed + theme music + live 🎮 hints |
| AudioParam clamp warnings | ⚠️ Observed ×4 (engine freq >24 kHz ⇒ transient `kart.speed` ≥ 500 m/s) — **probe artifacts**: spike-watch on all 4 karts caught **0** spikes across a full live race; not reproducible organically |

## Perf / console / GP stats

- **Perf (NEON NIGHT, ~10 s racing):** 681 frames, **68.1 FPS**, p50 **14.60 ms**, p95 **15.40 ms**, p99 **15.70 ms**, worst **16.00 ms** — identical to c18, no hitches. Draw calls ~863 NN / ~764 PG (composer passes incl.).
- **Console:** **0 errors / 0 warnings** in all normal play. Only entries ever logged: 1 × injected-corruption `TypeError` (defect above) + 4 × AudioParam clamp warnings (probe artifacts, 0 organic repro) + `[vite]` HMR lines.
- **GP:** full 3-leg cup end-to-end — totals **75 pts** (champion ★ BOT-B 25 / BOT-A2 21 / BOT-C 18 / YOU 11), final standings → Enter fresh cup → leg-1 countdown. Second cup armed and cleanly abandoned via Escape mid-leg-2.
- **Racing:** ~9 full races driven across all 3 circuits by autopilot + probes; every track got title + race coverage.

## Environment state

- Dev server `:5173` + CDP Chrome `:9333` left up (single game tab); conmon `scripts/c19/c19-conmon.mjs` → `scripts/c19/console19.log`.
- Restored: mock gamepad removed (`getGamepads` → 0), autopilot disarmed, reduced-motion back OFF, quit to title (sits on SWITCHBACK RIDGE). Records left as honest earned laps `{20.94, 22.02, 22.41}`; settings sane.
- Evidence: `docs/gauntlet/evidence/wave19/c19-*.png` (16 screenshots). Probes via `scripts/c19/c19-eval.mjs` + `c19-conmon.mjs`.

## Bottom line

FIX-009 is verified end-to-end with real pad-pipeline coverage, and every prior guarantee re-holds. No MEDs this wave — the vein is finally empty. What remains is polish: the GO camera cut is the most visible artifact (steer the countdown orbit to land behind the kart), the settings loader needs the same per-value validation records got, and a blur auto-pause would close the last UX gap. **8.5/10 — clean pass.**
