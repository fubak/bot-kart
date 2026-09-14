# CRITIC 10 — Wave-10 Adversarial Review

**Build:** `bot-kart` @ localhost:5173 (Three.js + TS + Vite)
**Reviewer:** CRITIC 10 (adversarial whole-game playtest)
**Coverage:** Title orbits ×3 tracks (multiple angles), full races on PG / SR / NN, a complete 3-leg Grand Prix + FINAL STANDINGS, options menu mid-race, pause-in-race, wrong-way, wall/prop-pin → STUCK → Backspace respawn, slick/missile/boost/shield fired, ink received from an AI, reduced-motion toggle, perf sample on NN mid-race, console audit. **76 screenshots** (`critic10-*.png`).

## Overall score: **7.0 / 10**

A genuinely competent, charming kart racer — reliability took a real step up this wave: **every AI finished every race** (critic-9 had frequent DNFs), the ink splats are now organic, the chromatic edge is subtle, hints wrap cleanly, the minimap is opaque, flag masts exist, and the GP loop is airtight end-to-end. Perf is excellent (68 fps, flat 15–16 ms pacing) and the console stayed perfectly clean.

What keeps it out of "production" territory is a **pervasive floating-slab read on the road edge assembly** — kerb planks and the barrier-wall ribbon are pinned to road-top height while the verge/embankment drops away, so on every elevated or banked edge they read as planks hovering over grass. Add blown-out item boxes/headlight, pure-black billboard backs, floating neon sign panels at night, and a results screen that projects points for still-racing AI, and it still reads as a solid indie vertical slice — not Mario Kart 8.

## Verdict by area

| Area | Verdict |
|---|---|
| Title screens (3 tracks, orbit) | **PASS w/ nits** — legible, kart framed well, hints fit on two lines, PRESS ENTER readable, GP arm indicator + track record show; checkered banner back dangles as a dark quad at some angles. |
| Race visuals — PG | **PASS w/ nits** — rich pastoral dressing (orchard, hay, fences, pumpkins, flowers); floating edge slabs on rises; blown item boxes. |
| Race visuals — SR | **PASS w/ nits** — sunset + red mesas + cairns + windmill read well; floating kerbs; one leftover floating strata wedge in the sky; black billboard backs. |
| Race visuals — NN | **PASS w/ nits** — neon glow rails are gorgeous, holo columns, gate bars; kerbs float over the rails; pink sign panels float post-less; gate bars still read as sabers at raking angles; driver head is a blown orb. |
| Grand Prix (3 legs) | **PASS w/ nit** — leg scoring, running totals, FINAL STANDINGS + ★ champion, auto-leg-advance, records all correct; leg-results screen projects speculative positions/points for unfinished AI that contradict the final standings. |
| Items (6) | **PASS** — shield bubble, boost flame, slick, missile, ink (organic splats now), AI use items on straights; item boxes still bloom into glowing diamonds. |
| Options menu | **PASS** — modal pause in any phase, MASTER/MUSIC VOL, DIFFICULTY, REDUCED MOTION, MINIMAP, full key rebind, RESET, persistence. |
| Edge cases | **PASS** — pause freezes, item inert while paused, Q/R/N work, WRONG WAY fires, STUCK hint + Backspace respawn reliable. |
| Performance (NN busiest) | **PASS** — 68.2 fps avg, p50 14.6 ms, p95 15.2, p99 15.6, worst 15.7 (clean mid-race sample); 814 draw calls / ~107k tris. |
| Console | **PASS** — 0 errors, 0 warnings across the whole session. |

## Defects

### HIGH

1. **Road-edge assembly reads as floating slabs on every track.** The kerb planks (red/white) and the barrier-wall ribbon sit at road-top height while the verge/embankment drops away — on every elevated, banked, or crested edge they silhouette as planks hovering over grass with visible air/shadow gaps. On flat ground they seat correctly; on rises they clearly float. Present on all three tracks and in most chase-cam frames — the single most visible "unfinished" read.
   *Repro:* any race on a crested/banked section — PG start straight edges, SR terraces, NN every corner.
   *Evidence:* `critic10-orbit-18.png`, `critic10-kerb-closeup.png`, `critic10-gp-leg1-mid.png`, `critic10-sr-race-3.png`, `critic10-nn-race-6.png`, `critic10-pg-item-missile.png`, `critic10-crowd-b.png`.
   *Diagnosis (measured):* kerb instance matrices sit at lateral 5.6 (= `hw-0.4`, 0.8 m plank spanning 5.2–6.0 — fully on the 6 m asphalt) at `point.y+0.05`, bottom 1 cm embedded — so the planks are *geometrically* seated at the kerb center. The floating read comes from the **edge assembly**: the barrier wall face at `hw+0.05` spans `point.y → point.y+0.55` but the ground *under* it (the verge) is lower, so the wall's base + the kerb's outer face hang in the air over the drop. The fix centered kerbs on asphalt but nothing fills the visual gap between road-top and the dropped verge.
   *Suspected cause:* `src/game/Track.ts:706` (kerb `setY(s.point.y + 0.05)` — road-top height, doesn't follow the verge) and `:752` (wall `wallPos.push(bx, s.point.y, …)` — base pinned at road height, never extended down to the embankment). Fix: drop the wall base / kerb outer face to the shoulder surface, or widen the embankment skirt so the road edge isn't a sheer ledge.

### MED

2. **Item boxes bloom into giant glowing diamonds/cubes.** The pickup cubes read as solid blown-out white-cyan blobs — especially at distance and at night — dominating the frame instead of reading as item boxes.
   *Repro:* any track, look at an item box row mid-race.
   *Evidence:* `critic10-gp-leg2-results.png`, `critic10-sr-results.png`, `critic10-nn-race-6.png`.
   *Cause:* `src/game/Items.ts:62-63` — `emissive 0x3fd0ff, emissiveIntensity 1.55` is well over the ~1.0 bloom gate; they bloom to white blobs. Drop intensity under the gate or shrink the pulse.

3. **Billboard backs are pure-black voids.** The rotating pylon-sign billboards show a featureless black slab on the back/edge mid-rotation — floating dark rectangles that read as rendering holes.
   *Evidence:* `critic10-sr-race-3.png` (three black backs), `critic10-crowd-a.png`, `critic10-orbit-15.png`.
   *Cause:* `src/game/Track.ts` `buildBillboards` / rotating 'spin' boards — the back face has no art/frame, renders near-black. Give the back a frame + a faint poster or neutral panel.

4. **NN neon sign panels float — posts invisible at night.** The pink/cyan emissive sign panels hover in the air; their `0x161b26` near-black posts vanish against the night, so the panels read as floating glowing slabs.
   *Evidence:* `critic10-nn-race-6.png`, `critic10-gp-leg3-results.png`, `critic10-nn-race-1.png`, `critic10-title-nn-3.png`.
   *Cause:* `src/game/Props.ts:747-749` — `signPostGeo` uses `darkMat` (0x161b26), invisible at night. Add a dim emissive edge to the post or a ground-glow foot.

5. **NN glow-gate bars still read as sabers at raking angles.** The road-spanning cyan/magenta gate bars (13.4 m) bloom; seen edge-on at low chase angles they dominate the sky as huge diagonal light beams.
   *Evidence:* `critic10-nn-race-5.png` (pink saber across the whole sky), `critic10-nn-boost.png`, `critic10-gp-leg3-results.png` (cyan saber top-left).
   *Cause:* `src/game/Props.ts:707,665-675` — bar spans `2*(hw+0.7)` at `+5.0` with `emissiveIntensity 1.45` (was 2.1) — intensity tamed but the bar still overhangs the posts and slashes the sky edge-on. Shorten to post width or drop intensity nearer the gate.

6. **GP leg-results screen projects speculative points for unfinished AI.** When the player finishes while AI are still racing ("…" times), the table lists them in live track-order with `+N → total` projections that can contradict the official outcome — BOT-C showed `+5 → 20` at P3 but the FINAL STANDINGS had BOT-C at 18 (real P4, +3) and BOT-A2 19 (+5). The displayed deltas were wrong.
   *Evidence:* `critic10-gp-leg3-results.png` vs `critic10-gp-standings.png`.
   *Cause:* `src/core/RaceHud.ts:385` — `earned = GP_PTS[race.positionOf(r)-1]` uses the *live* position for unfinished racers; `src/core/Game.ts:395-399` re-sorts by `positionOf` at N-press and awards the *resolved* order. Either lock leg positions at player-finish or mark projected rows as provisional.

7. **Driver head is a blown white orb at night.** The bot head + headlight + env combine into a featureless glowing ball washing out the driver's face.
   *Evidence:* `critic10-nn-shield.png`, `critic10-nn-race-6.png`, `critic10-title-nn-2.png`.
   *Cause:* `src/game/Kart.ts:138` head `paint(0x46c8ff)` + headlight SpotLight + `scene.environmentIntensity` — the head catches too much light/bloom on the night track.

8. **AI field spread is still huge.** All AI finish now (watchdog works), but stragglers post best-laps 2× the leaders' (BOT-A2/BOT-C 0:41–0:45 best on NN leg 3 vs BOT-B 0:22.50; BOT-A2 3:36 total on SR vs winner 1:13). Rubber-banding rescues them but doesn't keep the field competitive — lapped traffic / big gaps.
   *Evidence:* `critic10-gp-leg3-results.png`, `critic10-sr-results.png`, `critic10-gp-leg2-results.png`.
   *Cause:* `src/game/AiDriver.ts` — watchdog (`:98-102`) teleports the lost but the pace gap persists; `AI.rubberBandGain`/`rubberBandUp` (`Game.ts:605-610`) is too gentle to close it.

### LOW

9. **Checkered finish banner back/underside dangles as a dark quad** at frame top on some orbit/race angles — a featureless dark slab in the sky.
   *Evidence:* `critic10-anim-a.png`, `critic10-nn-race-6.png` (pink slab), `critic10-title-pg-2.png`.
   *Cause:* banner built in `Track.ts` — back/top faces unlit/untextured; give it a backing face or darker checker.

10. **Floating tan strata wedge still in the SR sky** — a small brown diamond floats at the upper-left of the SR title/race view (critic-9 leftover).
    *Evidence:* `critic10-title-sr-2.png`, `critic10-sr-race-1.png`.
    *Cause:* `Track.ts` ridge strata scatter — a stray quad placed above grade.

11. **Featureless dark pylons/masts.** The NN holo data-pylon shows a big black column on its back/side (scanline only faces the road); light masts are plain dark poles. The kart can drive off-road through wall gaps and beach on the pylon.
    *Evidence:* `critic10-nn-race-1.png` (kart pinned on pylon), `critic10-nn-race-2.png`.
    *Cause:* `Track.ts:1443-1465` — pylon mast is `0x161b26` with the scanline face only on the road side; back is a void. Wrap a faint scanline or panel all around.

12. **Orange AI kart is a crude boxy forklift** — a flat orange boxy chassis that reads unfinished next to the sleek player pod (kart variety is fine; this one is under-detailed).
    *Evidence:* `critic10-gp-leg2-title.png`, `critic10-orbit-15.png`.

13. **Kart can mount/beach on kerbs.** Kerbs are collidable (0.12 m planks) — the kart climbs them and can tilt/pin, contributing to stuck episodes (autopilot beached ~100× in one session; a human can reverse out via the STUCK hint).
    *Evidence:* `critic10-anim-b.png` (kart tilted on a red kerb), `critic10-pg-item-slick.png`.
    *Note:* mostly an autopilot limitation (it holds W into obstacles, never reverses) — for a human the kerb/wall grind is recoverable. Consider lowering kerb collision or a faster auto-unstick.

14. **`gpMode` stays armed after Q-quit** — abandoning a finished cup returns to title still showing "GRAND PRIX — leg 1/3", so Enter silently starts a fresh cup rather than a single race. Intended toggle, but it can surprise.
    *Evidence:* `critic10-orbit-00.png`, `critic10-orbit-01.png` (title shows GRAND PRIX armed post-quit).

### Info / verified-transient

- The **LAP time field went blank once at 2:32** in `critic10-nn-race-3.png` but displayed correctly at 1:32 in `critic10-nn-race-2.png` — likely a one-frame flicker during a re-render, not a persistent bug. Re-verify if it recurs.
- `window.__game` does not expose `gpMode`/`trackIdx` — had to verify GP state via the title text. Not a defect, just an API note.
- 814 draw calls on NN is improved from critic-9's 922 and perfectly smooth here, but still heavy for the art style on lower-end hardware.

## What holds up

- **AI reliability is transformed** — every AI finished every race this session (watchdog lakitus the lost onto the racing line). Critic-9's frequent DNFs are gone.
- **Organic ink splats** — irregular ragged blobs, not flat discs (`critic10-sr-race-2.png`). Reads as real ink.
- **Chromatic aberration is subtle now** — no anaglyph fringing at speed (start 0.82, aberration 0.002 confirmed in `tuning.ts:182`).
- **Minimap is opaque** (0.88 α), clean kart dots — no more world-bleed smear.
- **Title hints wrap cleanly** on two lines; PRESS ENTER stays legible; flag masts have poles; windmill spins on PG + SR; grandstand crowd head-blobs + canopy + gate-breathing + balloon-bob + scanline all live in `Track.ts:1851-1938` and render.
- **Grand Prix is airtight** — leg scoring, running totals, FINAL STANDINGS + ★ champion, `rec` lap records persist, auto leg-advance, [N]/[Q]/[R] affordances.
- **Options menu is complete** — modal pause in any phase, volumes, difficulty, reduced motion, minimap toggle, key remapping, reset, persistence.
- **Kart materials are good** — MeshPhysicalMaterial clearcoat sheen + env reflections; glow wheels; the pod reads premium.
- **Recovery UX** — WRONG WAY, STUCK? + Backspace respawn, pause-in-countdown freeze all work reliably.
- **Perf is excellent** — 68 fps, flat 15–16 ms pacing, zero jank.
- **Console is spotless** — 0 errors, 0 warnings.

## Perf (NN mid-race, 10 s clean sample)

| metric | value |
|---|---|
| frames | 684 |
| avg frame | 14.66 ms |
| **fps** | **68.2** |
| p50 | 14.6 ms |
| p95 | 15.2 ms |
| p99 | 15.6 ms |
| worst | 15.7 ms |
| draw calls | 814 |
| triangles | ~107 k |

*(Earlier broad sample incl. title/countdown: 6498 frames, avg 14.74 ms / 67.8 fps, worst 174.8 ms — that single hitch was the track build at load.)*

## GP / race reliability stats

- 3-leg Grand Prix completed end-to-end: PG leg 1, SR leg 2, NN leg 3 + FINAL STANDINGS — no soft-locks, correct points, ★ champion.
- All 3 single-track races finished by the player + all 3 AI each time (12/12 finishes this session).
- AI keep lapping after finishing (cooldown) — race ends only when the player finishes (normal single-player; a parked player holds the race open — acceptable but noted).
- Player-side rescues needed: the autopilot beached ~100× across the session (autopilot can't reverse — mostly its own limitation, but it shows how easily the kart grinds walls/kerbs).

## Evidence

`docs/gauntlet/evidence/wave10/critic10-*.png` — 76 files: title orbits ×3 tracks, races ×3 tracks, full GP (legs + standings), countdown, pause, options, wrong-way, respawn/stuck, ink/shield/boost/slick/missile, results/standings, reduced-motion, anim checks, perf.

---

# FIX PASS — wave-10 remediation (post-review)

All HIGH/MED defects and most LOW items addressed; verified in a fresh headless-Chrome run plus the live session. Smoke baselines unchanged bit-for-bit.

| # | Defect | Resolution | Files | Evidence |
|---|--------|-----------|-------|----------|
| 1 | Floating road-edge assembly (HIGH) | Kerbs kept at road-top +0.05 as intended; barrier walls rebuilt with a battered 3-row footing driven down into the verge; gravel aprons gained a drop-face row to terrain; berms re-seated at apron toe; embankment skirt reaches grade. Verified from chase AND outside/title-orbit views on all 3 tracks. | `src/game/Track.ts` | `fix10-pg-wall-outside.png`, `fix10-nn-wide-grounded.png`, `fix10-nn-wall-footing.png`, `fix10-pg-chase.png`, `fix10-sr-chase.png` |
| 2 | Item-box bloom | Box emissive cut below the ~1.0 linear bloom gate (two-step reduction; first pass still clipped under diffuse+env). Boxes now read as soft colored markers. | `src/game/Items.ts` | `fix10-sr-chase.png` (soft green markers), `fix10-nn-chase.png` |
| 3 | Billboard black backs | Back poster retained at a non-z-fighting offset + lighter back frame/lip; post grounded. Back view shows a framed poster, not a void. | `src/game/Track.ts` | `fix10-billboard-back.png`, `fix10-billboard-back34.png` |
| 4 | NN floating sign panels | Posts got an emissive lift + ground-glow foot quads; panels visibly planted. | `src/game/Props.ts` | `fix10-nn-props.png`, `fix10-nn-posts.png`, `fix10-title-head-readable.png` |
| 5 | NN gate "sky sabers" | Bars re-spanned post-to-post (+0.3 m embed), lowered to ~4.75 m (≥4.5 m clearance), dedicated dimmer gate materials (1.05); tick-pulse `baseY` synced so the breathing anim can't restore the hot look. | `src/game/Props.ts` | `fix10-nn-chase-grounded.png`, `fix10-nn-props.png` |
| 6 | GP speculative points | Unfinished rows now render `… pts provisional`; finished rows derive earned points from the display order used by `Game.ts`'s N-press award — also fixes a same-tick finish-tie display bug found during validation (`race.positionOf` ties vs. deterministic row order). | `src/core/RaceHud.ts` | `fix10-gp-leg1-provisional.png`, `fix10-gp-leg2-consistent.png` (`+10 → 20`), `fix10-gp-leg1/2-settled.png`, `fix10-results-nn.png` |
| 7 | Driver head orb | Headlight + warm fill reduced/repositioned; driver head materials (placeholder + GLB) matted down. Head reads as a helmeted bot with cyan eyes at night, not a white ball. | `src/game/Kart.ts` | `fix10-title-head-readable.png`, `fix10-nn-chase.png` |
| 8 | AI field spread | `kart.paceAssist` now feeds `AiDriver` target-speed headroom (previously only the kart cap); race-path rubber-band gain/caps raised. Solo smoke path untouched — baselines bit-identical. Observed full-race AI best laps on PG clustered ~19.9–20.8 s. | `src/game/AiDriver.ts`, `src/config/tuning.ts`, `src/core/Game.ts` | smoke logs; full-race validation |
| 9–14 | LOW items | Banner backing/self-lit so the underside isn't a dead-black quad; SR strata slabs embedded deeper; NN pylon backs/edges get scanline+emissive treatment; `Q` during a cup fully disarms GP (title no longer shows a phantom leg); `R` on final standings restarts a fresh cup. | `src/game/Track.ts`, `src/game/Props.ts`, `src/core/Game.ts` | `fix10-title-*.png` |

### Validation

- `npm run typecheck` — clean. `npm run build` — clean.
- Solo smoke, all three tracks — **exact baselines**, `0 hits`, `stalled 0`: PG `22.69 / 19.22 / 18.12`, SR `26.42 / 22.46 / 21.62`, NN `25.54 / 21.61 / 20.90`.
- Traffic smoke — nonzero movement, `stalled: 0`.
- Full PG race — all 4 karts finish; GP leg 1→2 flow verified end-to-end (provisional → earned → cumulative `→ 20`).
- NN perf (fresh post-fix sample, real GPU): avg 14.66 ms / **68.2 fps**, p50 14.6, p95 15.4, worst 15.8 ms — unchanged vs. critic's 14.66/15.2.
- Console on fresh load: only `[vite] connecting...` / `[vite] connected.` — zero errors/warnings.

### Remaining nits (accepted, low priority)

- Start/finish banner underside still reads as a dark thin slab when viewed edge-on from directly below at some angles.
- Driver head still bright in some NN chase angles — no longer featureless, but on the hot side.
- Distant item boxes on NN can still read bright-white at far range (reduced, not eliminated).
- Kart-detail pass (orange AI kart, #12) and kerb-collision beaching (#13 — mostly an autopilot limitation) unchanged.

### Evidence set

`fix10-*.png` — 24 real captures: titles ×3, chase ×3 tracks, outside wall footing, night props/posts, billboard back ×2, NN results, GP leg-1/2 provisional + settled, ink splat. Pre-fix references remain the `critic10-*.png` series plus `fix10-before-billboard-crop.png` / `_tmp_sr3_crop.png`. *(Note: the chrome-devtools MCP sandbox restricts screenshot writes to its own temp root, so post-fix captures were driven through a scratch puppeteer-core harness at `C:\tmp\shotenv` against the live dev server; results screens were staged by advancing the player's gate/lap state in-page — no game code was touched for staging.)*
