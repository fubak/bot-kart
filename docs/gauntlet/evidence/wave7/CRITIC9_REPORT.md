# CRITIC 9 — Wave-7 Adversarial Review

**Build:** `bot-kart` @ localhost:5173 (Three.js + TS + Vite)
**Date:** 2026-09-14 · **Reviewer:** CRITIC 9 (adversarial playtest)
**Coverage:** 3 titles × ~4 orbit angles, full races on all 3 tracks, full 3-leg Grand Prix + final standings, options menu mid-race, edge cases (pause-in-countdown, item-while-paused, Q-quit, R-restart, wrong-way, wall-pin→STUCK→respawn, ink, swap), perf sample on NN, console audit. 67 screenshots (`critic9-*.png`).

## Overall score: **7.0 / 10**

A genuinely competent, charming little kart racer — clearly above student-project tier. Three distinct, well-dressed tracks; a working Grand Prix loop with standings and a champion star; six functional items; a modal options menu with remappable keys that persists; lap records; minimap; wrong-way + stuck + respawn affordances; and a real post chain. Perf is excellent (68 fps, p99 15.6 ms, zero console noise). What keeps it out of "production" territory is a pervasive floating-kerb defect, an over-hot chromatic edge, crude ink splats, and unreliable AI (frequent DNFs). It reads as a solid indie vertical slice, not Mario Kart 8.

## Verdict by area

| Area | Verdict |
|---|---|
| Title screens (3 tracks, orbit) | **PASS w/ nits** — legible, kart framed well; menu hint wraps mid-item; PRESS ENTER dim-phase dips low; flag quads read as floating at frame top. |
| Race visuals — PG | **PASS w/ nits** — pastoral dressing (hay/fences/flowers/orchard) is rich; floating kerbs + strong CA; billboard backs are black slabs. |
| Race visuals — SR | **PASS w/ nits** — sunset+strata+cairns+arch read well; floating kerbs; one floating strata wedge in the sky. |
| Race visuals — NN | **PASS w/ nits** — neon rails/gates/columns/studs look great at night; floating kerbs; glow-gate bars slash the sky as giant sabers; headlight/item-box bloom blown. |
| Grand Prix (3 legs) | **PASS** — leg scoring, standings, ★ champion, title re-arm all correct; one cosmetic "+0"-delta mismatch for DNFs. |
| Items (6) | **PASS** — shield bubble, swap teleport+resync, ink splat, missile/boost/slick all verified; ink overlay is crude flat discs. |
| Options menu | **PASS** — modal pause mid-race, volume/difficulty adjust, rebind capture, RESET, persistence across reload. |
| Edge cases | **PASS** — pause-in-countdown freezes; item inert while paused (code-gated); Q/R work; wrong-way flag+warning; STUCK hint + Backspace respawn. |
| Performance (NN busiest) | **PASS** — 68 fps avg, p95 15.3 ms, p99 15.6, worst 15.9; 922 draw calls / 126k tris (draw-heavy but smooth). |
| Console | **PASS** — 0 errors, 0 warnings across the whole session. |

## Defects

### MED

1. **Floating kerb/curb slabs on every track edge.** The alternating red/white curb boxes hover ~15–25 cm above the terrain with visible air/shadow gaps, and each slab overhangs the asphalt onto the grass/dirt shoulder — they read as floating planks ringing every corner on all three tracks. *Repro:* any race/title angle near a road edge. *Evidence:* `critic9-nn-start-a.png`, `critic9-nn-race-mid.png`, `critic9-sr-race-2.png`, `critic9-pg-race-2.png`, `critic9-wrongway-on.png`. *Suspected cause:* `src/game/Track.ts:611-636` — curb instanced at `s.left * side * (hw - 0.15)`, `setY(s.point.y + 0.06)` pins each 0.8 m-wide plank at road-center height; the inner 0.55 m sits on asphalt but the outer 0.25 m hangs over the lower shoulder/skirt and floats. Fix: center at `hw - 0.4` so slabs sit fully on the road, or drop Y to follow the shoulder surface.

2. **Speed chromatic aberration is too strong.** At speed the RGB split heavily fringes high-contrast silhouettes (pine trees, sign boards) well inside the frame — the left half of the screen reads like anaglyph 3D. *Evidence:* `critic9-item-shield.png`, `critic9-countdown2.png`. *Suspected cause:* `src/config/tuning.ts` `POSTFX.speedFx` — `aberration: 0.0045` engaging from 0.72×maxSpeed is too much amplitude too early; raise `start` toward ~0.85 or drop amplitude ~40%.

3. **AI reliability — frequent DNFs.** Across sessions AI regularly failed to finish: BOT-B completed *zero* laps in GP leg 1 (`best --:--.--`), 2 of 3 AI DNF'd the final NN race, and field spread is huge (P1 1:10 vs AI 3:29 on NN). Rubber-banding doesn't rescue a stuck/slow AI. *Evidence:* `critic9-gp-leg1-results.png`, `critic9-gp-leg2-results.png`, `critic9-nn-finish2.png`. *Suspected:* `src/game/AiDriver.ts` — no stuck-recovery equivalent of the player's Backspace hint; a wall-pinned AI grinds indefinitely.

4. **NN glow-gate bars / sign panels read as giant sabers slashing the sky.** The ~15 m road-spanning emissive gate bars (cyan/magenta) bloom hard; at raking chase-cam angles they dominate the sky as huge diagonal/vertical light beams. *Evidence:* `critic9-nn-race-13.png`, `critic9-nn-race-14.png` (cyan beam), `critic9-nn-start-c.png` (pink beam), `critic9-countdown2.png`. *Suspected:* `src/game/Props.ts:630-690` — emissiveIntensity ≥2 × bloom threshold; consider lower intensity or shorter bars.

### LOW

5. **Ink overlay = five giant flat perfect-circle dark discs** covering ~40% of the screen including the sky; functional 4 s vision-denial but reads as lens smudges, not ink. *Evidence:* `critic9-sr-race-4.png`, `critic9-gp-leg3-2.png`, `critic9-nn-race-8.png`. *Cause:* `src/core/RaceHud.ts:124-131` — CSS radial-gradient blobs; organic splat shapes would sell it better.

6. **Title menu hint wraps mid-item.** "Q — quit" splits so "quit" lands on its own line; "⌫ — respawn" orphans. *Evidence:* `critic9-title-pg-1.png`, `critic9-title-sr-3.png`, `critic9-title-nn-1.png`. *Cause:* `src/core/RaceHud.ts:~110/227` — hint string too long for the panel width; needs nowrap spans or a second line break.

7. **PRESS ENTER dips near-illegible at blink-phase minimum** against bright backgrounds (visible at some orbit angles). *Evidence:* `critic9-title-sr-4.png`.

8. **Blown emissives at night** — player headlight is a pure-white ball washing out the driver head; item boxes read as solid white cubes. *Evidence:* `critic9-nn-race-6.png`, `critic9-nn-race-mid.png`, `critic9-nn-start-b.png`.

9. **GP results "+N → total" lies for unfinished racers.** A DNF racer shows "+0" but the N-press awards position points anyway (`GP_POINTS[pos]` incl. P4=+3) — BOT-B showed "+0 → 13" then totaled 16. Totals are correct; only the delta display is wrong. *Evidence:* `critic9-gp-leg3-2.png` vs `critic9-gp-standings.png`. *Cause:* `src/core/RaceHud.ts:343` (`earned = rr.finished ? … : 0`) vs `src/core/Game.ts:373` (awards all).

10. **Floating props**: orange flag quads with near-invisible poles at the top of the title orbit; a floating white cube at the PG road edge; a tan strata wedge in the SR sky; a tan slab dangling at the top of NN titles. *Evidence:* `critic9-title-sr-1.png`, `critic9-pg-race-2.png`, `critic9-sr-race-1.png`, `critic9-title-nn-4.png`.

11. **Billboard backs render as pure-black slabs** from behind — read as floating dark voids. *Evidence:* `critic9-pg-race-1.png`, `critic9-pg-race-2.png`.

12. **Minimap translucent background** lets bright world elements (red barrier/boost flame) bleed through as a smear at its corner. *Evidence:* `critic9-item-shield.png`, `critic9-sr-race-3.png`.

### Info

- Intermittent synthetic-keydown misses observed (Enter/Q occasionally needed a second dispatch) — almost certainly a playwright-eval artifact, not a game bug; live-verified all actions work.
- 922 draw calls on NN is heavy for the art style — an instancing/merging opportunity if lower-end hardware matters.

## What holds up

- **GP mode end-to-end**: leg scoring, running totals, FINAL STANDINGS with ★ champion, `[N]`/`[Q]`/`[R]` affordances, title re-arm to leg 1 on PG.
- **Options**: modal pause in any play phase, live volume/difficulty, full key-remap with capture prompt, RESET BINDINGS, persistence across reload.
- **Recovery UX**: STUCK? hint + Backspace respawn works reliably; WRONG WAY fires correctly on a real backward drive; pause-in-countdown freezes cleanly; item use is inert while paused.
- **Perf**: 68 fps, flat 15–16 ms frame pacing, no jank, 0 console errors/warnings.
- **NN night dressing** is genuinely pretty — neon rails, glow gates, holo columns, LED billboards, runway studs.
- **Reduced motion (M)** kills the chromatic edge cleanly.

## Evidence

`docs/gauntlet/evidence/wave7/critic9-*.png` — 67 files: title orbits ×3 tracks, race coverage ×3 tracks + GP legs, countdown, pause, options (rebind/reset), wrong-way, stuck, ink, swap, shield, results/standings, reduced-motion.
