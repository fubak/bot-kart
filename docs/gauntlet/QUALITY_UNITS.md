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
| AI-001 | Opponent AI (racing line) | In Progress | — |
| HUD-001 | Race HUD (lap/position/time) | Built | — |
| AUDIO-001 | Procedural SFX (engine/skid/boost/impact/UI) | Built | — |
| ART-001 | Grok Bot A + Kart A (canonical assets) | Built | — |
| TRACK-002 | Track readability pass 1 (scenery/dashes/gantry) | Built | — |

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
- **Status:** Planned
- **Dependencies:** MOVE-001, TRACK-001
- **Wave:** 2/3
- **Spec:** Bot follows centerline with lateral offsets, throttle/brake for
  curvature, simple drift on tight corners; collides + reacts.

### HUD-001 — Race HUD

- **Domain:** HUD
- **Status:** Built (needs rival position once AI lands)
- **Builder:** Coordinator
- **Dependencies:** RACE-001
- **Wave:** 1+
- **Spec:** Lap counter, race/lap/last/best times, countdown, wrong-way,
  finish banner — DOM overlay readable at speed. `src/core/RaceHud.ts`.
- **Evidence:** `race-countdown.png`, `race-finish.png`
- **Largest Gap:** no position/P1-P8 display (needs AI); no minimap;
  styling is plain.

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
