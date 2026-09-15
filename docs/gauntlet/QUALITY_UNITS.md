# Quality Units Registry

A **quality unit** is the smallest independently buildable, testable, and
critic-reviewable piece of the game. Builders implement units; Critics verify
them in the actual running game; the Coordinator sequences them into waves.

## Unit Template

```markdown
### <unit-id> — <name>

- **Domain:** <one of the domains below>
- **Status:** Planned | In Progress | Built | In Review | Accepted | Blocked
- **Builder:** <session/agent>
- **Critic:** <session/agent>
- **Dependencies:** <unit-ids>
- **Wave:** <n>
- **Spec:** <what "done" means, observable in-game>
- **Evidence:** <screenshots/clips/traces proving it>
- **Critic Result:** <score + notes>
- **Largest Gap:** <single most important remaining deficiency>
```

## Status Summary

| Unit | Name | Status | Score |
|---|---|---|---|
| CORE-001 | Runtime loop + render pipeline | Built | — |
| CORE-002 | Debug instrumentation + QA hooks | Built | — |
| MOVE-001 | Acceleration | Fixed → Re-review | — |
| MOVE-002 | Steering | Fixed → Re-review | — |
| MOVE-003 | Drift + mini-turbo | Fixed → Re-review | — |
| MOVE-004 | Wall collision response | Fixed → Re-review | — |
| CAM-001 | Chase camera | Fixed → Re-review | — |
| TRACK-001 | Test track (Proving Grounds) | Fixed → Re-review | — |
| MOVE-005 | Off-road terrain response | Planned | — |
| MOVE-006 | Jump + airborne + landing | Planned | — |
| MOVE-007 | Drift/boost feedback VFX | Built | — |
| RACE-001 | Checkpoints + lap counting | Built | — |
| RACE-002 | Race flow (countdown/finish) | Built | — |
| AI-001 | Opponent AI (racing line) | Built → Fixed | 5/10→fixes |
| AI-002 | AI traffic/overtake model | Built | — |
| HUD-001 | Race HUD (lap/position/time/item) | Built | — |
| HUD-002 | Results screen (finish table) | Built | — |
| AUDIO-001 | Procedural SFX (engine/skid/boost/impact/UI) | Built | — |
| ART-001 | Grok Bot A + Kart A (canonical assets) | Built | — |
| ART-002 | Grok Bot B/C rival assets | Built | — |
| TRACK-002 | Track readability pass 1 (scenery/dashes/gantry) | Built | — |
| TRACK-003 | Elevation (crest + ridge, embankments, airtime) | Built | — |
| TRACK-004 | Corner chevrons + boost pads (route decision) | Built | — |
| ITEM-001 | Item boxes + boost + homing missile | Built | — |

---

## Wave 1 — Technical Spine (built, awaiting critic)

### CORE-001 — Runtime loop + render pipeline

- **Domain:** Core architecture
- **Status:** Built
- **Builder:** Coordinator (primary session)
- **Dependencies:** none
- **Wave:** 1
- **Spec:** Fixed-timestep sim (120 Hz, accumulator, clamped deltas) decoupled
  from rendering; resize-safe renderer; `window.__game` exposes
  renderer/scene/kart/track/camera/sim-time for QA (ADR-003).
- **Evidence:** typecheck+build clean; live page eval reads sim state;
  `slice-*.png`
- **Critic Result:** —
- **Largest Gap:** —

### CORE-002 — Debug instrumentation + QA hooks

- **Domain:** Core architecture
- **Status:** Built
- **Builder:** Coordinator
- **Dependencies:** CORE-001
- **Wave:** 1
- **Spec:** Always-on dev overlay (fps, frame ms + worst, speed, drive state,
  draw calls, tris); backquote toggles; `window.__game` stable contract.
- **Evidence:** `slice-drive2.png` HUD reads live values
- **Critic Result:** —
- **Largest Gap:** —

### MOVE-001 — Acceleration

- **Domain:** Kart movement
- **Status:** Built
- **Builder:** Coordinator
- **Dependencies:** CORE-001
- **Wave:** 1
- **Spec:** Throttle accelerates to 28 m/s top speed; brake decelerates and
  reverses at stop; coast drag. Verified: 0→28 m/s, state transitions.
- **Evidence:** eval traces `0→28`, `slice-stuck.png` at 101 km/h
- **Critic Result:** FAIL flagged — drag applied *under* throttle reduced net
  accel to ~12 m/s². Fixed: drag is coast-only now.
- **Largest Gap:** acceleration curve is linear; no launch/shape.

### MOVE-002 — Steering

- **Domain:** Kart movement
- **Status:** Built
- **Builder:** Coordinator
- **Dependencies:** MOVE-001
- **Wave:** 1
- **Spec:** Speed-sensitive turn rate — none parked, full through mid speed,
  mild fade at top speed; reverses when reversing. Input is ramped (steer
  attack) so taps are gentle and holds reach full lock; front wheels + body
  yaw visualize it.
- **Evidence:** `slice-mid.png` kart turned right off line
- **Critic Result:** FAIL flagged — binary full-lock input read as twitchy.
  Fixed: `steerAttack`/`steerRelease` smoothing in `tuning.ts`.
- **Largest Gap:** ramp constants need live-play tuning against cornering.

### MOVE-003 — Drift + mini-turbo

- **Domain:** Drifting / Boosting
- **Status:** Built
- **Builder:** Coordinator
- **Dependencies:** MOVE-002
- **Wave:** 1
- **Spec:** Hold Shift+steer at speed → drift arcs through the corner:
  velocity follows 62% of yaw (driftVelFollow) so slip settles at a held
  ~28-31° (driftMaxSlip cap) instead of spinning out; drift scrub keeps
  ~83% of entry speed; charge accrues only while genuinely sliding at
  >12 m/s (donut exploit dead); enter/sustain floors 12/10 m/s. Release →
  0.7s/1.4s mini-turbo. Verified live: held drift slip −0.5, speed
  12.8→22.6 climbing, charge 0→1.18.
- **Evidence:** eval trace `["release+0.2",7.4,"boost",0.5]`; `slice-drift.png`
- **Critic Result:** FAIL flagged — boost hard-clamped 37→28 on expiry;
  body-yaw/slip not proportional; charge invisible to players.
  Fixed: boost bleed + proportional slip yaw. Charge still debug-HUD only.
- **Largest Gap:** no player-facing drift charge readout — needs MOVE-007 VFX
  or a HUD gauge; wall-scrape charge-loss edge case remains.

### MOVE-004 — Wall collision response

- **Domain:** Collision response
- **Status:** Built
- **Builder:** Coordinator
- **Dependencies:** MOVE-001, TRACK-001
- **Wave:** 1
- **Spec:** Kart clamps to road edge at the wall face (limit = halfWidth −
  kart half-width → kart edge visually touches the barrier). Contact is an
  episode: one-time impact penalty scaled by hit severity, NO backward
  rebound (kart stops, never ejects facing the wall); sustained grind has
  heavy scrub + a 70%-top-speed cap — grinding costs real pace.
  Verified live: approach impact 28.4→9.6 no rebound; grind bleeds speed.
- **Evidence:** `docs/gauntlet/evidence/wave1/wall-check.png`,
  `walls.png`, `spawn-check3.png`; eval traces
- **Critic Result:** FAIL flagged — invisible boundary + wall penalty
  re-fired every step (tar pit) + `lastWallHit` never consumed.
  Fixed: contact-episode model, visible barrier meshes, camera consumes hit.
- **Largest Gap:** nose-first wedge recovery still stiff; no impact audio/VFX.

### CAM-001 — Chase camera

- **Domain:** Camera
- **Status:** Built
- **Builder:** Coordinator
- **Dependencies:** CORE-001
- **Wave:** 1
- **Spec:** Exp-damped follow behind kart; velocity-lead on the follow
  target (speedLead 0.13) so the kart doesn't shrink at speed; look-ahead
  along heading; FOV 60→74° +8° boost; impact shake scaled by severity;
  countdown intro orbit. Frame-rate independent.
- **Evidence:** `intro-cam.png` — orbit countdown; `wall-check.png` chase.
- **Critic Result:** FAIL flagged — zero impact feedback + distance trim
  defeated by damping lag. Fixed: velocity lead + severity-scaled shake.
- **Largest Gap:** shake feel still coarse; no FOV landmark landmark.

### TRACK-001 — Test track (Proving Grounds)

- **Domain:** Track design
- **Status:** Built
- **Builder:** Coordinator
- **Dependencies:** CORE-001, ADR-002
- **Wave:** 1
- **Spec:** Closed Catmull-Rom circuit ~190×100 m (long straight, sweeper,
  S-curves, hairpin); 12 m road; red/white curbs; start stripe; continuous
  barrier walls outside curbs; centerline lookup for constraint + spawn.
  Fixed: true-left basis corrected; road winding now +Y (was back-face
  culled — road invisible, kart read as "on grass"); grass plane lowered to
  −0.1 to kill z-fighting.
- **Evidence:** `docs/gauntlet/evidence/wave1/spawn-check3.png`,
  `wall-check.png` — road, curbs, walls all readable
- **Critic Result:** FAIL flagged — wallHeight configured but no wall mesh.
  Fixed: paired inward-facing wall ribbons at ±(halfWidth+0.35).
- **Largest Gap:** flat, no elevation/jumps; placeholder visuals; walls are
  plain flat color.

---

## Wave 2 — Driving Quality (planned)

### MOVE-005 — Off-road terrain response

- **Domain:** Terrain response
- **Status:** Planned
- **Dependencies:** MOVE-001
- **Wave:** 2
- **Spec:** Grass slows kart (drag + capped speed) and reads differently —
  rumble, dust; road vs grass must be unambiguous from physics AND visuals.

### MOVE-006 — Jump + airborne + landing

- **Domain:** Jumping
- **Status:** Planned
- **Dependencies:** MOVE-001, TRACK (elevation)
- **Wave:** 2
- **Spec:** Elevation/ramps launch kart; air control limited; landing has
  squash + recovery. Needs track elevation support first.

### MOVE-007 — Drift/boost feedback VFX

- **Domain:** VFX
- **Status:** Built (pre-critic)
- **Builder:** Coordinator
- **Dependencies:** MOVE-003
- **Wave:** 1+
- **Spec:** Pooled additive particle system: drift sparks at rear wheels,
  grey→amber→cyan by charge tier (player-facing charge readout); boost
  exhaust flames; wall-grind chips. `src/game/KartVfx.ts`.
- **Evidence:** `docs/gauntlet/evidence/wave1/vfx-drift2.png` — cyan tier-2
  spark trail behind drifting kart
- **Largest Gap:** sparks are chunky squares; no tire smoke yet.

### RACE-001 — Checkpoints + lap counting

- **Domain:** Race rules
- **Status:** Built (verified live via teleport sweep)
- **Builder:** Coordinator
- **Dependencies:** TRACK-001
- **Wave:** 1+
- **Spec:** 8 ordered progress-index gates around the centerline; lap counts
  only after all gates; monotonic unwrapped progress can't skip at speed;
  wrong-way detection on sustained backward progress. `src/game/Race.ts`.
- **Evidence:** eval trace progressIdx 782→990 → wrap → lap 1→2→3 →
  'finished'; `race-finish.png` FINISH banner + lap times.
- **Largest Gap:** no position tracking vs rivals (needs AI); wrong-way is
  flag-only (no reset assist).

### RACE-002 — Race flow (countdown → finish)

- **Domain:** Starting/finish sequence
- **Status:** Built
- **Builder:** Coordinator
- **Dependencies:** RACE-001
- **Wave:** 1+
- **Spec:** 3-2-1-GO countdown (input locked), 3 laps, FINISH banner with
  times + [R] restart. RaceHud DOM overlay.
- **Evidence:** `race-countdown.png`, `race-finish.png` — LAP 1/3→3/3,
  TIME/LAST/BEST, finish banner.
- **Largest Gap:** no grid/rival start positions; finish is a banner, not a
  results screen.

### AI-001 — Opponent AI (racing line)

- **Domain:** AI racers
- **Status:** Built (needs critic)
- **Builder:** subagent + Coordinator integration
- **Dependencies:** MOVE-001, TRACK-001
- **Wave:** 2/3
- **Spec:** Bot follows centerline with lateral offsets, throttle/brake for
  curvature, simple drift on tight corners; collides + reacts.
- **Evidence:** `ai-field-01.png`; headless `__gauntlet/ai-smoke.ts` —
  2 laps/60s, best 21.0s, 8 low-speed wall grazes at corners 380/430/701,
  11% drift, avg 21.1 top 28.1 m/s, no wrong-way. Live: 3 AI on staggered
  grid, skills 0.92/1.0/1.08, lap 2 while player idles, HUD P4/4.
- **Largest Gap:** no kart-vs-kart collision (ghost racing); same Kart A
  visual for all rivals; corner grazes at idx 380/430/701.

### HUD-001 — Race HUD

- **Domain:** HUD
- **Status:** Built (needs rival position once AI lands)
- **Builder:** Coordinator
- **Dependencies:** RACE-001
- **Wave:** 1+
- **Spec:** Lap counter, race/lap/last/best times, countdown, wrong-way,
  finish banner — DOM overlay readable at speed. `src/core/RaceHud.ts`.
- **Evidence:** `race-countdown.png`, `race-finish.png`, `ai-field-01.png`
  (P4/4 position display live)
- **Largest Gap:** no minimap; styling is plain.

---

## Domains

Core architecture, Rendering, Kart movement, Acceleration, Steering, Grip,
Drifting, Boosting, Jumping, Collision response, Terrain response, Camera,
Race rules, Checkpoints, Lap logic, Starting sequence, Finish sequence,
AI racers, AI personality, Overtaking, Recovery, Track design, Track
readability, Track landmarks, Shortcuts, Characters, Karts, Character
animation, Kart animation, VFX, Lighting, Materials, Environment art, Items,
Item balancing, HUD, Menus, Transitions, Audio, Music, Input, Accessibility,
Performance, Loading, Automated QA, Visual regression, Whole-game cohesion.

### TRACK-003 — Elevation

- **Domain:** Track
- **Status:** Built
- **Evidence:** `elevation-01.png`, `elevation-crest.png`; ai-smoke 3×3 laps
  clean on elevated track; kart airtime via vy/gravity over crests.
- **Largest Gap:** no jump ramps/landing dust; slope feel could be tuned.

### ITEM-001 — Item boxes + boost + missile

- **Domain:** Items
- **Status:** Built
- **Evidence:** live pickup→BOOST[space]→boost verified; missile hits
  verified by critic (leader punished to 25% speed).
- **Largest Gap:** only 2 item kinds; no drop-behind items (banana/oil).

### AI-002 — Traffic/overtake model

- **Domain:** AI racers
- **Status:** Built
- **Evidence:** pair-lock 91%→1% of samples under 2.75m post-fix.
- **Largest Gap:** no defensive lines; no rubber-banding by design.

### TRACK-004 — Chevrons + boost pads

- **Domain:** Track
- **Status:** Built
- **Evidence:** `chevrons-crest.png`, `chevrons-hairpin.png`.
- **Largest Gap:** chevron arrow is a tilted quad, not a real arrow shape.

### HUD-002 — Results screen

- **Domain:** HUD
- **Status:** Integrated
- **Evidence:** `gauntlet-results.png` — live race, all 4 times correct order,
  late finishers update live (DNF-freeze fixed).
- **Largest Gap:** no podium ceremony/camera work; plain table.

### FLOW-001 — Title / pause / menu flow

- **Domain:** UX
- **Status:** Integrated
- **Evidence:** `title-screen.png`, `countdown.png` — title orbit holds until
  keypress (also unlocks audio), P/Esc pause freezes sim cleanly, R restarts
  into countdown.
- **Largest Gap:** no settings menu; options are key toggles only.

### HUD-003 — Minimap

- **Domain:** HUD
- **Status:** Integrated
- **Evidence:** `gauntlet-results.png` — track outline + 4 racer dots live.
- **Largest Gap:** no item/hazard icons; dots only.

### ITEM-002 — Drop hazard (slick) + spin-out

- **Domain:** Items
- **Status:** Integrated
- **Evidence:** live teleport test — slick consumed, spinUntil fired, kart
  recovered. Missiles now spin too (was velocity cut only).
- **Largest Gap:** 3 items total; genre standard is ~6 (shells, shield, etc).

### CHAR-001 — Driver expressiveness

- **Domain:** Characters
- **Status:** Built
- **Evidence:** code — idle bob, steer lean, eyes track slide, impact flinch.
- **Largest Gap:** cosmetic-only (rotation/bob); no skeletal animation or
  emotes. Bots don't celebrate/react to finish.

### A11Y-001 — Reduced motion

- **Domain:** Accessibility
- **Status:** Built
- **Evidence:** `M` key kills camera shake + speed-FOV kicks.
- **Largest Gap:** no remapping, colorblind mode, or subtitle option yet.

### ITEM-003 — Shield

- **Domain:** Items
- **Status:** Integrated
- **Evidence:** live probe — shield absorbed slick hit (spin=-1,
  shieldUntil consumed); unshielded control spun. Bubble renders
  translucent around kart (`wave4` bubble screenshot).
- **Largest Gap:** single-hit consume + 8s expiry only; no hold/trade
  decision like genre shields that toggle.

### TRACK-004b — Gravel shortcut (hairpin inside-cut)

- **Domain:** Track
- **Status:** Integrated
- **Evidence:** `wave3/gravel-shortcut*.png` — tan apron + dirt mounds;
  throttle-held probe settles exactly 15.0 m/s on gravel vs ~28 asphalt;
  minimap shows kart off the racing line.
- **Largest Gap:** single zone; a second cut or elevated bridge would
  deepen route choice.

### KART-002 — Distinct rival chassis (kart-b heavy, kart-c wedge)

- **Domain:** Karts/Characters
- **Status:** Integrated
- **Evidence:** Blender GLBs exported + validated (gltf-transform);
  live grid shot shows 4 distinct silhouettes (cream pods, gunmetal
  heavy w/ roll cage, violet wedge).
- **Largest Gap:** shared wheel semantics worked but kart-b/c had extra
  wheel_* sub-nodes — match pinned to exact names.

### META-001 — wallHitCount metric split

- **Domain:** QA/Harness
- **Status:** Integrated
- **Evidence:** post-shortcut smoke — 0 true wall hits all skills
  (landings reuse lastWallHit for thump/shake and were inflating the
  count); lap times identical to baseline → no AI regression.

### AI-004 — Rubber-band pacing

- **Domain:** AI
- **Status:** Integrated
- **Evidence:** live probe — leaders at -0.05 paceAssist while ahead of
  parked player; trailing path symmetric (clamp(gap*gain)). Headless
  smoke unchanged (Game-side assist only).
- **Largest Gap:** linear in score only — no item-weight rubber-banding
  (genre also weights item rolls by position).

### ITEM-004 — Ink (blooper)

- **Domain:** Items
- **Status:** Integrated
- **Evidence:** use() splatted all 3 leaders (inkedUntil=+4s); AI inked
  shortens lookahead + steering wander; player splat overlay verified
  (`wave4/ink-splat.png`); shield absorbs ink.
- **Largest Gap:** wasted when leading (genre-consistent); no projectile
  travel — instant splat.

### CHAR-002 — Finish celebration

- **Domain:** Characters
- **Status:** Integrated
- **Evidence:** driver.position.y oscillates 0.012→0.12 on finish
  (vs 0.022 idle bob) + arm-rock; fires alongside confetti per racer.

### ITEM-005 — Swap + position-weighted rolls

- **Domain:** Items
- **Status:** Integrated
- **Evidence:** live probe — swap exchanged positions/velocities/headings
  with the kart directly ahead (both moved exactly 5.0 m); roll() weights
  by race rank (leaders: boost/slick; trailers: missile/ink/swap).
- **Largest Gap:** swap teleports (no portal/VFX); rank weighting uses
  score only, not gap distance.

### TRACK-005 — Second gravel cut (crest left-hander)

- **Domain:** Track
- **Status:** Integrated
- **Evidence:** `surf=gravel` verified at lateral +7.2 (frac 0.365);
  `wave4/shortcut2-crest.png` — apron + berm + wall gap; smoke clean.
- **Largest Gap:** AI never routes onto aprons (line offsets max 3.5 m
  < zone edge) — shortcuts are player-only decisions for now.

### TRACK-006 — AI shortcut routing + zone-1 geometry fix

- **Domain:** Track/AI
- **Status:** Integrated
- **Evidence:** corner measured +1.79 rad LEFT — original zone was on the
  outside edge (a detour). Moved to inside (+1); Bot C (takesShortcuts)
  verified on `surf=gravel` at lat +6.0 through the apex, clean rejoin.
  `wave4/shortcut-inside.png`.
- **Largest Gap:** bot only brushes the apron apex — not a committed
  full-zone cut; approach-pull wedged on the wall face, so the pull only
  engages inside the zone.

### AI-005 — Anti-wedge recovery

- **Domain:** AI
- **Status:** Integrated
- **Evidence:** anchor-based wedge state (AiDriver): 0.5 s displacement
  sampling detects pins, then a wall-clock escape ladder — reverse-out
  0-3 s → forward-out 3-6 s → guaranteed lakitu respawn onto the
  racing line at 6 s. The anchor only clears on >2.5 m real escape, so
  reverse→re-wedge limit cycles can't reset it (critic6 D1). Live:
  nose-in pins on PG + SR hairpin escaped ~2 s. Spin-outs excluded via
  `kart.isSpinning`.
- **Largest Gap:** no path-replanning after respawn (kart resumes
  pursuit from the line); player still requires manual ⌫.

### UI-005 — Options menu

- **Domain:** UI/Audio
- **Status:** Integrated
- **Evidence:** `wave4/options.png` — O toggles an OPTIONS overlay in any
  phase (auto-pauses racing): master/music volume bars, reduced-motion
  and minimap toggles, arrow navigation/adjust. Verified: music vol
  raised to 9 live, chaseCam.reducedMotion flipped true.
- **Largest Gap:** no remappable keys; no persistence (settings reset
  on reload — localStorage would fix).

### TRACK-007 — Second track: Switchback Ridge

- **Domain:** Track
- **Status:** Integrated
- **Evidence:** `wave4/track2-title.png`, `wave4/track2-racing.png` —
  T cycles layouts on the title screen (name shown under PRESS ENTER);
  buildWorld disposes + rebuilds track/race/items/minimap, karts
  persist. AI lapped to 2 by ~30 s; both gravel zones probed to true
  inside edges (curvature-measured: switchback −0.51 rad right, ridge
  dive +0.76 rad left). Smoke baseline identical on track 1.
- **Largest Gap:** item boxes share placement fractions across layouts;
  scenery palette identical (no per-track theme yet).

### CHAR-003 — Driver limb emotes

- **Domain:** Characters
- **Status:** Integrated
- **Evidence:** seated-bot GLBs ship a full node rig (arms/legs/head);
  Kart caches arm_l/arm_r/head + base pose, applies additive deltas —
  victory arm-pump (arm_r −2.31 rad observed), spin flail, head-yaw-
  into-turn (−0.45 rad hard corner). `wave4/driver-emote.png`.
- **Largest Gap:** still transform-level (no skinned animation clips);
  legs/torso static; eyes don't blink.

### UI-006 — Item HUD iconography

- **Domain:** UI
- **Status:** Integrated
- **Evidence:** `wave4/item-icon.png` — held item renders colored glyph
  + name (⚡/✹/◍/◯/✦/⇄), dimmed [space] hint.
- **Largest Gap:** glyphs are unicode, not authored icons; no
  incoming-hazard indicator.

### TRACK-008 — Per-track theming

- **Domain:** Track/Visual identity
- **Status:** Integrated
- **Evidence:** `wave4/track2-theme.png` — TrackLayout gains optional
  `theme { sky, grass, skirt, canopy, trunk, rock }`; buildWorld recolors
  scene.background + fog. Switchback Ridge runs a golden-hour palette
  (peach sky, olive grass, dark pines, warm stone) vs Proving Grounds'
  blue day.
- **Largest Gap:** curbs/road/chevrons stay shared; lighting rig (sun
  angle, hemisphere colors) doesn't vary per theme yet.

### UI-007 — Settings persistence

- **Domain:** UI
- **Status:** Integrated
- **Evidence:** settings + last-played track persist to
  `grok-kart-settings` in localStorage; verified reload restored
  SWITCHBACK RIDGE and applies volumes/reduced-motion on boot.
- **Largest Gap:** no reset-to-defaults control in the menu.

### CHAR-004 — Eye blink + rank-aware celebration

- **Domain:** Characters
- **Status:** Integrated
- **Evidence:** `eye_l`/`eye_r` nodes cached at load; 120 ms blink squash
  every 2.5–5.5 s per bot (verified scale.y oscillating 0.05↔0.01 live).
  `kart.finishRank` set at finish — winner pumps arm high (−1.9 rad),
  other finishers do a half-amplitude hop with a forward head-nod.
- **Largest Gap:** blink is a uniform squash, no directional look; legs
  still unanimated.

### TRACK-009 — Third track: NEON NIGHT

- **Domain:** Track
- **Status:** Integrated
- **Evidence:** `wave4/track3-night.png` — flowing ~200×115 m speed
  circuit, night palette (navy sky, moonlit world, hemiIntensity 1.35).
  Curvature-verified gravel zones: left-drop cut at frac 0.53–0.58,
  dive-hairpin cut at 0.70–0.80 (both `gravel` at inside lateral ±7,
  `road` on the wrong side). AI laps at ~20 s pace — fastest of the
  three circuits, as designed.
- **Largest Gap:** kart headlights would sell the night further; neon
  accents (emissive signage) not yet placed.

### MODE-001 — Grand Prix cup

- **Domain:** Game modes
- **Status:** Integrated
- **Evidence:** `wave4/gp-title.png` (title shows GRAND PRIX — leg 1/3),
  `wave4/gp-standings.png` (FINAL STANDINGS ranked by cup points,
  champion starred). `G` toggles cup mode on title; `N` on results
  scores the leg (10/7/5/3 by position) and loads the next circuit with
  auto-countdown; leg 3 shows final standings. HUD shows `GP n/3`.
- **Largest Gap:** no cup-selection (fixed order); no difficulty setting;
  abandoning mid-cup discards standings silently.

### VFX-011 — Night headlights

- **Domain:** VFX/Track
- **Status:** Integrated
- **Evidence:** `wave4/night-headlights.png` — `theme.night` flag;
  emissive lamp quads on every kart's nose + a real SpotLight beam on
  the player's kart (one extra light, cheap). Night GO shot shows lamps
  on all 4 chassis + beam lighting the road ahead.
- **Largest Gap:** rival karts have lamps but no beams (perf budget);
  beam doesn't swing with steering yet (fixed to kart forward).

### UI-008 — Key remapping

- **Domain:** UI/Accessibility
- **Status:** Integrated
- **Evidence:** `wave4/options-rebind.png` — six bind rows (THROTTLE,
  BRAKE/REV, STEER L/R, DRIFT, ITEM) + RESET BINDINGS in the options
  menu, persisted to `grok-kart-bindings`. Capture armed via →/Enter/
  Space on a row; swallows all keys while armed (Esc cancels);
  meta/game-command codes rejected so a drive bind can't shadow
  pause/quit; duplicate binds displace to `—`. Bound keys count as
  race-start keys on title. Verified live: W→I survives reload, I
  starts + drives at 28 m/s, P rejected without pausing.
- **Largest Gap:** arrows/RSHIFT stay fixed alternates (no removal);
  gamepad binding is a later unit.

### UI-009 — Persisted lap records

- **Domain:** UI/Progression
- **Status:** Integrated
- **Evidence:** `wave4/lap-records-results.png` — per-track best-lap
  records persisted under `grok-kart-records` (`{trackIdx: s}`).
  Detection taps the post-`race.update` player lap-count delta, so
  only gate-validated player laps can set records (no AI laps, no
  teleports). Title shows `rec M:SS.ss` beside the track name,
  `★ NEW LAP RECORD!` toasts ~2.5 s on a record crossing, results
  star the player row `★REC`. Live-verified: seeded 999 s record
  loads + persists across reload; three laps rewrote it
  19.87→19.36→19.35; a ~140 s wall-pinned lap did NOT overwrite.
- **Largest Gap:** no records reset in options; no per-difficulty
  records; AI times aren't recorded (player-only by design).

### UI-010 — Gamepad support

- **Domain:** Input/Accessibility
- **Status:** Integrated
- **Evidence:** runtime-verified via mocked `navigator.getGamepads` —
  axes merge into `ControlState` (RT throttle, LT brake, left-stick
  steer with deadzone) and button edges dispatch through the same
  synthetic-key pipeline as the autopilot (A item/start, Start pause),
  so every action works without a parallel handler. Title hint shows
  a gamepad line when a pad is connected.
- **Largest Gap:** no pad remapping or analog-item binding; no
  vibration/rumble; verified only via mock (no physical pad on hand).

### ENV-003 — Sky system (wave 6)

- **Domain:** Track/VFX
- **Status:** Integrated
- **Evidence:** `wave6/vis-title.png`, `vis-title-sr.png`,
  `vis-title-nn.png` — `Sky.ts` gradient-dome shader (zenith→horizon,
  per-theme palette) + sun disc (day) / 800-star field (night), 14
  drifting cloud sprites (generated `cloud_sprite.png` luminance-alpha),
  two silhouette mountain rings with baked atmospheric fade (fog-proof).
- **Largest Gap:** clouds are single-sprite clones (no shape variety);
  no dynamic weather/time-of-day transitions.

### ENV-004 — Generated surface textures (wave 6)

- **Domain:** Track
- **Status:** Integrated
- **Evidence:** `wave6/vis-title.png`, `vis-title-sr.png` — grok-image
  tiles (`grass/asphalt/gravel` 512²) mapped onto ground plane, road
  ribbon (real UVs, ~6 m/tile), gravel aprons, embankment skirt;
  checker `start stripe`; procedural fallbacks keep the game working if
  a texture fails (`Textures.ts` loader).
- **Largest Gap:** tiles are shared across tracks (theme-tinted only);
  PNG not KTX2-compressed yet (~2.9 MB total runtime payload).

### ENV-005 — Production scenery (wave 6)

- **Domain:** Track
- **Status:** Integrated
- **Evidence:** `wave6/vis-title.png`, `vis-title-sr2.png`,
  `vis-title-nn.png` — grandstand (3 tiers + generated `crowd.png` faces
  + canopy, pushed 20 m off-road), 7 sponsor billboards cycling 3
  generated posters, tethered balloons, waving flags, accent top rail
  on walls, rock scatter, per-tree color variance.
- **Largest Gap:** scenery is identical per track (placement from
  centerline math only); no animated crowd; balloons are static bobs.

### VFX-001 — Shared particle system (wave 6)

- **Domain:** VFX
- **Status:** Integrated
- **Evidence:** `wave6/vis-fx-pools.png`, `vis-fx-burst.png` — `Fx.ts`
  two instanced billboard pools (additive sparks 512 + alpha smoke 384,
  generated `smoke_puff.png` luminance-alpha). Emitters: drift sparks
  (both rear wheels), boost flames, tire smoke, gravel dust, landing
  puffs, wall chips, spin stars, pickup sparkle, missile trail +
  explosion. Replaces per-kart `KartVfx` (single draw call per pool).
- **Largest Gap:** additive pool is a procedural glow texture (no
  generated art); no particle shadows or lit smoke.

### VFX-002 — Item visuals (wave 6)

- **Domain:** VFX/Items
- **Status:** Integrated
- **Evidence:** `wave6/vis-missile.png`, `vis-missile-trail.png` —
  missile rebuilt (body/nose/fins/glow-sprite + roll), trail + impact
  burst via `Fx`; item boxes bob+glow; slick dark disc; boost pads
  pulse; all pickups emit sparkles.
- **Largest Gap:** missile doesn't bank through turns; item box is
  still a flat quad (no 3D box mesh).

### LIGHT-001 — Renderer grading + shadows (wave 6)

- **Domain:** Core/Track
- **Status:** Integrated
- **Evidence:** `wave6/vis-race-final.png`, `vis-title-nn.png` — ACES
  tone mapping + sRGB output, PCF shadow-mapped sun (2048², ~90 m
  ortho box follows player), per-theme hemisphere/sun tint, kart
  castShadow on procedural + GLB meshes, track receives; night adds
  player fill light for readability. 68 fps @ ~600–790 draws.
- **Largest Gap:** shadow box only follows the player (rivals off-box
  lose shadows); no cascade, distant scenery unshadowed.

### POST-001 — Post-processing pipeline (wave 7)

- **Domain:** Core/Render
- **Status:** Integrated (3417943)
- **Evidence:** `wave7/post-*.png` — EffectComposer chain: MSAA HDR
  render target → UnrealBloomPass → OutputPass (ACES/sRGB) → grade
  pass (vignette, saturation/contrast, speed-gated chromatic edge,
  eased; gated on reducedMotion). Sky silhouette colors
  grade-compensated (partial, not squared) so mountains seat as soft
  horizon shapes.
- **Verified:** NN bloom on pylons/rails/chevrons; PG 68.1 fps p95
  15.7 ms; smoke baselines identical ×3.
- **Largest Gap:** single bloom pass (no mip chain tuning); grade
  params fixed per-build not per-track.

### DRESS-001 — Set-dressing density (wave 7)

- **Domain:** Track/Props
- **Status:** Integrated (b981dea)
- **Evidence:** `wave7/dress-*.png` — per-theme prop vocabulary
  ~2.2–3.2× denser: PG orchard/hay/fence/shrubs, SR strata outcrops +
  cairns + arch, NN pylons/gates/signage. ScatterCtx nearest-leg
  clearance (folded-layout safe). Only ~+10–20 draws.
- **Verified live:** all 3 tracks; SR dark-blob regression caught +
  fixed before accept (instance tint × material = rock² darkening —
  bases lifted + controlled emissive floors; near-black sky pixels
  30.3%→~5%).
- **Largest Gap:** props are static (no idle motion); still
  MeshStandardMaterial flat-shaded throughout.

### FIX-001 — Critic-9 defect batch (wave 7)

- **Domain:** Whole-game
- **Status:** Integrated
- **Evidence:** `wave7/CRITIC9_REPORT.md` (7.0/10, 0H/4M/8L) +
  `wave7/fix9-*.png`, `int-fix9-*.png`.
- **Fixed + verified:** kerb slabs recentered hw-0.4/Y+0.05 seated on
  asphalt all tracks; AI progress watchdog (net centerline-index gain
  per 8 s window <24 → lakitu; teleports skipped) + wedge ladder
  6 s→5 s — 16/16 finishes in subagent torture, all-finishers GP
  leg 3/3 confirmed live; NN gate bars shortened/thinned/moved +
  emissive 2.1→1.45 (saber bloom gone); speed CA 0.0045→0.002 gated
  at 0.82 top-speed frac; ink overlay organic multi-ellipse splats +
  drips; title hint spans non-breaking; PRESS ENTER opacity floor
  0.15→0.70; headlight/item-box bloom reduced; GP delta uses position
  points for unfinished racers; flags get masts + pennant pivots;
  balloon tethers, strata grounding, arch pillars, billboard back
  z-fight (poster -0.14→-0.18, frame #39434f), minimap alpha
  0.55→0.88.
- **Verified:** build clean; smoke identical ×3 (PG 22.69/19.22/18.12,
  SR 26.42/22.46/21.62, NN 25.54/21.61/20.90, 0 hits, stalled 0);
  NN live 67.7 fps p50 14.6 / p95 15.3 / p99 15.6 @ 619 draws; 0
  console errors/warnings.
- **Largest Gap:** kerbs on banked NN sections still read slightly
  proud from behind (inherent to box-on-banked-edge).

### ANIM-001 — World animation (wave 7)

- **Domain:** Track/Props/Sky
- **Status:** Integrated
- **Evidence:** `wave7/anim-*.png` (motion pairs) + `int-anim-*.png`.
- **Shipped:** 78 instanced crowd head-blobs hop/wave over grandstand
  tiers + crowd texture ±0.008 UV wobble (kind crowd/crowdUV); 2
  featured billboards per track rotate as pylon signs (≥6 m tree
  clearance gate, kind spin); all pine + orchard canopies per-instance
  sway via userData.anim base/phase Float32Arrays (kind sway, zero
  rand draws — scatter bit-identical); windmill rotor on PG + SR
  (kind spin axis z); NN holo scanline pylon (kind scan, offset.y
  scroll). All via existing tick(simTime); module scratch = zero
  per-frame allocation. +5 draws PG/SR, +3 NN.
- **Verified:** build clean; smoke identical ×3; NN 68.1 fps p95
  15.4 ms @ 564 draws; 0 console errors/warnings.
- **Largest Gap:** sway is whole-canopy lean (no flutter within a
  crown); crowd hops are sync-banded not per-fan.

### MAT-001 — Material richness (wave 7)

- **Domain:** Kart/Track/Game
- **Status:** Integrated
- **Evidence:** `wave7/mat-{before,after}-*.png` matched pairs +
  `int-mat-live.png`.
- **Shipped:** kart paint/nose/driver-head → MeshPhysicalMaterial
  clearcoat 0.7/cc-rough 0.32 (flatShading kept); `glossMaterials()`
  upgrades GLB mats once per shared material (visor/glass coat 0.9,
  metals capped 0.62+0.3 coat, glow/tire stay standard); engine metal.
  `scene.environment` = PMREM RoomEnvironment (envRT kept alive,
  generator disposed), intensity 0.3 day / 0.22 night. Road:
  `asphaltRoughness()` 256² canvas roughnessMap — 0.78 base, tar
  patches, polished tire-line bands at u 0.34/0.66, speckle. Gantry
  warm lamp strip (0xffb45c, 1.15 day / 1.6 night — faint bloom halo).
  `renderer.debug.checkShaderErrors = false` — physical-material
  shaders emit benign ANGLE X4122 constant-precision info-log noise.
- **Verified:** build clean; smoke identical ×3; NN live full race
  68.1 fps p95 15.3 ms @ 784 draws; 0 console errors/warnings.
- **Largest Gap:** env response is uniform (no per-material
  envMapIntensity tuning); road roughnessMap has no normal map.

### FIX-002 — Critic-10 defect batch (wave 10)

- **Domain:** Whole-game
- **Status:** Integrated
- **Evidence:** `wave10/CRITIC10_REPORT.md` (7.0/10, 1H/7M/6L) +
  `wave10/fix10-*.png`, `int-fix10-*.png`.
- **Fixed + verified:** battered wall footing — wall is now a 3-vertex
  strip (foot→knee→top) running down to embed ~8 cm under the
  embankment; gravel aprons get the same drop-face + berms seat at the
  drop toe; skirt outer edge -0.35→-0.1 meets grade exactly; fieldY
  aligned. Kerbs slimmed 0.12→0.08 (mount/beach mitigated). Item box
  emissive 1.55→0.5 (under bloom gate). Billboard frame lightened +
  faint emissive (grazing angles). NN sign posts glow-foot; pylon edge
  rails + back scanline face. Banner emissiveMap back. GP rows
  provisional "…pts" until finish; award uses row order not live
  positionOf. Driver head matte-down (coat≤0.25, env≤0.45, rough≥0.55)
  + fill 7.5→4.2 lifted. Rubber-band honored at assisted cap (gain
  0.006/up 0.14). Q-quit disarms gpMode.
- **Verified:** build clean; smoke identical (NN spot 25.54/21.61/
  20.90, 0 hits, stalled 0); NN live 68.2 fps p95 15.4 ms; 0 console
  errors/warnings.
- **Remaining accepted nits:** banner underside dark edge-on;
  head still bright-ish at some NN angles; far item boxes read bright;
  kerb-beaching is mostly autopilot limitation; orange kart detail.

### AUDIO-001 — Audio depth (wave 10)

- **Domain:** Audio/Game
- **Status:** Integrated
- **Evidence:** `wave10/audio-*.png` + `int-audio-nn.png`; live SFX log
  (pickup 633, launches, shieldPop, spinOut, inkHit, pad, fanfare ×4,
  champion ×1, UI cues) across a full 3-leg GP.
- **Shipped:** item SFX — pickup tick+ding, per-kind launch cues
  (missile noise-swell+drop, boost ignition, shield glassy raise, ink
  wet toss, swap shimmer, slick blub), spinOut siren, shieldPop,
  inkHit, pad zap; volOf() distance-attenuates AI cues to 0 @55 m.
  Music theme-table sequencer: PG 146bpm C-major / SR 134bpm E-minor
  syncopated / NN 114bpm A-minor synthwave — gapless setTheme pivot on
  track change (≤0.12 s carryover). Per-track ambience bus: PG crowd
  murmur+breeze+bird chirps, SR rumble+gust wind, NN detuned saw hum+
  city hiss+crackles — all ≤~0.05 gain, master-volume respecting.
  UI move/tick/confirm/back blips on title+options. gpChampion()
  5-note+triad on FINAL STANDINGS. live() gate keeps gesture-lock safe.
- **Verified:** build clean; NN ~68 fps; themeIdx live-verified per
  track (0/1/2); 0 console errors/warnings.
- **Largest Gap:** all voices are oscillator/noise synthesis — no
  samples; mixing is static (no sidechain ducking under SFX).

### CHAR-005 — Idle look-around (wave 10, coordinator pass)

- **Domain:** Kart
- **Status:** Integrated
- **Evidence:** `wave10/int-char-title-*.png`; live probe headY sweep
  -0.74→0.00 at speed 0.
- **Shipped:** head wanders (two-frequency glance) when |fwdSpeed|<2 —
  title orbit/grid/countdown the driver scans instead of staring
  frozen. Existing coverage confirmed complete: slope pitch/roll, slip
  lean, impact+landing squash, pedal work, celebrations, spin flail,
  blink, idle bob, gravel jitter, airborne tilt.

### FIX-003 — Critic-11 defect batch (wave 11)

- **Domain:** Whole-game
- **Status:** Integrated
- **Evidence:** `wave11/CRITIC11_REPORT.md` (7.5/10, 0H/2M/4L) +
  `wave11/c11b-*.png`, `int-c11-*.png`.
- **Fixed + verified:** dead-stop wall pin — `pivotSteer` player-only
  flag + standstill pivot (0.4 authority under steerMinSpeed with drive
  input; AI launch lines unaffected — first pass gave bots pivot and
  drifted NN top bot +0.04 s, re-gated); AI wall-grind cycles — 4 s
  careful-mode (85% pace) after wedge-escape/lakitu so re-entry
  survives the next hairpin; NN sky lifted (0x2c3e5c/0x2a4a6e — deep
  indigo post-square vs near-void); hat() per-note AudioBuffer alloc
  → cached; banner emissiveMap 0.22→0.34; ink overlay stuck 'block'
  after quit-while-inked (title early-return skipped the hide —
  found in coordinator verification).
- **Verified:** pivot live-probed (1.39 rad yaw @0 speed, player-only);
  smoke identical ×3 after re-gate; typecheck+build clean.
- **Remaining LOWs (accepted):** orange AI kart detail; SR strata
  wedge residual.
