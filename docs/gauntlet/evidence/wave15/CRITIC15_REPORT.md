# CRITIC-15 — Wave 15 Verification Report

**Commit under test:** `afa0fe4` — "FIX-005: critic-14 batch — swap lap-theft, texture leak, polish"
**Build:** live `http://localhost:5173` (Vite dev), Three.js 0.185.1
**Method:** CDP-driven live testing (port 9333), `window.__game` introspection, autopilot, screenshots `c15-*`
**Verdict:** **8.0 / 10** — NOT a clean pass (1 MEDIUM). Second consecutive clean pass not achieved; the c14 swap fix is correct for lap counting but leaves a same-function score defect.

---

## Defect table

| # | Severity | Defect | Reproduction | Evidence | Source |
|---|----------|--------|--------------|----------|--------|
| D1 | **MEDIUM** | `RacerProgress.resync()` drops exactly one lap of score for karts gridded behind the start line. `progressIdx = (lap-1)*n + i` ignores the free first line crossing behind-line karts already made — honest unwrapped progress is `lap*n + i` for them. Every swap calls `resync()` on BOTH parties (Items.ts:291-292); AI slots 1 & 2 spawn at idx ~1017/1010 (`gridSlot` backSamples 17/24 vs grid0=10). Result: any swapped behind-line kart permanently scores −1024 → ranks "last on its lap" for the rest of the race → live `P#/4` positions wrong for it and ±1 for everyone it should pass; swap/ink targeting and position-weighted item rolls skew; ordering among unfinished rows at leg end can flip. Lap counting itself stays correct (nextCross shifts equally); finishers sort by finishTime so decided results survive. | Fresh race (no prior resyncs), lap 1: `racers[2].resync(pos, trackIdx)` in place → score **1065 → 41**; `racers[3]` → **1063 → 39**. On-line spawns (player idx 0, AI0) unchanged. −1024 = −n exactly. | live CDP probe, leg-2 SR fresh restart | `src/game/Race.ts:145` (`this.progressIdx = (this.lap - 1) * n + i;`); spawn offsets `src/game/Track.ts:622-636`; call sites `src/game/Items.ts:281-292` |
| D2 | LOW | Invisible pause on the results screen silently blocks N. `O` opens options and sets `paused=true` in ANY play phase; closing options (O/Esc/P) returns "to the paused state" by design — but the PAUSED overlay is deliberately hidden when `race.phase === 'finished'` (RaceHud.ts:294). Player sees normal results, presses N → dead (`!this.paused` gate, Game.ts:421) with zero feedback. R still works (and would throw the leg away); Q works. Any P/Esc press clears the trap. | Results leg 1/3 → `O` → `Esc` → `N` → nothing (screenshot identical). `P` → `N` → leg 2 loads. | `c15-results-options.png`, `c15-results-back.png`, `c15-leg2-start.png` | `src/core/Game.ts:383` (open pauses), `:372-379` (close leaves paused), `:421` (N gate); `src/core/RaceHud.ts:294` |
| D3 | LOW | Neon Night mid-race p95 frame time 17.3 ms — marginally over the 16.6 ms budget. 75/719 frames (10.4%) >16.6 ms; worst 19.8 ms; zero frames >33 ms; average 67.8 fps (≥55 pass). Jitter spikes on the heaviest scene, not sustained slowness. | rAF frame-time sampler, 719 frames mid-race leg 3 NN. | stats below | — |
| D4 | LOW | Residual yaw-rate valley ~3 m/s survives the 5 m/s pivot-fade fix. Dyno mean dips to 0.415 rad/s at 3.0 m/s then recovers to 1.066 @ 5.0 / 1.468 @ 6.0 — the c13 cliff is gone and taper is smooth, but the dip is still a dead-ish steering zone at low-mid speed. | `scripts/c14/dyno.js` @ track idx 200, fixed-speed sweep 0.25–7 m/s. | numbers below | `src/game/Kart.ts` pivot fade window |
| D5 | NIT | Results rows wrap the points column mid-token: `+10 → 10` then `pts` spills to a second line on every leg-results row. | Any leg-results screen. | `c15-leg2-results.png`, `c15-shield.png` (leg-1 results) | `src/core/RaceHud.ts` results row layout |

---

## Critic-14 fix verification — all four confirmed

| Fix | Result |
|-----|--------|
| Swap gate-mask wipe → lap theft | **FIXED for lap counting.** New `resync()` marks gates behind the landing index satisfied and reschedules ahead-gates. Full matrix below. BUT the same function carries D1 (score base). |
| GPU texture leak on rebuild | **FIXED.** `Track.dispose()` traverses geometries + all material texture slots (Track.ts:313-331). 8 T-cycles: 32/35/37, 35/33/33, 35/34 textures — bounded per-track fluctuation, no monotonic growth (was +11–18/cycle). Billboard art, crowd decals, road roughness map all render correctly post-rebuild (`c15-title-*`, `c15-nn-race.png`). |
| Respawn mid-spin keeps spin | **FIXED.** `Kart.reset()` clears `spinUntil`/`isSpinning` (Kart.ts:440-441). Live: forced spin active (`isSpinning:true`, 1.35 s left) → Backspace → `spin:false`, `spinUntil:0`, kart at 28 m/s next probe. Controls live immediately. |
| Pivot-to-cruise yaw valley | **IMPROVED, residual LOW (D4).** Cliff eliminated; shallow 3 m/s dip remains. |

## Swap-gate matrix

| Case | Result |
|------|--------|
| Backward swap mid-lap → next line crossing | **PASS** — mask rebuilt from landing index; lap incremented on next crossing (observed `mask:127` → lap 3, `lt:[24.8,32.5,23.5]`, `fin:true`). |
| Forward swap to final-lap run-in → finish | **PASS** — lap=3, resync @ idx 1000 → line crossing → `finished:true`, `phase:'finished'`, single lap time recorded. |
| Resync @ idx 900 lap 1 → no lap-skip / double-count | **PASS** — resync scheduled line gate for the SAME lap (`mask:3`); crossing incremented exactly once to lap 2, not lap 3. |
| Backspace respawn → no gate-skip | **PASS** — respawn does not call `resync()`; continuity tracker keeps progressIdx/nextCross, already-passed gates stay consumed, forward gates must still be driven. No progress gain or loss. |
| Score continuity on resync (behind-line karts) | **FAIL → D1** |

## GP end-to-end (3 legs, live)

- Leg 1 PG: P1 BOT-B +10→10, P2 BOT-A2 +7→7, P3 BOT-C +5→5, P4 YOU +3→3.
- Leg 2 SR: BOT-C +10→15, YOU +7→10, BOT-A2 +5→12, BOT-B +3→13.
- Leg 3 NN: YOU won (+10→20), BOT-C +7→22, BOT-B +5→18, BOT-A2 +3→15.
- **Final standings (points audit exact):** P1 ★ BOT-C 22, P2 YOU 20, P3 BOT-B 18, P4 BOT-A2 15. All rows labeled `P#` — `gpFinal` forces labels for never-finished rows too (RaceHud.ts:378); mid-leg unfinished rows correctly show provisional `…`.
- Mid-leg swap exercised via `items.use` on leg 2; AI item fire observed concurrently (missiles in flight).
- N advances legs; world rebuild + `audio.setTrack(idx)` per leg (Game.ts:435,556); champion = ★ marker + `gpChampion()` fanfare + per-finisher confetti (Game.ts:681-685).
- `Q` from final standings → title on PG; `Q`/`R` ungated by pause (R on standings = fresh cup).

## Item economy — all six live-verified

| Item | Observed |
|------|----------|
| boost | `boostTimer` → 1.4 s (KART.boostTime[1]) |
| missile | traveled centerline, hit planted AI → `spinUntil` set, speed crushed to 3.8 m/s recovering; consumed on hit |
| slick | dropped 2.6 m behind kart, `expiresAt` = +18 s |
| shield | `shieldUntil` = +8 s, bubble mesh visible next frame (`c15-shield.png` shows post-race; state verified `bub:true`) |
| ink | splatted ONLY the racer ahead on score (`aheadN:1` → exactly 1 kart `inkedUntil` +4 s); leading = wasted by design |
| swap | positions/velocities/headings/trackIdx exchanged + `resync()` both parties (see D1 for the score defect) |

## Performance (Neon Night mid-race, ~10.6 s)

frames 719 | **fps 67.8** | p50 14.7 ms | **p95 17.3 ms** | p99 18.7 ms | worst 19.8 ms | >16.6 ms: 75 | >33 ms: 0

## Console audit

conmon persistent listener over the full GP session: **0 errors, 0 exceptions, 0 game warnings.** 68 log lines = 65 `THREE.Texture: Unable to serialize Texture` (CDP `returnByValue` probes serializing Texture objects — harness artifact, not emitted during normal play) + vite connect noise.

## What holds up

- All 3 tracks: title + race visuals clean; NN night theme (neon edges, lit billboards, headlights, dark slicks) genuinely reads well; SR sunset + foldback minimap plausible; minimap dots track correctly.
- Lap-record edge: records only improve (`bt < records[idx]` monotonic), persist per-track, ★REC badge resets per race; record on lap 1 survives slower lap 3.
- Pause/options modal in every play phase; binding capture; wrong-way/stuck hints; provisional results rows re-render at 2 Hz.
- Race core: gate-mask lap model is now correct through swaps, respawns, teleports; finishers rank by finishTime.

## Score

**8.0 / 10.** The c14 batch genuinely landed — texture leak gone, respawn-spin fixed, swap lap counting correct across the whole matrix, and the GP ran clean end-to-end with exact points and zero console noise. But adversarial probing found the fix incomplete by one line: `resync()` rebuilds gates correctly yet rebases `progressIdx` on the wrong lap base for the two back-grid AI slots, permanently costing them a lap of score on every swap — live standings lie for the rest of the race (D1, MEDIUM). Add the invisible-pause N-trap (LOW), a marginal p95 miss on the heaviest track (LOW), the residual 3 m/s steering dip (LOW), and the pts-wrap nit. One MEDIUM → streak broken; award withheld pending a clean wave-16.
