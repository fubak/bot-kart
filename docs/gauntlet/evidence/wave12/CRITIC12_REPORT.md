# CRITIC 12 — Whole-Game Production Review

**Date:** wave 12 · **Build:** localhost:5173 (Vite dev, commit 7c24ccb "FIX-003: critic-11 batch") · **Method:** playwright-cli live session, `window.__game` hooks, autopilot soak, per-frame pixel analysis, `git show` source audit · **Baseline:** Critic 11 scored **7.5/10** with two MEDs (dead-stop wall pin, SR AI wall-grind cycles).

**Overall score: 7.6 / 10**

The wave landed three clean LOW fixes — NN sky is a readable deep indigo, the ink overlay no longer sticks to the title after a quit-while-inked, hat() caches its noise buffer — plus a banner-underside lift and a structurally correct player-only pivot flag (AI never pivots). **But the two headline fixes under-deliver:** the standstill pivot works on open road yet is defeated by `dirSign` sign-flips exactly where it's needed — a kart parked nose-in at a wall still cannot steer out with W+steer, the precise critic-11 scenario — and AI careful mode shows no measurable aggregate improvement in SR grind share (worst bot still ~9% stopped / ~14% crawling). Two MEDs persist; no clean pass.

---

## Regression verification — critic-11 defects / wave-12 change list

| Item | Status | Evidence |
|---|---|---|
| Dead-stop wall pin escapable via W+steer | **NOT FIXED** — pivot defeated at wall contact | `c12-pg-wallpin-stuck.png` (STUCK hint live, fs=0), `c12-sr-autopilot-wallpin.png`. Manual W+A: 4 s → dh −0.11 rad, heading range 0.026 rad. Manual W+D: 5 s → dh 0.009 rad. Autopilot-held pin (steer=1, throttle): 7.2 s → range 0.009 rad. Free-road control: W+A 3.1 s → **+1.32 rad** (pivot works with no wall). `Kart.ts:560–561` |
| SR grind cycles reduced (AI careful mode) | **NO MEASURABLE IMPROVEMENT** | 46.2 s SR sample, worst bot: **9.2 % <0.5 m/s · 13.6 % <4 m/s · 8.7 % reversing** vs critic-11's 10 %/12 %. One 3.5 s wedge episode (fewer cycles than c11's repeated clusters) but identical aggregate. `AiDriver.ts:330–334` |
| NN sky lifted to deep indigo | **FIXED** | `c12-nn-race-1/2/3.png`, `c12-title-nn*.png` — near-black pixels 3.8–6.3 % mid-race (was 19–33 %), sky band mean RGB (2–4, 8, 22–24) = indigo not void. `Track.ts:185,197–201` (skyTop `0x2c3e5c`, horizon `0x2a4a6e`) |
| Ink overlay stuck on title | **FIXED** | Inked player (`inked=true`, `c12-pg-inked.png`) → Q → title: `inkEl` display `none`, only title-text div visible, `c12-title-after-inked-quit.png` clean. `RaceHud.ts:286–288` |
| hat() per-note AudioBuffer alloc | **FIXED** (source) | `Music.ts:100–112` caches `hatBuf` on attach; `hat()` at `Music.ts:193–204` reuses it — zero per-hit allocation |
| Banner underside dim edge-on | **IMPROVED** (source + mechanism) | `emissiveIntensity` 0.22→0.34 (`Track.ts:981`) **plus** dedicated emissive bulb strip on the bottom edge (`Track.ts:988–1001`, 1.15 day / 1.6 night) |
| Player-only pivot: AI unaffected | **VERIFIED** | `aiKarts.map(k=>k.pivotSteer)` = `[false,false,false]` live; flag armed only on `this.kart` (`Game.ts:252`); all 3 AI launched straight and finished every GP leg |
| Pivot-cheat through hairpins | **NOT VIABLE — non-defect** | Pivot ≤1.04 rad/s only while |fs|<0.8 m/s; kart can't build speed mid-pivot (grip scrubs velocity as heading rotates — fs stayed 0.002 through a 1.32 rad free-road turn). A 180° hairpin ≈ 4–7 s of pure pivot + zero exit speed vs ~3 s driving it at ≥8 m/s — strictly slower, forfeits drift charge |
| GP correctness (provisional/settled/standings/re-arm) | **VERIFIED end-to-end** | See GP stats below; `c12-gp-*.png` series |

---

## Defect table

| # | Sev | Defect | Repro | Evidence | Cause |
|---|---|---|---|---|---|
| 1 | MED | **Standstill pivot is defeated at wall pins — W+steer produces ~zero net rotation.** The pivot fires (authority 0.4) but `dirSign = fwdSpeed >= 0 ? 1 : -1` reads a microscopic velocity that wall restitution keeps jittering across 0 (fs sampled ±0.001–0.17). Each sim tick's pivot yaw (+0.0087 rad, exactly matching the observed ±1-tick oscillation) is reversed by the next tick's flipped dirSign. Heading settles at an equilibrium: W+full-lock for 4–9 s nets 0.009–0.23 rad; steering *direction* is nondeterministic (same input rotated both ways across trials). Escape possible only ~sometimes/slowly; S-reverse still works (dh −5.12 rad, off wall) and the STUCK hint fires — but the fix's stated goal ("a pin is escapable with W+steer") fails in exactly the reported scenario. | Park nose-in ⊥ any wall (`kart.reset(point+left*5, atan2(-left.x,-left.z))`), hold W+A or W+D 4 s → heading frozen. Or watch autopilot beach a real SR pin: steer=1 held 7.2 s, heading range 0.009 rad. | `c12-pg-wallpin-stuck.png`, `c12-sr-autopilot-wallpin.png`, pin-test series | `Kart.ts:560` — dirSign from instantaneous `fwdSpeed` has no hysteresis at standstill; should hold +1 (or follow throttle intent) while |fs|<`steerMinSpeed` |
| 2 | MED | **SR wall-grind cycles persist — careful mode shows no aggregate improvement.** Worst bot over a clean 46.2 s descent-window sample: 9.2 % stopped / 13.6 % <4 m/s / 8.7 % reverse-time (critic-11: 10 %/12 %). Episode structure improved — one 3.5 s wedge the ladder cleared vs repeated stop-reverse-go clusters — but a bot visibly crawling hairpins ~14 % of a lap is the same spectator-facing defect. | Start SR race; sample `aiKarts[i].velocity·forward` at 4 Hz through the descent. | Measured sample (AI1: 9.2/13.6/8.7; AI0: 0/2.2; AI2: 3.8/6.0); `c12-sr-race.png` | `AiDriver.ts:330–334` 4 s × 0.85 is a thin mitigation; corner-entry target speed still hot for ~15 m hairpins (`tuning.ts:222` `driftEnterRadius 17`, `cornerAccel 26`) |
| 3 | LOW | **STUCK hint fires during legitimate pivots.** Displacement-based detector (`moved < 0.02`/frame) can't see a kart rotating in place — during a free-road W+A pivot (heading sweeping, fs≈0) the HUD still told the player "STUCK? ⌫ respawn · S reverse", coaching them out of a working recovery. | Park mid-road, hold W+A 2 s+ → hint appears while rotating. | `c12-pg-pivot-stuck-hint.png` (hint 'block' mid-pivot) | `Game.ts:625–631` — could also test `|yaw rate|` or `onWall` |
| 4 | LOW | **Steer-authority cliff at the 0.8 m/s pivot threshold.** `max(speedFactor, pivot)`: at 0.79 m/s authority is 0.4; at 0.81 m/s it collapses to ~0.002 (smoothstep floor) and doesn't return to 0.4 until ~4.7 m/s. Mid-escape the steering momentarily lets go exactly as the kart starts to roll — a 200× discontinuity that reads as the kart "giving up" mid-turn. | Free-road W+A from stop: heading rotates, then yaw rate visibly sags as fs crosses 0.8 (measured 0.44 rad/s avg vs 1.04 theoretical). | Pin/pivot series | `Kart.ts:548–557` — pivot should taper (e.g. `0.4 * (1 - fs/steerMinSpeed)`) rather than step to zero |
| 5 | LOW (watch) | **NN draw calls ~2× critic-11 reading.** `renderer.info` (autoReset=false, reset once per frame → full scene+shadow+post count): ~574–686 draws / 98–111 k tris on NN mid-race vs 315 / 77 k reported in wave 11 (PG mid-race this wave: ~320). fps holds at 68 — likely more emissive/shadow casters in view — but worth a budget note before it creeps further. | NN mid-race probe of `renderer.info.render` | perf sample | scene content growth on NN; verify vs c11 measurement position |

No HIGH-severity defects. Defect 1 is the carry-over MED in new clothes; defect 2 is the carry-over MED unimproved; 3–4 are new edge-level UX nits introduced by the pivot feature; 5 is an observation.

---

## What holds up

- **GP is correct end-to-end, again.** Leg 1 PG settled (10/7/5/3, all finished); leg 2 SR showed `… BOT-C … best --:--.-- …pts provisional` for the unfinished bot; leg 3 NN settled; FINAL STANDINGS sorted by cumulative points with `P1 ★ BOT-B 25 pts`; cumulative math exact at every leg (13/14/15 → 18/21/25). Q from standings → fresh `1 RACE` title, G re-arms `GRAND PRIX — leg 1/3`. `c12-gp-*.png`.
- **Ink fix is real, not just a code path.** Forced `inkedUntil` → overlay showed in race → Q → title DOM audit: zero ink elements visible; `kart.inked` cleared on regrid.
- **NN sky is genuinely indigo now.** Sky-band pixel mean (2–4, 8, 22–24) RGB — blue-dominant and lifted; near-black share 3.8–6.3 % mid-race vs 19–33 % before. Night track still reads dark (mean 31–37 luminance) but no longer void.
- **Pivot flag hygiene is right.** Player-only (`Game.ts:252`), AI all `false`, no launch-phase AI rotation, no pivot during countdown/title (input gated to IDLE).
- **Wrong-way flag verified on a clean race** (backwardAccum 35 → banner `display:block`); earlier false-negative was my own teleport contaminating the continuity tracker — the critic6 D8 anti-phantom logic working as intended.
- **P, O (volumes/difficulty/motion/minimap/rebind), R, ⌫, M all functional**; R from final standings would restart the cup fresh (verified via `gpDone` path read + restart during testing).
- **Audio live**: sfxCount 1450+, `music.themeIdx` 2 on NN, hat buffer cached.
- **Zero console errors, zero warnings** across title → 3 tracks → full GP → standings → re-title.

## Performance — NEON NIGHT, mid-race, 680-frame sample

| Metric | Result | Budget | Pass |
|---|---|---|---|
| Avg FPS | **68.0** | ≥ 55 | ✅ |
| Frame time p50 | 14.7 ms | — | — |
| Frame time p95 | **15.4 ms** | ≤ 16.6 | ✅ |
| Frame time p99 | 15.7 ms | — | — |
| Worst frame | 15.9 ms | — | — |
| Draw calls (frame-total incl. shadow+post) | ~574–686 | — | watch (#5) |
| Triangles | ~98–111 k | — | — |

Frame pacing remains exceptional (worst 15.9 ms — zero hitches).

## Console

`0 errors · 0 warnings` across every session this wave (title orbit ×3, PG/SR/NN races, full 3-leg GP, standings, ink test, pin tests). Only `[vite] connect` infos.

## Grand Prix statistics (observed run)

| Leg | Track | Winner | Player | Cumulative (YOU / best bot) | Notes |
|---|---|---|---|---|---|
| 1 | PROVING GROUNDS | BOT-B 0:22.57 | P4 2:44.50* | 3 / 10 | All 4 settled; correct 10/7/5/3 |
| 2 | SWITCHBACK RIDGE | **YOU 0:22.63** | **P1** | 13 / 15 (BOT-B) | BOT-C unfinished → `…pts provisional` row verified |
| 3 | NEON NIGHT | BOT-B 0:45.28 | P3 0:47.04 ★REC | 18 / 25 | All settled |
| Final | — | **★ BOT-B 25 pts** | P3 18 | — | Sorted standings, champion crowned, title re-armed clean |

\* Player idled ~2 min mid-leg while the autopilot was re-armed (module-cache gotcha in the harness, not a game bug).

## Session notes / non-defects

- **Autopilot module is cache-sticky** — `await import('/__gauntlet/autopilot.js')` re-import returns the cached module without re-executing; a second soak needs `fetch`+`eval` (or `__ap` stays null). Harness note only.
- The leg-1 2:44.50 and the SR wall-pin the autopilot beached itself on are harness artifacts/reported defect evidence — the game behaved correctly around them (STUCK hint fired at 2 s both times).
- Pivot-cheat analysis (not a defect): stop→pivot→relaunch is strictly slower than any corner taken at `cornerMinSpeed` (8 m/s), and the 0.4→0 cliff at 0.8 m/s (defect #4) self-limits chaining.
- The `slope`-inversion edge (parked uphill → fs held negative → inverted steer) is unreachable on current tracks — steepest SR rise is ~0.11 rad, slope force ~1.2 m/s² ≪ accel 18.
- "leg 1/3" text visible in DOM during later legs is the title strip behind the race UI (display-gated) — not stale-on-screen.

## Gap to MK8 (unchanged shape)

The remaining distance is feel and content scope, not correctness: input at the speed floor (the pin/pivot zone) still isn't trustworthy, AI corner-entry pace still can't hold SR hairpins cleanly, and the race format/kart-roster depth is a fraction of the reference. Fix the `dirSign` hysteresis at standstill and the corner-speed model's hairpin entry, and this build is a credible 8+.
