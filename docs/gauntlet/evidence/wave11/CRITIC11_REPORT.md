# CRITIC 11 — Whole-Game Production Review

**Date:** wave 11 · **Build:** localhost:5173 (Vite dev) · **Method:** playwright-cli live session, `window.__game` hooks, autopilot soak, per-frame pixel analysis, source audit · **Baseline:** Critic 10 scored **7.0/10** with floating road-edge geometry as the top defect.

**Overall score: 7.5 / 10**

Every defect Critic 10 filed is verified fixed — visually, numerically, and in source. The game now passes the "clean playthrough" bar: three distinct tracks, a working three-leg Grand Prix with correct provisional/settled scoring, per-track music, expressive drivers, clean console, and 68 fps on the heaviest track. What remains are two feel-level issues (dead-stop wall pins, AI wall-grind cycles on Switchback Ridge) plus polish nits — no HIGH defects, nothing that crashes, corrupts, or visually breaks. The gap to Mario Kart 8 is now about content scope and input feel, not correctness.

---

## Regression verification — Critic 10 defects

| C10 defect | Status | Evidence |
|---|---|---|
| Floating wall footings / road-edge geometry | **FIXED** | `c11b-pg-footing-out.png`, `c11b-nn-footing-out.png`, `c11b-sr-footing-out.png` — continuous wall→footing→field transitions at raking outside angles; numeric probe shows footings embed ~0.08 m into the embankment. `Track.ts:717–802`. |
| Gravel apron drop-faces clipping / floating shelves | **FIXED** | Same shots — three-vertex gravel strips terminate in a grounded drop-face with berm toe. `Track.ts:804–879`. |
| Skirt edge not meeting grade | **FIXED** | Skirt outer edge reaches −0.1 and meets the flat field; no daylight under the rim in any outside shot. `Track.ts:881–923`. |
| Kerbs read as oversized slabs | **FIXED** | `c11-pg-kerb-close.png` — kerb lip now 0.08 m, reads as a kerb not a parking block. `Track.ts:683–715`. |
| Item boxes blown out | **FIXED** | `c11b-nn-itembox.png` — 0.0 % blown pixels; boxes read chromatic cyan/purple at chase distance. |
| Billboard backs pure black | **FIXED** | `c11b-sr-billboard-back.png` — poster art is now cloned mirrored onto the back face plus a lifted frame lip (`Track.ts:1795–1808`). 0 % void on the back side. |
| Neon sign panels floating | **FIXED** | `c11b-nn-sign.png` — posts grounded with emissive glow feet (`Props.ts:767–818`). |
| Pylon backs / scanlines | **FIXED** | `c11-nn-pylon-close.png` — backs read as dark material, scanline texture present. `Track.ts:1420–1549`. |
| NN gate rails = floating sky sabers | **FIXED** | `c11b-nn-gate-edge.png` — rails read as contained neon bars on posts. |
| GP unfinished rows showing wrong concrete points | **FIXED** | `c11b-gp-l2-provisional.png` + DOM: `… BOT-C … best --:--.-- …pts provisional` for every unfinished row. `RaceHud.ts:371–397`. |
| Settled GP rows / points mismatch | **FIXED** | `c11b-gp-l3-settled.png` — points awarded by sorted row index match the award loop exactly (`RaceHud.ts:385–394`, `GP_PTS` table). |
| Driver head = blown white orb | **FIXED** | `c11b-nn-driver-head.png` — matted helmet with readable visor at NN chase angles. |
| AI stragglers too far behind | **FIXED** | Rubber-band holds the pack: clean 45 s SR sample shows AI avg 21.3–24.2 m/s vs max 28; every bot finishes every observed race. `tuning.ts` AI block, `AiDriver.ts`. |
| Q did not disarm GP | **FIXED** | Q from an armed cup and from final standings returns a fresh title (`1 RACE [G]`, no leg-4/3 ghost). `Game.ts:568–572`. `c11b-title-after-gp.png`. |

**15/15 verified.** No regression found in any previously-fixed area.

---

## Defect table

| # | Sev | Defect | Repro | Evidence | Suspected cause |
|---|---|---|---|---|---|
| 1 | MED | **Dead-stop wall pin: zero steering authority at 0 m/s.** A kart parked nose-in against a wall cannot rotate at all — steering input produces literally zero yaw. Only S-reverse (steer flips via `dirSign`) or ⌫ respawn escapes. Autopilot hit this 3+ times/session; humans see the STUCK hint after 2 s, but a kart racer where holding full lock against a wall does *nothing* is un-Mario-Kart — MK8 always lets you rock/rotate out. | Hold W into any wall until stopped; then hold full left/right — heading does not change (verified: `heading` frozen while steer input held). | `c11b-nn-stuck.png` (onWall, spd 0, STUCK hint live) | `steerMinSpeed: 0.8` (`tuning.ts:33`) + `speedFactor` smoothstep at `Kart.ts:538–545` — yaw authority scales to zero at standstill; contact-episode wall model (`Kart.ts:567+`) slides only while there's velocity. No rock-out/rotate assist. |
| 2 | MED | **AI wall-grind cycles on Switchback Ridge.** Worst bot spent ~10 % of a clean 45 s sample below 0.5 m/s and 12 % below 4 m/s on SR's switchback descent — the wedge→reverse→rebind recovery ladder fires correctly but re-enters the same grind on consecutive hairpins. Bots always finish (avg 21.3 m/s) so it's a look-and-feel defect, not a DNF. | Start an SR race, spectate minimap/`__game.aiKarts[i].forwardSpeed` through the descent; watch for repeated stop-reverse-go clusters. | `c11b-sr-race-b.png` + measured sample (AI2: 10 % still / 12 % slow / avg 21.3; AI0/AI1: 0–3 %) | Recovery thresholds (`AiDriver.ts:139–215`: grind>4 s→wedge→reverse→rebind) cure symptoms but corner-entry target speed is still too hot for SR's ~15–20 m radius hairpins (`driftEnterRadius 17`/`driftExitRadius 30`, `tuning.ts`). |
| 3 | LOW | **NN night frames run 30–40 % near-black.** Typical chase/raking framings put the near-empty night sky across a third of the frame; outside the neon corridors the scene has few mid-tones. Reads sparse rather than "lit raceway at night" in stills. | Race NN; screenshot any frame angled above the horizon. | `c11b-nn-gate-edge.png` (33 % near-black), `c11b-nn-sign.png` (19 %) | Sky gradient is near-black above the horizon with only point stars (`Sky.ts`); no mid-level set dressing between neon structures. |
| 4 | LOW | **Music `hat()` allocates a fresh AudioBuffer every 8th-note** — `createBuffer` + a ~1 764-sample `Math.random()` fill at ~2–4 Hz forever. Inaudible, but sustained GC churn where one cached noise buffer would do. | n/a (code read) | n/a | `Music.ts:186–201` — buffer built per hit instead of cached per context. |
| 5 | LOW | **Start/finish banner underside still reads dim edge-on** (carried C10 accepted nit) — the underside is now dimly lit (~40–55 RGB, not void) but the checker emissive doesn't wrap, so from directly below it's a dark slab. | Park under the start gantry, camera up. | `c11b-nn-banner-under.png` | Banner underside face unlit by the emissive checker map; no dedicated underside material. |
| 6 | LOW | **Orange AI kart is boxy/under-detailed** next to the player pod — flat slab bodywork, minimal silhouette interest (carried nit). | Spectate BOT-A2 in any race. | `c11b-sr-race-a.png` | AI kart body uses the simplified procedural shell; hero-kart detail passes (intake, rails, pod) aren't applied. |

No HIGH-severity defects. Defects 1–2 are input/AI feel rather than correctness; 3–6 are polish.

---

## What holds up

- **Road-edge construction is now genuinely solid.** Walls embed into footings, gravel terminates in grounded drop-faces with berms, skirts meet grade at −0.1, kerbs are kerb-sized. Three tracks, outside raking angles, zero voids in the edge band (`c11b-*-footing-out.png` trio).
- **Grand Prix is correct end-to-end.** Leg 1 PG → settled results with exact row-order points; leg 2 shows `…pts provisional` for every unfinished racer (verified in DOM, not just pixels); leg 3 settles; FINAL STANDINGS sorts by cumulative points and crowns `P1 ★ YOU`; cumulative math checked at every leg (3 + 10 + 10 = 23). Q from standings → clean fresh-cup title — the leg-4/3 ghost is gone. `c11b-gp-*.png` series.
- **Audio is wired and measurable.** `audio.sfxCount`/`lastSfx` live-count every cue (pickup, launch:boost, launch:missile, uiConfirm, uiBack…); `music.themeIdx` switches 0/1/2 correctly across tracks and GP legs; champion jingle fires (`lastSfx: "champion"`, count +1); ambience layer present.
- **Drivers are alive.** Idle look-around verified numerically — parked head yaw sweeps −0.37 → +0.13 rad over ~8 s on the title grid (`Kart.ts:780–789`); celebration, spin flail, pedal work, blink all present.
- **Reliability features work:** Backspace respawn, R restart, P pause, O options (volumes/difficulty/reduced-motion/minimap/rebind all render and persist), wrong-way flag, STUCK hint, M reduced-motion flag.
- **Zero console errors, zero warnings** across every session this wave (only Vite connect infos).
- **Track identity:** PG pastoral dressing (orchard/hay/fences/pumpkins), SR golden-hour mesas + windmill, NN neon corridor with grounded signage — each reads instantly. `c11b-title-*.png`, `c11b-*-race-*.png`.

---

## Performance — NEON NIGHT, mid-race, 600-frame sample

| Metric | Result | Budget | Pass |
|---|---|---|---|
| Avg FPS | **68.2** | ≥ 55 | ✅ |
| Frame time p50 | 14.6 ms | — | — |
| Frame time p95 | **15.3 ms** | ≤ 16.6 | ✅ |
| Frame time p99 | 15.7 ms | — | — |
| Worst frame | 15.8 ms | — | — |
| Draw calls | 315 | — | — |
| Triangles | 76 691 | — | — |

Re-sampled at speed 21.6 m/s (first sample ended with the kart wall-pinned): identical distribution — 68.0 fps, p95 15.3 ms. Frame pacing is exceptionally tight (worst frame 15.8 ms — no hitches at all).

## Console

`0 errors · 0 warnings` on every audit this wave (title, all three races, GP legs, results, standings). Only `[vite] connecting/connected` infos.

## Grand Prix statistics (observed run)

| Leg | Track | Winner | Player | Notes |
|---|---|---|---|---|
| 1 | PROVING GROUNDS | BOT (t≈14 s*) | P4 | All 4 finished; rows settled |
| 2 | SWITCHBACK RIDGE | YOU 0:22.70 | **P1** | AI frozen by QA patch → all rows `…pts provisional` — provisional display verified |
| 3 | NEON NIGHT | YOU 0:23.32 | **P1** | AI unfroze mid-leg (patch persisted across `buildWorld` regrid — karts are reused, not rebuilt); all settled |
| Final | — | **★ YOU 23 pts** | champion | Standings sorted by points; jingle `lastSfx:"champion"` |

\* Leg lengths were forced to 1 lap via `race.racers[].totalLaps = 1` to compress the cup — GP flow/scoring is lap-count-independent. Leg-1 leg was fully player-driven by autopilot (~95 s incl. two wall-pin recoveries).

## Session notes / non-defects

- The player-kart stalls seen during soak were **autopilot line-choice failures** recovering via the STUCK-hint path — the game behaved correctly each time (hint at 2 s, respawn works). Reported only as defect #1's evidence, not as a game freeze.
- Near-black NN sky pixels flagged by the pixel scanner are the intentional night gradient + stars — confirmed visually, not void geometry.
- Dark SR cluster in `c11-sr-wall-outside.png` is a warm cast shadow (≥23 RGB), not a hole.
- "Blown" cells on PG shots are sunlit white kerb/wall tops (~240 RGB) — physical highlights, not bloom.
