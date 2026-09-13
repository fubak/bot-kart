# Critic Report — critic-live-1 (Racing-Purist Gameplay Critic)

**Date:** 2026-09-13 · **Build:** live dev server @ localhost:5173 (uncommitted wave-1/2 hybrid: Race.ts + RaceHud.ts + KartVfx.ts + scenery present; physics = tuning.ts values verified live)
**Method:** Playwright synthetic key dispatch + `window.__game` state sampling (30–130 ms granularity) + timed screenshots. ~25 minutes of scripted driving: launches, coast/brake/reverse, steer taps vs holds at 5.8/23/26/28 m/s, four drift techniques, wall ram/glance/grind, scripted centerline-follow lap, camera FOV/distance/shake traces.

**Note on test conditions:** the coordinator was editing in parallel — the page hard-reloaded 3× mid-test (Vite). All numbers below were re-verified post-reload against current `tuning.ts` (accel 18, maxSpeed 28, etc. — identical across reloads).

---

## VERDICT: **FAIL**
## SCORE: **5/10**

The spine is real: launch, steering ramp, episode-based walls, FOV kick, sparks/flames/chips all *function*. But the core kart verb — the drift — is dynamics-broken: a held drift spins the heading through the velocity vector (slip to 62–80°), scrubs 60–90% of speed, self-cancels near a stop, and the sane way to charge a tier barely exists on this track. A kart game whose drift punishes you is not yet a kart game.

---

## WHAT I ACTUALLY TESTED

- **Launch:** hold W from spawn. 0→27.9 m/s in **1535 ms** (pred. 1556 @ 18 m/s²). Perfectly linear: 4.05→7.95→11.85→15.9→20.25→24→27.9 at ~213 ms intervals. No sag, no stall. State stays `grip`.
- **Coast/brake/reverse:** release at 28 → 19.3 in 1.45 s (drag ≈ 6 m/s², coast-only ✓). Brake 18.5→0.1 in ~0.52 s (≈35 m/s² = brake 30 + drag). At stop, S reverses to **fwdSpeed −6.0** cap; steering correctly inverts (−36°/500 ms on A while reversing vs +left when forward).
- **Steering:** parked hold-A 600 ms → **0.0°** ✓. steerSmooth ramp: 0→0.47 @69 ms →0.93 @135 →1.0 @~200 ms (slew 7). 90 ms tap @26 m/s → **1.6°** (genuinely gentle). Holds: ~80–100°/s effective at 23–28 m/s (ramp eats first ~150 ms). Full-steer band confirmed mid-speed; ~0.65× at top.
- **Drift ×4 techniques** — see MOVE-003.
- **Walls:** straight-line ram @28 → **1.4 m/s** (95% loss) + backward rebound ~4 m/s; steer-into-wall @28.4 → 20.6 (27% loss) then **re-accelerates to 28.4 while still in wallContact** for ~1.3 s of grind. Clamp verified at lateral ±5.1 via `track.query`.
- **Camera:** FOV 60.0→73.9 @28 m/s, +8 boost kick (76–77 seen at only ~20 m/s in boost). 3D follow distance measured **7.7 m parked → 9.86 m @28** — the kart *shrinks* at speed (see CAM-001). Shake on impact: ±~0.1–0.25 m jitter for ~0.3 s.
- **Lap:** scripted centerline-follow bot, lookahead ~10 m. Flat-out 28–28.3 m/s through the sweeper AND most of the zigzag; single wall clip @idx~670 (28→8.4). Whole lap requires **zero braking** — no braking zones exist.
- **Perf:** 75 fps, 13.3 ms frame (worst 13.8), 128–133 draw calls, ~30k tris. Healthy.

---

## EVIDENCE

| File | Shows |
|---|---|
| `critic-0-spawn.png` | Spawn framing, debug HUD, pre-scenery build |
| `critic-1-drift.png` | Drift sparks live, race HUD (LAP 1/3), trees/rocks |
| `critic-2-midlap.png` | Post-lap state, kart at boundary |
| `critic-3-drift-held.png` | **Cyan tier-2 spark plume** @charge 2.2 s — but speed 20 km/h: the slow-donut exploit mid-flight |
| `critic-4-sweeper.png` | 101 km/h riding left curb; red curb chain = visible boundary |
| `critic-5-corner.png` | Start stripe + gantry banner approaching |
| `critic-6-grind.png` | 41 km/h wall grind on curb; **"wall" ribbon reads as flat gray stripe**, chip particle visible |
| `critic-7-boost.png` | WRONG WAY flag live after spinout |

Numeric traces (all captured via eval sampling): launch `0→27.9@1535ms`; coast `28→19.3@1.45s`; brake `18.5→0.1@0.52s`; rev `−6.0`; steer ramp `[0,.47@69ms,.93@135,1@~200]`; tap `1.6°`; drift-A `28→15.5→4.2, slip→1.39rad, auto-cancel`; drift-neutral `29.6→9.0, slip→1.08, charge 0.83 → NO boost`; drift-counter `slip 0.49 stable, |v|→31.6`; grind `20.6→28.4 w/ contact=1`; head-on `28→1.4`; cam dist `7.7→9.86`; boost `charge 2.2 → boostTimer 1.32, FOV 76`.

---

## PER-UNIT VERDICTS

### MOVE-001 Acceleration — **PASS (6/10)**
Launch is clean and honest: linear 18 m/s² to a hard 28 cap, ~1.54 s 0→top. Coast/brake/reverse all correct (drag coast-only — the flagged bug is fixed; reverse caps at 6 with inverted steer). **Gap:** the ramp is dead-linear — no initial kick, no sense of engine. A 0.2–0.4 s "launch surge" (slightly higher initial accel tapering to the ramp) would add the missing snap. Also `speed` getter returns |v| — HUD shows positive km/h while reversing; cosmetic.

### MOVE-002 Steering — **PASS (7/10)**
Speed-scaled steering works end to end: 0° parked, smoothstep fade-in through ~10 m/s, 0.65× at 28. The slew ramp delivers exactly the design intent — 90 ms tap = 1.6° for line trim, 500 ms hold = full authority. **Gap:** ~200 ms to full lock is soft on entry — the first ~60 ms gives <40% lock, so quick corrections feel a beat late. Consider asymmetric slew (faster attack ~10, keep release 7) or a small direct term.

### MOVE-003 Drift + mini-turbo — **FAIL (3/10)** ← largest gap
The mechanics exist; the dynamics are broken:

- **Full-steer drift (hold Shift+A):** yaw ≈ 2.6×1.45×1.25 ≈ 4.7 rad/s (**270°/s**) — the heading spins *through* the velocity vector; slipAngle hits **1.39 rad (80°)**; speed collapses 28→15.5→4.2; `fwdSpeed` crosses **negative** (−3.6) — the kart is sliding backward relative to its own nose. Auto-cancel at fwdSpeed<1.6 dumps you at ~2–4 m/s, then boost fires at walking pace. A held drift is a spin-out, not a drift.
- **Neutral drift (Shift only after entry, 0.8 bias):** still ~3 rad/s yaw; slip 62°, 29.6→9.0 in 0.74 s; auto-cancel at charge 0.83 — *just* under the 0.9 tier → **near-stop AND zero boost**. The most natural "hold the drift" instinct is the worst possible outcome.
- **Counter-steer drift (enter on A, hold D):** this is the real technique and it *works* — stable ~0.49 rad (28°) slip, fwdSpeed ~27, |v| 31.6 (carries genuine lateral slide). Charging is possible. BUT the arc runs wide and broke on the wall in 2 of 3 scripted attempts before reaching 0.9 s.
- **Tier economics broken:** tier-1 (0.9 s) is a knife-edge — most real drifts break on walls first. Tier-2 (1.9 s) is unreachable in honest driving; I only reached it via **slow-donut exploit** — spinning in circles at 5–10 m/s still satisfies `fwdSpeed > 1.6` and maxes charge to 2.2 s (see critic-3: 20 km/h "drift" with a cyan tier-2 plume). Free 1.4 s boost for parking-lot donuts.
- **Boost pipeline itself is fine:** tier→0.7/1.4 s boostTimer, +9 m/s cap (37), boostAccel 26 measured, overSpeedDecay bleed implemented, +8 FOV kick measured, flame VFX coded. But because drifts exit at 8–20 m/s, boost reads as "climb back toward top speed" — you almost never see >28, so the bleed code rarely runs.
- **Player-facing charge readout: FIXED since registry note** — spark color grey→amber→cyan telegraphs tiers (captured cyan live). HUD also shows `drift 2.20s` in debug. This part is now ahead of the registry's stated gap.

**Why it matters:** drifting is the signature verb of the genre. Right now, doing it "the obvious way" (hold) is strictly worse than not drifting, and the rewarding version requires counter-steer micro most players won't discover.

### MOVE-004 Wall collision — **FAIL→borderline (5/10)**
The contact-episode model works: penalty fires once per entry (tar-pit gone), grind slides and re-accelerates, chips VFX + squash + shake all fire. But the tuning is lopsided:

- **Head-on:** 28→**1.4 m/s** (95% loss) — `wallImpactLoss` halves *total* velocity on top of reflecting outward velocity, and the 0.3 restitution then rebounds the kart **backward ~4 m/s while still facing the wall** — hold W and you ping-pong back into it. MK stops you dead; it doesn't eject you backward. ~84–95% loss + rebound = double punishment.
- **Grind:** after a ~27% entry hit, the kart re-accelerates to **full 28.4 while wallContact=1** — grinding the wall through a corner is nearly free (scrub 0.6/s ≪ accel 18). Head-on brutal, grind free: the gradient is backwards from genre norms where sustained contact is the real cost.
- **Visual contact gap:** constraint clamps kart *center* at lateral 5.1; kart edge reaches ~5.9; wall ribbon sits at 6.35 → **the kart never visually touches the wall** (~0.45 m air gap). Contact reads as "riding the curb," and the 0.55 m wall itself is a flat gray stripe from inside angles (critic-6) — it reads as painted ground, not a barrier.

### CAM-001 Chase camera — **borderline (6/10)**
Follow is smooth, look-ahead works, FOV 60→74 +8 boost all verified. Two real problems:

- **The distance intent is defeated by lag.** `distanceSpeedTrim` pulls the *target* 7.0→5.6 m at top speed, but posDamp=7 exp-follow lags ~speed/posDamp ≈ **4 m** behind the target at 28 m/s. Measured: 3D distance grows **7.7→9.86 m** — the kart gets *smaller* precisely when speed sensation matters most. The comment in tuning says the trim exists to keep the kart readable; physics does the opposite. Fix: add a speed-proportional lead (or speed-scaled posDamp) so effective stand-off actually closes.
- **Shake is binary and weak:** any wall entry triggers the same 0.35 m/0.28 s burst (not scaled by impact), and post-lookAt positional jitter gives a mild shudder where a 95% speed-loss crash deserves a real thump.

### TRACK-001 Proving Grounds — **PASS for a test track, weak as a track (5/10)**
- Layout verified by centerline walk: ~170×95 m, straight ~60 m, right sweeper, zigzag S-section, left-side return. Constraint stable (nearestIndex never wrong-branched, even in the zigzag).
- Readability: road/grass contrast strong; curbs + dashes give boundary and optical flow; trees/rocks add parallax; gantry is a landmark. **But:** left curbs are ALL red, right ALL white (asymmetric — reads inconsistent); the wall ribbon is nearly invisible at grazing angles; no corner signage/anticipation markers; uniform cone-trees give zero place-memory.
- Flow: **the entire lap is flat-out at 28 m/s** — my follow-bot never needed brake or lift, corners never exceed steering authority. As a proving ground that's fine; as a track it means zero speed management skill. The one punishing moment (zigzag @idx~670) caught even a decent line.
- Flat, no elevation (documented as planned).

---

## SINGLE BIGGEST QUALITY GAP

**Drift yaw-rate / grip coupling.** The heading rotates ~3–4.7 rad/s in drift while velocity can't follow (driftGrip only kills lateral at 1.6/s), so slip runs away to 60–80°+, speed collapses, and the drift self-destructs near a stop — usually before charge crosses tier-1. Everything downstream breaks: boost fires at walking pace, tiers are unreachable honestly, and the charge system rewards parking-lot donuts. One fix — clamp drift slip/yaw so heading and velocity settle into a *held* ~25–35° slip that preserves ~80–85% of speed, and gate charge accrual (or drift entry) behind a real minimum forward speed — repairs drift feel, tier economics, and boost satisfaction simultaneously.

**Why it matters:** in this genre drift is the primary moment-to-moment skill loop. Every other flaw (linear launch, camera lag, flat track) is polish; this one is the game.

## ORDERED FIX LIST

1. **MOVE-003 drift model:** cap drift yaw so slip settles ~25–35° (e.g., slewTarget bias ~0.35 not 0.8, or steer toward velocity direction); raise sustain floor to ~8–10 m/s so donuts can't charge; preserve ≥80% entry speed during held drift. Re-tune tiers against real achievable drift lengths on TRACK-001 (0.9 s is currently a knife-edge).
2. **MOVE-004 wall feel:** remove the backward rebound (restitution within the wall plane, or clamp post-hit velocity to non-negative along heading); scale impact loss toward ~60–70% kept on head-on; raise `wallScrub` (or cap grind speed ~70%) so grinding isn't free; move wall visual/constraint flush so contact visibly touches the barrier.
3. **CAM-001 speed compensation:** add speed-proportional camera lead (target += fwd·k·v) or speed-scaled posDamp so the kart doesn't shrink 28% at top speed; scale shake amplitude by impact severity.
4. **MOVE-001 launch shaping:** brief launch surge (e.g., 1.3× accel for first ~0.3 s or an ease curve) for tactile starts; cosmetic: negative km/h when reversing.
5. **MOVE-002 steer attack:** asymmetric slew (attack ~10–12, release ~7) to shave the ~60 ms of dead response without restoring dart-twitch.
6. **TRACK-001 differentiation:** symmetric red/white curb alternation both sides; taller/more solid wall read; chevrons or color-blocked corner markers; at least one corner that demands a lift/brake.

## SECONDARY NOTES (non-blocking)

- WRONG WAY detection + LAP/TIME HUD observed working (out of scope for this wave's review but functioning).
- 3 page reloads mid-session from parallel edits — fine for dev velocity, but critic sessions need a stable build window to avoid half-measured comparisons.
- Boost flame VFX exists in code (`boostFlame` cyan/orange) — function verified via boostTimer/FOV/accel traces; I never caught the plume on-screen (boost windows are short after slow drifts). Worth one visual confirm after the drift fix lands.
- `heading` accumulates unbounded (−5.9 rad seen) — cosmetic, wrap it.
- Debug HUD `drift`/`boost` fields show 0.00 while driving — they only update during the states; fine for dev.
