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

### TRACK-004 — Gravel shortcut (hairpin inside-cut)

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
- **Evidence:** displacement sampling (0.5 s) detects pinned karts (both
  nose-in-wall low-speed and wall-pressed high-speed); brake+steer-to-
  tangent recovery freed a wedged bot in 251 ms. Spin-outs excluded via
  new `kart.isSpinning`.
- **Largest Gap:** recovery is reverse+steer only; no path-replanning if
  the wedge point is re-entered.

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
