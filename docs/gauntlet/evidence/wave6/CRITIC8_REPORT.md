# Critic 8 — Wave-6 Visual Production Pass Review

Commit `3bd0a41`. Reviewed live at `http://localhost:5173` (dev server) via
playwright-cli + `__gauntlet/autopilot.js` across all 3 tracks, plus a full
3-leg Grand Prix. Screenshots: `docs/gauntlet/evidence/wave6/critic8-*.png`.

## Overall score: 7/10

The wave-6 pass is a genuine visual upgrade — themed skies (sunset Switchback
is gorgeous), real grandstand/crowd/billboards/balloons/flags, textured road,
ACES + shadow-mapped lighting, and a real particle system. Racing on Proving
Grounds and Neon Night looks like a kart game now, not a tech demo. BUT two
recurring artifacts drag it down: **billboard/chevron backs render as giant
featureless black monoliths** (visible constantly — the track loops so you
always see backs), and the **title/countdown orbit camera clips through the
start gantry every ~11 s** on every track. Add one AI that routinely beaches
for 2+ min/lap and a tree growing through the grandstand, and it's a solid
but not clean pass.

## Verdict per area

| Area | Verdict |
|---|---|
| Visual quality @ speed — Proving Grounds | Good, minus billboard backs + occasional corner clutter |
| Visual quality @ speed — Switchback Ridge | Good (best sky), minus title occlusion + back-faces |
| Visual quality @ speed — Neon Night | Good — mood, neon trim, kart readable (rim-lit) |
| Particles | Works — sparks/smoke/stars/dust/explosion render, capped pools, no leak, no fps hit |
| Items | Works — boxes/slick/shield/pads/missile all function; box glow + pad pulse visible |
| Readability | Pass — dashes, HUD, minimap, item boxes, ink overlay all read on every sky |
| Regressions | Mostly pass — full GP completes, wrong-way + respawn + records work; AI stragglers flagged |
| Console | Clean — zero errors/warnings (only vite debug) |
| Perf | Pass — 68 fps avg, p95 15.2 ms (786 draw calls — watch on weak GPUs) |

## Defects

| # | Sev | Defect | Repro | Evidence |
|---|---|---|---|---|
| 1 | **HIGH** | **Billboard backs = black monoliths.** `frame` box (7.2×3.4, 0x222833) + art plane on front only → from behind/side a solid black slab floats on a post; fills whole screen quadrant at close range. `Track.ts:1005-1014` | Drive any track; billboards at fractions .12-.95 — you see backs constantly since the course loops | `critic8-t0-stars-d.png` (fills top-right ¼ of frame), `critic8-t0-wrongway-hud.png` (2 at once), `critic8-t0-race2.png`, `critic8-t0-missile-b.png`, `critic8-gp-start.png` |
| 2 | **HIGH** | **Title/countdown orbit clips the start gantry.** Orbit r=8.5 m @ h=2.6 around the grid kart (`ChaseCamera.ts:44-46`); gantry posts at ±7.2 m lateral (hw6+1.2) with kart spawned off-center → camera passes through/beside post+beam+orange banner; top of frame eaten every ~11 s orbit on every track. Prior look-target fix didn't fix the camera-body intersection | Title screen — just wait | `critic8-title-track0.png`, `critic8-title-nosprites.png`, `critic8-gp-start.png`, `critic8-t1-title4.png` |
| 3 | **MED** | **Title orbit occluded by scenery on Switchback.** Tan rocks (theme.rock 0x9a8570, placed 10-34 m from centre) pile into the near-start camera path → bottom ~40 % of frame buried behind boulders for part of the orbit | Title on Switchback Ridge | `critic8-title-track1.png`, `critic8-t1-title2.png` |
| 4 | **MED** | **Trees clip through the grandstand.** Random pines (hw+3..hw+33) grow through the stand's steps/roof at hw+20 — canopies stab through the red roof and crowd planes | Drive past start on any track, look at the stand | `critic8-t0-wrongway-hud.png` (2 trees through stand), `critic8-t1-title4.png` (canopy through roof), `critic8-t0-missile-d.png` |
| 5 | **MED** | **AI stragglers / pace imbalance.** Every GP leg had ≥1 AI unfinished at player-finish; BOT-C logged 2:15.95 & 2:30.24 best-laps (beached most of the leg) and never set a lap in leg 3. Neon Night: AI best 0:54–1:11 vs player 0:21. They do finish eventually (final standings wait) — but the field is effectively thin | Run a GP, watch results each leg | `critic8-gp-leg1-end.png`, `critic8-gp-leg2-end.png`, `critic8-gp-leg3b.png` |
| 6 | **LOW-MED** | **Chevron boards read as floating shards off-axis.** Dark backing + arrow front-only → from behind/side they're floating black/yellow shards; at night backing vanishes leaving amber rectangles | Look at corner boards from reverse angles / at night | `critic8-t0-drift.png` (big black shard), `critic8-t2-race1.png`, `critic8-t2-race2.png`, `critic8-t0-race3.png` |
| 7 | **LOW-MED** | **Kart can beach permanently nose-into-wall; no steering at 0 speed.** Wall-pinned kart can't rotate (speedFactor=0 at 0 m/s) — only S-reverse or ⌫ frees it; autopilot wedged it 90+ s at one corner. Partly by design (STUCK hint fires correctly) but a real frustration path | Wall-grind into a barrier at a shallow angle | `critic8-t0-stars-c.png`, `critic8-t0-boost.png`, `critic8-t0-drift.png` |
| 8 | **LOW** | **Title text overlaps the kart.** "a grok bots racing game" subtitle + "PRESS ENTER" render over the kart body — subtitle nearly illegible | Title screen, kart-centred orbit | `critic8-t1-title3.png`, `critic8-title-track0.png` |
| 9 | **LOW** | **Boards/billboards float on elevation.** Boards at wallHeight+0.75 over local road height appear to float ~4 m up on steep/elevated sections | Elevated sections of Switchback / Proving Grounds | `critic8-t0-missile-d.png` (top-centre board) |
| 10 | **LOW** | **Grass texture tiling repeat** visible in far field (subtle grid) | Any track, look at open grass | `critic8-gp-leg1.png` |

## What holds up

- **Skies** — gradient dome + drifting clouds + silhouette mountains + stars:
  sunset Switchback and starry Neon are genuinely attractive; no popping/clipping seen.
- **Particles** — shared instanced pools: drift sparks (grey→orange→blue tiers),
  boost flame trail, tire smoke, splat, spin stars (verified orbiting),
  explosion, confetti. All render correctly; pools are capped ring buffers
  (dead → y-500, alpha 0) so no leak; zero fps impact.
- **Items** — cyan pickup boxes glow/bob/read at range; yellow slick disc reads
  as hazard; shield bubble is a clear translucent dome; boost pads pulse;
  missiles fire + trail (code path verified; visual capture elusive at 34 m/s).
- **Ink overlay** — DOM radial-blob splat — confirmed working in-race (3×).
- **Readability** — centreline dashes, HUD, minimap, item boxes, results all
  legible on all 3 skies; kart rim-lit readable on Neon Night.
- **GP** — full 3-leg cup completes: leg results → [N] next → FINAL STANDINGS;
  points accumulate correctly and wait for AI finishers.
- **Wrong-way** — detection + "WRONG WAY" HUD warning confirmed live.
- **Respawn** — ⌫ drops kart on centreline; STUCK hint correctly offers it.
- **Records** — ★REC marker + "NEW LAP RECORD!" banner confirmed.
- **Menus** — PAUSED + full options (vol/music/difficulty/motion/minimap/keys) clean.
- **Console** — ZERO errors/warnings across the whole session.
- **Perf** — 68 fps avg, p50 14.6 / p95 15.2 / p99 15.6 ms — under 16.6 ms
  during a busy race with ink + particles. Note: 786 draw calls is high —
  fine here, a risk on weaker GPUs.

## Evidence list

`critic8-title-track0.png` (gantry clip, billboard backs), `critic8-title-nosprites.png` (gantry structure isolated), `critic8-t0-race1/2.png`, `critic8-t0-race3.png`, `critic8-t0-results.png`, `critic8-title-track1.png` (rock occlusion), `critic8-t1-title2/3/4.png` (rock mounds, tree-through-stand, gantry clip, kart grid), `critic8-t1-race1.png` (ink overlay live), `critic8-t1-discs2.png`, `critic8-t1-race2.png`, `critic8-title-track2.png` (Neon title), `critic8-t2-race1/2/3.png`, `critic8-t2-stuck.png`, `critic8-t2-missile*.png`, `critic8-t0-missile*.png` (shield-bubble AI, floating board), `critic8-t0-slick.png`, `critic8-t0-spin*.png`, `critic8-t0-stars-*.png` (spin stars confirmed), `critic8-t0-boost*.png`, `critic8-t0-ww-setup.png`, `critic8-t0-ww3.png`, `critic8-t0-wrongway-hud.png` (wrong-way + tree-through-stand + billboard backs), `critic8-t0-ww-flag.png`, `critic8-t0-gravel*.png`, `critic8-t0-dust*.png`, `critic8-t0-drift.png` (chevron shard), `critic8-t0-explosion.png`, `critic8-pause.png`, `critic8-options.png`, `critic8-gp-start.png`, `critic8-gp-leg1.png`, `critic8-gp-leg1-end.png`, `critic8-gp-leg2.png`, `critic8-gp-leg2b.png` (ink again), `critic8-gp-leg2-end.png`, `critic8-gp-leg3.png`, `critic8-gp-leg3b.png` (leg3 results), `critic8-gp-final.png` (FINAL STANDINGS).
