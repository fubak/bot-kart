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
| MOVE-007 | Drift/boost feedback VFX | Planned | — |
| RACE-001 | Checkpoints + lap counting | Planned | — |
| RACE-002 | Race flow (countdown/finish) | Planned | — |
| AI-001 | Opponent AI (racing line) | Planned | — |
| HUD-001 | Race HUD (lap/position/time) | Planned | — |

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
- **Spec:** Hold Shift+steer at speed → locked-direction drift with slip angle
  (low lateral grip) and yawed-out body; charge tiers at 0.9s/1.9s; release →
  0.7s/1.4s mini-turbo boost. Boost expiry bleeds speed (no snap clamp).
  Brake interrupts drift. Verified: charge 1.19s → release → boost state
  0.5s → 28 m/s.
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
- **Spec:** Kart clamps to road edge (no wall penetration). Contact is an
  episode: outward velocity reflected with restitution + one-time speed
  retention penalty ON IMPACT only; sustained contact slides along the wall
  and re-accelerates. Barrier walls + curbs make the boundary VISIBLE.
  Verified live: `intoWall 15.5 → grind+1.5s 24.3 → released 28` m/s;
  `wall-check.png` shows kart at lateral clamp 5.1 inside wall at 101 km/h.
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
- **Spec:** Exp-damped follow behind kart; look-ahead along heading; FOV
  60→74° with speed, +8° on boost. Consumes `kart.lastWallHit` as a decaying
  shake impulse on impact. Frame-rate independent.
- **Evidence:** `slice-*.png`, `wall-check.png` — consistent chase framing
- **Critic Result:** FAIL flagged — zero impact feedback. Fixed: wall-hit
  shake wired in.
- **Largest Gap:** shake amplitude is untuned (judged from traces, not feel).

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
- **Status:** Planned
- **Dependencies:** MOVE-003
- **Wave:** 2
- **Spec:** Drift spark/tire-smoke intensity grows with charge tier (color
  shift at tier 2); boost has exhaust burst + FOV kick readability.

### RACE-001 — Checkpoints + lap counting

- **Domain:** Race rules
- **Status:** Planned
- **Dependencies:** TRACK-001
- **Wave:** 2
- **Spec:** Ordered checkpoints around the centerline; lap counted on start
  line after all checkpoints; prevents shortcut lap-skips.

### RACE-002 — Race flow (countdown → finish)

- **Domain:** Starting/finish sequence
- **Status:** Planned
- **Dependencies:** RACE-001
- **Wave:** 2
- **Spec:** 3-2-1-GO countdown with input lock; N-lap race ends at line with
  result state; restartable.

### AI-001 — Opponent AI (racing line)

- **Domain:** AI racers
- **Status:** Planned
- **Dependencies:** MOVE-001, TRACK-001
- **Wave:** 2/3
- **Spec:** Bot follows centerline with lateral offsets, throttle/brake for
  curvature, simple drift on tight corners; collides + reacts.

### HUD-001 — Race HUD

- **Domain:** HUD
- **Status:** Planned
- **Dependencies:** RACE-001
- **Wave:** 3
- **Spec:** Lap counter, position, race time, speed; readable at speed.

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
