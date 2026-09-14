# Critic 6 — Adversarial Re-Verification of Critic 5 Fixes

**Target:** `Grok Bots Kart Racing` @ `http://localhost:5173/` (Vite dev server)
**Fix commit under test:** `61c433b` ("address critic5 findings")
**Method:** live `playwright-cli` driving, synthetic key events, `window.__game` state inspection, seeded `localStorage` corruption, controlled kart teleports, full races on all three tracks.

## Verdict: 6/10

Six of the seven claimed fixes verify clean (D2, D3, D4, D5, D6, D7). The headline fix — the D1 AI recovery ladder — still **deadlocks on nose-in wall pins**: the new `forwardSpeed < -1 → stuckTime = 0` early-exit makes the 4 s forward stage and the 6 s Lakitu respawn unreachable whenever the wall blocks forward escape. A new defect was also found: the `swap` item teleports karts without exchanging `RacerProgress`, desyncing the ±48-sample continuity tracker.

## Verified working

| Fix | Evidence | Notes |
|---|---|---|
| D2 `★REC` scoping | `critic6-d2-no-star-single.png` | GP leg 1: record lap → `★REC` on player row. Leg 3 (22.42 s vs 15 s record) → no star. Final standings clean (`P1 ★` is the winner glyph, not `★REC`). Quit cup → single race 24.72 s lap → no star. |
| D3 record validation | live storage reads | `{"0":"garbage","1":-5,"2":null}`, `{"0":{}}`, `{"0":[1,2]}`, `{"0":"19.5"}` (numeric strings rejected), invalid JSON, `{"0":0}` — all filtered, no `rec` shown on title. A real 20.08 s lap rewrote the filtered track-0 entry. Tracks remain playable. |
| D4 displacement stuck-hint | `critic6-d4-stuck-hint.png` | Fires ~2.2 s on nose-in +wall pin, ~2.16 s on angled −wall pin with ~1.8 m/s phantom speed. No false positive while reversing at 6 m/s or while genuinely moving. Caveat: threshold is `moved < 0.02`/frame ≈ 1.2 m/s — a sustained sub-1.2 m/s throttle-held crawl also trips it (borderline-acceptable: the kart is effectively pinned). |
| D5 persisted reduce-motion | storage reads | M flips `grok-kart-settings.reducedMotion` instantly; `true` survives `location.reload()`. Options row consistent. |
| D6 pause over results | `critic6-d6-invisible-pause.png` | On RESULTS: P freezes sim (time stops), no PAUSED overlay rendered; P again resumes. Quirk: N cannot advance GP legs while paused — users must unpause first (expected if pause is real; documented). |
| D7 unbound hints | title innerText | Empty bindings → `… item unbound …` readable text; universal arrow alternates keep `AD / arrows — drive` legible. |
| Normal racing | `critic6-sr-results.png`, `critic6-nn-results.png` | Full races on all three tracks. AI best laps 16.85–22.7 s (in band). All AI finished, positions update, results correct, no phantom DNF. Console: 0 errors, 0 warnings. |

## Defects

### D1 — AI nose-in wall pin still deadlocks the recovery ladder — HIGH (Critic 5 D1, incompletely fixed)

**Repro (controlled):** In a live race on Proving Grounds, teleport AI kart 0 to the +5.1 m wall at straight index 48, heading nose-into-wall, zero velocity. Monitor at 50 ms.

**Observed:** 331 samples / ~16.5 s: 268 throttle + 63 brake samples, max single-sample displacement 0.105 m, lateral confined to 5.13–5.25, lap stays 1. Brake bursts recur on a ~1 s cadence (1.06, 2.07, 3.06, 4.06 s). The kart never reaches the forward-drive stage, never respawns — frozen 65–150 s until an unrelated AI `swap` item coincidentally teleported it free. Reproduced again on Switchback Ridge hairpin (index 620): frozen 0–6.5 s, then freed only by an external swap at ~7 s, not by the ladder.

**Contrast:** tail-in pin at the same wall (index 300, heading facing away) recovers in ~5 s via the forward stage — so the ladder works when forward escape is unblocked; it fails specifically when `forwardSpeed` reaches < −1 during reverse but the wall still blocks the drive-off.

**Root cause:** `src/game/AiDriver.ts:120-124` — inside the `stuckTime >= 2` ladder, `if (kart.forwardSpeed < -1) { this.stuckTime = 0; return {throttle:1,…} }` zeroes the frozen counter the instant reverse gains > 1 m/s backward. The kart then throttles back into the wall, the wedge detector needs 2 fresh 0.5 s samples to rebuild `stuckTime` to 2, and the cycle repeats — `stuckTime` can never reach `>= 8` (forward stage) or `>= 12` (Lakitu, `AiDriver.ts:111-118`). The `> 0.5 m` displacement reset at `AiDriver.ts:92-96` compounds it: any reverse that does move the kart also restarts the count. Net effect: nose-in pins oscillate brake/throttle ~1 s forever; the advertised 6 s respawn guarantee is unreachable.

**Evidence:** `critic6-d1-nosein-deadlock.png`, `critic6-d1-pileup-deadlock.png`

**Fix sketch:** don't reset `stuckTime` to 0 on `forwardSpeed < -1` — cap the reverse stage by sample count (as the code comments already intend: "…1-4 s reverse, 4-6 s forward, 6+ s Lakitu") so the ladder always progresses to respawn, or treat "reversed but still frozen" as continued `stuckTime`.

### D8 — `swap` item teleports karts without exchanging race progress — MEDIUM (new)

**Code finding:** `src/game/Items.ts:190-218` — swap exchanges `position`, `velocity`, `heading`, `trackIdx` only. `RacerProgress` (`lap`, `progressIdx`, `lastIdx`, gate `mask`, `spawnOffset` — `src/game/Race.ts:17-35`) is never swapped, and `Items.use()` isn't even handed the racers array.

**Why it bites:** the tracker resolves position via `nearestIndexNear(pos, lastIdx)` — a ±48-sample continuity window (`Race.ts:68-84`, `Track.ts:243-264`). Any swap with a gap > 48 samples (normal mid-race spread is 50–300+) lands the kart outside its own window. The tracker then *walks* ±48/frame toward whatever window sample is physically nearest — inflating `progressIdx` through gates it never drove, or accumulating `backwardAccum` (wrongWay) if it walks backward.

**Observed:**
- Forced player swap (staged): kart teleported 990 → ~822 (backward), tracker walked *forward* and settled at `lastIdx 855, progressIdx 1023` — progress kept the old 990 anchor plus driving distance instead of adopting the landing position. The shooter's lap/mask never reflect the exchanged position; position ordering and gate accounting silently skew.
- Wrong-leg lock (same mechanism, >48 jump onto a gravel apron between SR foldback legs): kart physically at index ~525 while `lastIdx` parked stable at 14, `backwardAccum` 24, `wrongWay:true` indefinitely; after Backspace respawn the tracker re-anchored to ~994 — a *different* wrong leg — still `wrongWay:true`. Foldback legs on Switchback Ridge sit ~12.6 m apart, so a swap landing on/near a parallel leg can lock the tracker to the wrong leg semi-permanently.

**Severity rationale:** swap draws at 2–16% weight — common. Corruption is silent (positions/laps wrong with no visual cue beyond a possible WRONG WAY flap). Wrong-leg lock proven via teleport; in-game trigger via swap landing near foldbacks is plausible but not yet demonstrated mid-race.

**Evidence:** `critic6-d8-progress-desync.png` (stuck WRONG WAY banner over desynced state)

**Fix sketch:** exchange the racers' `RacerProgress` state alongside kart state in `Items.use()` (pass racers in), or at minimum re-anchor `lastIdx = track.nearestIndex(newPos)` + recompute `nextCross`/`spawnOffset` on any teleport, the same way `kart.trackIdx = -1` already re-anchors the kart itself (`Kart.ts:301`).

## Attack matrix coverage (what was tried)

- **D1:** nose-in +wall straight (PG i48) → deadlock; nose-in +wall hairpin (SR i620) → deadlock (freed by external swap at 7 s); tail-in −wall corner (SR i300) → recovered ~5 s; earlier multi-AI pileup at wall end → deadlock. Countdown-phase "freeze" excluded (expected stationary).
- **D2:** leg-1 record star; leg-3 + final-standings no-star; quit-cup → single-race no-star; per-leg `recordSetThisRace` reset confirmed at `Game.ts:458,486`.
- **D3:** six corrupt shapes + `{"0":0}` + invalid JSON + numeric string — all filtered; real lap rewrites entry; tracks playable.
- **D4:** +/− wall pins nose-in & angled, phantom speed 1.8 m/s → hint ~2.2 s; reversing 6 m/s, driving, wall-crawl ≥1.2 m/s → no false positive.
- **D5:** M toggle ×2 + reload persistence.
- **D6:** P over results ×2 (pause/resume), no overlay; N-while-paused no-op documented.
- **D7:** empty bindings for throttle/brake/item/respawn → readable "item unbound" + arrow alternates.
- **Racing:** full races PG/SR/NN, AI laps 16.85–22.7 s, all finishers, correct results; GP 3-leg run with points [10,7,5,3] accumulating correctly (30/17/15/13 final). Console clean throughout.

## Not verified / limits

- Organic nose-in beaching was not observed in ~3 full AI races — the deadlock needs an AI to wedge nose-first, which the improved steering mostly avoids; controlled pins prove the hole remains when it happens.
- D8's wrong-leg lock was demonstrated via eval teleport; the equivalent in-game trigger (swap landing on a foldback-adjacent leg) was staged once and resolved correctly that time — the window geometry is narrow but real.
- `unbeatable seeded record` (`{"0":0.5}`) covered logically via the >record-lap single-race test rather than a fresh reload cycle.

## Cleanup status

Game left on title screen, `1 RACE` (GP off), default bindings (`grok-kart-bindings` absent → defaults), all keys released, autopilot/monitors off. `localStorage` holds legitimately-earned records (PG 14.00 s, SR 9.27 s, NN 15.00 s). No source files modified; no commits.
