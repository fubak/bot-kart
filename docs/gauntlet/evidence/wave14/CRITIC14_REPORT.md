# CRITIC-14 — Adversarial Whole-Game Review (Wave 14)

**Game:** Grok Bots Kart Racing (Three.js kart racer) · **Build under test:** HEAD `643f856`
**Method:** `playwright-cli` against `http://localhost:5173`, `window.__game` introspection, deterministic dyno/autopilot probes (`scripts/c14/dyno.js`), GP autopilot runs, synthetic-gamepad stubs, DOM/DOM-visibility-verified menu checks.
**Bar:** Mario Kart 8 production quality, 0–10. A clean pass requires **no defect rated MEDIUM or higher**.

## Verdict: **7.8 / 10 — NOT a clean pass**

Critic-13's 8.4 clean pass does **not** hold consecutively. The pivot-steering fix landed (the 0.15 rad/s dead-zone is gone) and the game is broadly polished — console is spotless, frame budget holds, Grand Prix scoring is provably exact — but this wave found one **MEDIUM** race-correctness defect in a shipped item, plus a small cluster of LOW issues including a real GPU texture leak.

Two previously-suspected issues were investigated and **retracted** (see "Cleared suspects") — including the AI "phantom lap" theory, which turned out to be correct unwrapped-coordinate accounting.

---

## Defect table

| # | Severity | Defect | Repro | Evidence | Source |
|---|----------|--------|-------|----------|--------|
| 1 | **MEDIUM** | **Swap/resync wipes the passed-gate mask — both swapped karts must re-drive ~a full lap before the current lap counts.** `RacerProgress.resync()` sets `mask = 0` and re-arms all 7 mid-lap gates; the line gate only counts a lap on a full mask, so the next line crossing after *any* swap (forward or backward) silently fails to count. A backward swap costs ~1.4 physical laps for one counted lap; a forward swap onto the final-lap run-in can deny a finish crossing outright and force a near-full extra lap. | Draw `swap` (trailing positions), fire it; watch `racers[i].mask→0`, `nextCross` re-armed, then cross the line — `lap` does not increment until all mid-lap gates re-pass. Verified live: after `resync()` at tidx 608, only gates ahead re-armed (`mask` filled bit-by-bit from 640→); GP leg-1 player score dropped 2344→1632 then needed ~1.4 laps for one counted lap. | GP leg-1 live telemetry; live resync probe (mask=0 → bit 4 only after re-passing gate 640); math verified vs gate schedule `[128..1024]`, `n=1024`. | `src/game/Race.ts:132-146` (`mask = 0` at :140, `nextCross` at :141-143), gate/lap logic `:87-99`; call sites `src/game/Items.ts:291-292` |
| 2 | LOW | **Residual pivot→cruise handoff valley.** The C13 dead-zone is fixed (fade now ends at 5 m/s), but the dyno still measures a shallow valley — mean yaw-rate ~0.43–0.48 rad/s around 2.75–3.25 m/s vs the ~0.5 guide — before rising cleanly to 1.74 rad/s at 6.75 m/s. Smooth taper, no cliff; polish nit only. | Hold W+A, clamp speed in ~0.5 m/s steps 0→6+ m/s, measure yaw/step (scripts/c14/dyno.js). | Dyno means: 0.0→1.04, 1.0→0.98, 2.0→0.73, 2.5→0.57, 3.0→**0.43**, 3.25→0.46, 4.0→0.72, 5.0→1.10, 6.0→1.43, 6.75→1.74 rad/s. C13's 0.15 trough at 2–2.4 m/s eliminated. | `src/game/Kart.ts:548-555` (`pivot` smoothstep → `5`) |
| 3 | LOW | **GPU texture leak on every track (re)build.** `Track.dispose()` frees geometries and materials but not their texture maps; `TEX.*`/`checkerTexture`/billboard factories allocate fresh textures per build. | On title, press T repeatedly; read `renderer.info.memory.textures`. | Fresh session: 40 → 54 → 65 → 83 across PG→SR→NN (+11–18/swap); session end 103 after race rebuilds. Earlier session reached 152. Frame times unaffected within observed ranges. | `src/game/Track.ts:310-318`; allocation `src/core/Textures.ts:20-38`, `43+` |
| 4 | LOW | **Respawn during an item spin does not clear the spin.** `Kart.reset()` zeroes velocity/drift/boost/wall/ink state but not `spinUntil`; `update()` keeps `isSpinning` until the old timer expires — kart respawns still spinning with dead controls for the remainder. | Take a spin item, press ⌫ mid-spin → kart placed on-line but `isSpinning` stays true (`spin:true` observed post-reset). | Live probe: reset during spin returned `{spin:true}`. | `src/game/Kart.ts:424-443` (reset) vs `:447` (`spinUntil` read) |
| 5 | LOW (cosmetic) | **Unfinished bot's FINAL-standings row keeps the '…' position glyph.** Correctly sorted by points and correctly pointed, but the P-column shows '…' (its leg-3 column is also '…' since it never finished) — reads odd on a final table where every other row shows P#. | GP leg 3 with a bot unfinished at player finish → N to FINAL STANDINGS. | `c14-gp-final.png` — "… BOT-B … best 0:27.10 18 pts" sorted 3rd. | `src/core/RaceHud.ts` (results render) |
| 6 | LOW | **Residual AI stall episodes** — unchanged from C13: brief 1.9–3.4 s stalls per bot per race, stopped 1.7–3.3 %, reversing 0.9–2.4 %, wall ~0 %. Grind-assist prevents sustained wall grinding; incidents remain occasional. | Per-bot telemetry over a full race. | AI metrics consistent with C13 band. | `src/game/AiDriver.ts` |
| 7 | WATCH | **Draw calls crept up:** 448–844/frame on Neon Night (C13 saw 333–759). No frame-time cost observed (p99 15.7 ms, worst 15.9 ms, 0 frames >16.6 ms). | ~10 s mid-race render.info sampling. | Perf block below. | `src/core/PostFX.ts`, scene |

---

## Cleared suspects (verified NOT defects)

- **AI "phantom lap" / progressIdx +1024 inflation — RETRACTED.** Bots gridded *behind* the line (tidx ≈ 1020) unwrap progressIdx from ~1020, so +5 s in they read ≈ tidx+1024. `spawnOffset` normalizes `score`, and the full-mask rule (`Race.ts:87-99`) means the first line crossing never counts — observed live: BOT-A2 crossed first time at 24.9 s → lap 1→2 correctly, `lapTimes=[24.9]`. Positions, lap counts, and GP points all audited exact. The unwrapped coordinate is by design.
- **"Rebind menu frozen / Enter dead" — test artifact.** The gauntlet autopilot (`/__gauntlet/autopilot.js`) was still injecting synthetic `KeyW`/`KeyA` keydowns; while a capture is armed the *next* keydown becomes the binding, so the autopilot's `KeyW` instantly re-bound throttle→KeyW (a no-op). With autopilot off, rebind works perfectly: armed capture → "PRESS KEY…", conflict key clears the displaced action to '—' (`Input.ts:65-70`), persists to localStorage, RESET BINDINGS restores defaults. Also a stale-DOM trap: the hidden options div retains its last innerHTML.
- **Post-respawn fs=28** — autopilot was still driving; not a physics anomaly.
- **Esc inert on results** — correct; results advertise `[R] restart · [Q] title` only.

---

## Verified this wave

**Pivot fix (the asked question):** fade `0.48→2.4` widened to `0.48→5` m/s at `Kart.ts:553`; dyno 0→6.75 m/s shows the dead zone gone and a smooth taper. Residual valley = defect #2 (LOW). **No yaw-rate below 0.43 rad/s observed.**

**Grand Prix end-to-end:** 3 legs PG→SR→NN. Points audited exact — leg-by-leg: YOU 5+10+10=**25** (★ champion), BOT-A2 7+7+5=**19**, BOT-B 10+5+3=**18**, BOT-C 3+3+7=**13**. Provisional rows truthful (`…  …pts provisional` mid-cup), unfinished bots sorted by score and pointed correctly (P3/P4 pts). `R` on final standings re-arms a fresh cup at leg 1/3; `Q` disarms to "1 RACE" title. Screenshots `c14-gp-leg{1,2,3}-results.png`, `c14-gp-final.png`.

**All three tracks:** title + race on Proving Grounds, Switchback Ridge, Neon Night — `c14-title-{pg,sr,nn}.png`, `c14-{pg,sr,nn}-race.png`, `c14-nn-title.png`. Console **0 errors / 0 warnings** every session (2 benign log-level messages total).

**Fresh angles, all clean:**
- Options: modal + pauses; volume/difficulty/reduced-motion/minimap adjust; rebind arm/capture/conflict-clear/persist/reset all correct (after autopilot decontamination).
- Reduced motion persists across reload (`localStorage` → `chaseCam.reducedMotion=true`); track selection persists (`track:2` → NN on reload).
- Gamepad stub: A=start, Start=pause, B=back, RT throttle, stick steer, item/reduced-motion buttons — all routed through the keyboard pipeline.
- Wrong-way HUD fires driving backward.
- Kerb/beach recovery: teleported to lat 9 apron → drove back to road unaided (25.3 m/s); ⌫ respawn places on-line (lat −0.3).
- Pause during countdown lands cleanly on paused-racing; PAUSED overlay correct.
- Post-finish: W held → fs=0, controls correctly dead; `finLoop` decel works.
- Lap records: `★REC` shows on beaten records (leg-3 best 0:22.40 starred).
- Title↔race cycles (3×) + repeated track swaps: geometries/textures stable *except* the texture leak in defect #3.
- Ink overlay under bloom screenshot (`c14-ink-overlay.png`); shield-absorbs-ink path verified in `Items.ts:303-307`.

## Performance (Neon Night, mid-race, ~10 s clean sample)

| Metric | Value |
|---|---|
| Frames | 681 |
| Avg FPS | **68** |
| p50 / p95 / p99 frame | 14.7 / 15.4 / 15.7 ms |
| Worst frame | **15.9 ms** |
| Frames >16.6 ms | **0** |
| Draw calls | 448–844 |
| Triangles | 92,709–125,287 |

(An earlier run's 176.6 ms worst frame was screenshot-tool interference; the clean resample shows zero over-budget frames.)

## Console

**0 errors, 0 warnings** across all wave-14 sessions (title, race, GP legs, options, probes).

## What holds up

Fixed-timestep sim stays deterministic under teleport abuse; gate/mask lap validation correctly denies free laps (gridded-behind-line case proven live); GP arithmetic is exact including provisional unfinished rows; rebind conflict handling is textbook (no dual-bound keys); post-finish input gating; settings/bindings/track persistence; wrong-way; beach recovery; modal options in every phase; filmic presentation with zero console noise at a locked ~68 fps.

## Top defects (for the fix queue)

1. **MEDIUM — swap/resync mask wipe steals ~a lap from both swapped karts** (`Race.ts:140` `mask=0` + `Items.ts:291-292`). A swap shouldn't cost gate credit already earned — preserve mask bits for gates behind the resync point, or only wipe on forward teleports that would skip gates.
2. **LOW — texture leak per track rebuild** (`Track.ts:310-318`): dispose material maps too, or cache shared `TEX` textures.
3. **LOW — respawn doesn't clear `spinUntil`** (`Kart.ts:424-443`).
4. **LOW — residual ~0.43 rad/s yaw valley at ~3 m/s** (`Kart.ts:548-555`).

*A second consecutive clean pass is denied on defect #1 alone. Fix the mask wipe and the remaining items are all LOW polish.*
