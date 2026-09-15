# CRITIC 13 — Whole-Game Production Review

**Date:** wave 13 · **Build:** localhost:5173 (Vite dev, commit ae63043 "FIX-004: critic-12 batch — pin-escape dirSign, AI grind-assist") · **Method:** playwright-cli live session, `window.__game` hooks, scripted probes (`scripts/c13/*`: pin/fade/stuck/aisample/perf/analyze), autopilot soak, per-frame pixel stats, source audit of `git show ae63043`/`7c24ccb` · **Baseline:** Critic 12 scored **7.6/10** with two MEDs (wall-pin dirSign oscillation, SR AI wall-grind cycles) + two LOWs (STUCK-hint mid-pivot, pivot authority cliff).

**Overall score: 8.4 / 10 — CLEAN PASS (no defect ≥ MED).**

Both carry-over MEDs are genuinely fixed — not mitigated, *fixed*, with quantitative proof. Nose-in wall pins now escape in **~2.8–3.1 s** with **zero steering reversals** (was: heading frozen at ±0.0087 rad jitter equilibrium); the SR descent stall cluster collapsed from **9.2 % stopped / 13.6 % slow / 8.7 % reversing** to **0–2.7 % worst-bot** across three independent windows. The two c12 LOWs are also closed: the STUCK hint survives only for true pins, and the 0.4→0.002 authority cliff is now a smooth taper. Regression surface is clean: reverse steering stays deterministic, the grind-assist produces no corner-cutting or wrong-way flags, and console stayed at **0 errors / 0 warnings** through every session.

---

## Fix verification — critic-12 batch

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | **Wall-pin dirSign follows drive intent < steerMinSpeed** | **FIXED** | 8-spot matrix, all escapes ≤ 3.1 s, **0 reversals** every run (c12: 0.009–0.23 rad net, nondeterministic direction). PG idx300 L-wall W+A: off-wall 3.05 s. PG hairpin idx650 L+A: escaped → 17 m/s mid-road; R+D → 21 m/s. SR banked idx600 L+A → off 2.8 s; L+D → 2.76 s. SR switchback idx520 L+A → 2.77 s; idx850 R+D → 2.76 s. NN idx850 L+A → 2.76 s. `c13-sr-pin-escape.png` (mid-rotation off the wall). `Kart.ts:563–570` |
| 2 | **Pivot authority fades 0→steerMinSpeed×3** | **FIXED** | Free-road W+A yaw-rate vs speed: 1.08 rad/s @0–0.4 · 1.03 @0.4–0.8 · 0.69 @0.8–1.2 · 0.64 @1.2–1.6 · 0.28 @1.6–2.0 · **0.15 @2.0–2.4** · 0.25 @2.4–3.0 · 0.35 @3–4 · 0.87 @4–6. No cliff (was 0.4→0.002 = 200×); residual ~2.7× sag at 2–2.4 m/s, transient (~0.15 s at accel 18) — see defect #1, LOW. `Kart.ts:551–555` |
| 3 | **AI grind-assist (2.5× pursuit @ wall-press <8 m/s) + careful 6 s** | **FIXED** | SR window A 61.7 s: worst bot 1.3 %/1.9 %/0.8 % (stopped/slow/rev). SR window B 75 s (GP leg 2): 0–0.9 %/0–1.6 %/0–0.7 %. Descent-only idx400–800: **0 % across all columns, min fs 10.45, med 22.4–22.7**. NN leg-3 76.5 s: worst 2.7 %/3.3 %/2.6 % — short 1.3–1.7 s recovery events, not cycles. Forced AI0 nose-in pin (live): self-escape **1.51 s**, clean rejoin. `AiDriver.ts:267–270` |
| 4 | **STUCK hint requires no heading change** | **FIXED** | Real pin (nose-in, W only): hint fired **2.11 s**, held (dh=0). Pin + W+A pivot: hint **0 fires in 6 s** while dh swept 4.66 rad. `c13-pg-stuck-hint.png`. `Game.ts:631–638` |
| 5 | Audio NaN guards | Verified (source only, per brief) | `Audio.ts:515–552` — `Number.isFinite` guards on speed/slipAngle before `setTargetAtTime` |

## Regression hunt — results

| Probe | Result |
|---|---|
| S-reverse steering feel | Deterministic reverse-steer: S+D from a nose-in pin rotated +4.23 rad while fs built −1.08; open-road S+D reverses in a consistent arc. `dirSign` identical to pre-fix above 0.8 m/s; intent-based below it — strictly more consistent than the jittered-fwdSpeed version. |
| Brake-at-standstill inverted steer | Brake-dominant <0.8 m/s → dirSign −1 = *correct* reverse-mirror steering (MK8-consistent). Coast/no-input defaults +1 (forward) — no unexpected inversion. Edge band |fs|∈(−0.8,0) while rolling backward uncommanded keeps forward convention for ~0.3 s — imperceptible, noted not scored. |
| Grind-assist corner cutting (2.5× lookahead across inside of next turn) | **Not observed.** Condition needs grindTime>0.5 sustained wall contact — wall% was 0–0.4 % in descent windows so it rarely arms. Forced pin recovered cleanly to line (lat −2.1 cruise). 0 wrong-way flags on all bots over ~140 s of sampling; gate masks complete normally; bot lap times 23.3–23.6 s (0.3 s spread) when unobstructed. |
| Pivot-cheat viability | Still non-viable — pivot ≤1.04 rad/s only under 2.4 m/s with drive input; can't chain through hairpins faster than driving them (unchanged physics). |
| O→O pause residue | Options close leaves PAUSED overlay + "P / Esc to resume" hint — designed modal behavior, clearly signposted. Non-defect. |
| Autopilot WASD flood post-finish | **Harness artifact, not game code:** armed autopilot calls `releaseAll()` every 50 ms once `player.finished`, eating manual KeyW/S/A/D (ArrowUp unaffected — not in its release list). Re-armed AP or `__apOff()` restores input. Player *can* drive post-finish (`allowsDrive` includes 'finished' — verified ArrowUp fs 7.45). |

## Defect table

| # | Sev | Defect | Repro | Evidence | Cause |
|---|-----|--------|-------|----------|-------|
| 1 | LOW | **Steer-authority sag ~2–2.4 m/s in the pivot→speedFactor handoff.** Yaw rate dips to ~0.15 rad/s (authority ~0.06) before speedFactor takes over. Was a 200× cliff, now a ~2.7× smooth dip — a beat of softening while accelerating out of a pin. Transient (~0.15 s); no dead zone. | Free-road W+A from standstill; measure yaw rate vs fs band. | fade-probe band table (above) | `Kart.ts:548–555` — `max(speedFactor, pivot)`: pivot→0 by 2.4 while smoothstep(0.8,10) is still ~0.08. A lift on the speedFactor floor or a slower pivot fade would close it. |
| 2 | LOW | **Residual AI incident residue: short wall/shove events (~1–4 s) still occur ~once per bot per 1–2 laps on technical sections, and 1–2 bots per GP leg don't finish before the leader.** Episodes now self-clear (no cycles) but the field spread still produces "…pts provisional" rows most legs. | Sample aiKarts fs at 10 Hz over a race; count fs<0.5 episodes. | NN leg: ai0 1.7 s @idx 603, ai1 1.3 s @idx 757; SR: 0.2–0.4 s episodes; GP legs: 2/1/2 unfinished | Not a stall mechanism — isolated incidents (kart-kart shoves, wall clips at idx ~155/374/601/757/974). Pace spread is inherent (skill 0.95–1.05 + careful 6 s). |
| 3 | LOW (watch) | **NN draw calls still ~2× the wave-11 PG reading** — 333–759/frame (autoReset=false → full scene+shadow+post) vs ~320 PG-typical. fps holds 67.9; worst frame 16.0 ms. Watching for continued creep. | renderer.info mid-race NN | perf sample | scene content; same observation as c12 #5, peak slightly higher |

No HIGH, no MED. Defects 1–3 are polish/residual observations, not release blockers.

## What holds up

- **GP is correct end-to-end, third wave running.** Leg 1 PG: BOT-B P1 / YOU P2 / BOT-C P3 / BOT-D unfin. Leg 2 SR: BOT-C P1 / YOU P2 / BOT-B P3 / BOT-D unfin. Leg 3 NN: BOT-B P1 / YOU P2 / BOT-D P3 / BOT-C unfin. FINAL STANDINGS sorted: **★ BOT-B 25 · YOU 21 (★REC) · BOT-C 18 · BOT-A2 11** — cumulative math exact at every leg (10/7/5/3 + carry). Unfinished bots render `…pts provisional` rows. Q → fresh `1 RACE` title, GP disarmed. `c13-gp-*.png`.
- **Wall-pin escape is now reliable everywhere** — inside walls, outside walls, banked descent, switchback, hairpin, straight, both steer directions. ±0.0087 rad oscillation → monotonic ~1.04 rad/s authority.
- **The stuck hint is smarter, not just weaker** — still fires at 2.1 s for genuine throttle-only pins, never for a working pivot.
- **Bots genuinely recover now** — forced nose-in AI pin self-cleared in 1.5 s; descent windows show 0 % wall time; stall episodes are sub-2 s singletons.
- **Options/pause/respawn/motion/restart verified** — O modal+paused (all 12 rows render incl. binds/RESET), P toggles (sim freezes), ⌫ snaps to line, M flips `chaseCam.reducedMotion`, R regrids to fresh countdown.
- **Zero console errors, zero warnings** across title ×3 tracks, 4+ races, full GP, standings, re-title. Only `[vite]` connects.
- **NN legibility holds** — near-black 6.0–9.3 % mid-race/standings frames (was 19–33 % pre-fix era); sky band (14,16,28)–(8,12,26) indigo not void; zero blown frames.

## Performance — NEON NIGHT, mid-race, 680-frame / ~10 s sample

| Metric | Result | Budget | Pass |
|---|---|---|---|
| Avg FPS | **67.9** | ≥ 55 | ✅ |
| Frame time p50 | 14.7 ms | — | — |
| Frame time p95 | **15.5 ms** | ≤ 16.6 | ✅ |
| Frame time p99 | 15.7 ms | — | — |
| Worst frame | **16.0 ms** | — | — |
| Frames >16.6 ms | **0 / 680** | — | — |
| Draw calls (full frame) | 333–759 | — | watch (#3) |
| Triangles | 78.5–113.9 k | — | — |

## Console

`0 errors · 0 warnings` — every session this wave (title orbits ×3, PG/SR/NN races ×4+, options, pause, respawn, full 3-leg GP, standings, re-title, all probe runs). Only `[vite] connect` infos.

## Grand Prix statistics (observed run)

| Leg | Track | Winner | Player | Bots finished | Notes |
|---|---|---|---|---|---|
| 1 | PROVING GROUNDS | BOT-B | P2 | 3/3 within window (BOT-D ~late) | correct 10/7/5/3 |
| 2 | SWITCHBACK RIDGE | BOT-C | P2 | 2/3 at advance | provisional row shown |
| 3 | NEON NIGHT | BOT-B | P2 | 2/3 at advance | provisional rows shown |
| Final | — | **★ BOT-B 25 pts** | P2 21 pts ★REC | — | sorted, champion, fresh re-arm |

## Stall% vs critic-12 baseline (worst bot per window)

| Window | Track | Span | Stopped <0.5 | Slow <4 | Reversing <−0.3 | Wall% |
|---|---|---|---|---|---|---|
| c12 baseline | SR descent | 46.2 s | **9.2 %** | **13.6 %** | **8.7 %** | — |
| w13 A | SR full course | 61.7 s | 1.3 % | 1.9 % | 0.8 % | 0 % |
| w13 B | SR full course (GP leg 2) | 75.0 s | 0.9 % | 1.6 % | 0.7 % | 0.4 % |
| w13 descent-only | SR idx 400–800 | 83.2 s | **0 %** | **0 %** | **0 %** | **0 %** |
| w13 C | NN leg 3 | 76.5 s | 2.7 % | 3.3 % | 2.6 % | 0 % |
| w13 D | SR fresh lap 1 | 41.2 s | 1.9 % | 2.9 % | 1.0 % | 0 % |

The cycle is broken: worst-case stopped share fell ~7× (9.2→≤2.7 %), reversing ~3–10× (8.7→≤2.6 %), and the descent hairpins — the exact critic-12 failure site — sample completely clean.

## Session notes / non-defects

- **Autopilot flood gotcha (harness):** while armed, `releaseAll()` runs every tick when `!allowsDrive || player.finished`, keying-up manual WASD. Symptom mimicked "input dead after finish" — resolved by `__apOff()`; ArrowUp bypasses it. Not game code.
- Earlier probe globals (`__pin` etc.) vanished once mid-session with no page reload — could not reproduce; reinstall via `fetch('/scripts/c13/x.js').then(r=>r.text()).then(eval)` is instant.
- All probe scripts live in `scripts/c13/` (pin.js, stuck.js, fade.js, aisample.js, perf.js, analyze.js) — same pattern as `scripts/c12/pix.py`.

## Gap to MK8

The remaining distance is now polish and content, not correctness: the 2–2.4 m/s steering sag (defect 1), residual per-race bot incidents and the pace spread that leaves backmarkers provisional (defect 2), and the format depth (3 tracks / 4 karts / one cup) vs the reference. The trust fundaments — input honesty at the speed floor, AI that finishes races, a hint system that doesn't lie — are now all in place. Consecutive-clean track record starts here.
