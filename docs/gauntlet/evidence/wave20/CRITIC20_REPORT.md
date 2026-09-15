# CRITIC-20 — Wave 20 Adversarial Review

**Scope:** SG-11 GAME-FEEL (roulette, slipstream, drift-hop, ultra mini-turbo), SG-12 VFX-DEEP (streaks, tier bursts, dust, teleport, materialize, glints, pad flash, ambient motes), SG-13 SFX-DEEP (15 cues, 3 loops, `sfxSnapshot()` counters), plus full regression of pause/results/GP/records/aliases/smoke/perf/console.

**Method:** Live CDP session on `http://localhost:5173` (Vite 8.2.2, Three.js 0.185.1). Real trusted key events for all driving; autopilot only for endurance soaks and GP legs. Deterministic instrumentation via `window.__game` (`audio.sfxSnapshot()` counters, `rouletteT[]`, `draftsFired`, `hopT`, particle-pool call counts). Persistent console listener for the whole session. Smoke harness `__gauntlet/ai-smoke.html` for all three tracks.

## Overall: 8.0 / 10

The SG-11/12/13 feature set lands: roulette is honest (1.2 s spin, use-blocked, pause-frozen, position-weighted), slipstream charges/fires/cools down per pair and stacks with boost, the drift hop is a clean visual-only pop, the ultra tier is real, every SFX counter in `sfxSnapshot()` fires, all three loops start/stop correctly, and the GP/records/pause regression surface is intact with a clean console at 68 fps.

What costs the score is a coherent blind spot in `src/core/Audio.ts`: its edge-detector memory (`wasGrounded`/`airPeak`, `rouletteWasSpinning`, `lastDrafts`, `lastDriftDir`/`lastDriftCharge`) is never re-seeded across race resets, and `Kart.reset()` leaves `vy`/`grounded`/`airTime` stale. Every quit/restart/respawn edge therefore fires a phantom cue — a land thud on the title screen, a roulette "item landed" ding with no item, a draft whoosh in the countdown, a turbo whoosh for a release that never happened. Four separate triggers, one family, all low-severity but all reproducible on demand. A HUD gating nit rounds out the table.

## Defects

| # | Sev | Defect | Repro | Evidence | Suspected source |
|---|-----|--------|-------|----------|------------------|
| D1 | LOW | **Phantom landing thud + dust after quitting/respawning airborne.** Airborne kart → `Q` to title (or Backspace respawn) → `land` counter +1 and a dust burst at the spawn point while already on the title screen / mid-materialize. | Start race, launch airborne (SR crest, or `kart.position.y += 8` with `airTime > 0.22`), press `Q`, wait ~1 s. Observed `{"phase":"title","landBefore":107,"landAfter":108,"PHANTOM":true}`. Respawn path: `land` +1 immediately at the spawn point, not at natural touchdown ~0.8 s later. | `sfx-proof.json` deltas; session probes | `Kart.reset()` never clears `vy`/`grounded`/`airTime` — `src/game/Kart.ts:442-469` vs fields `89-91`; landing branch consumes stale `airTime` at `Kart.ts:709-727`. Audio `wasGrounded`/`airPeak` never re-seeded — `src/core/Audio.ts:52-53`, edge at `815-841`; `audio.update` runs unconditionally incl. title — `src/core/Game.ts:815-823`. |
| D2 | LOW | **Phantom roulette "item landed" ding on restart/quit mid-spin.** Pick up a box, press `R` or `Q` within the 1.2 s window → `rouletteLand` ding plays during the countdown / on title even though `items.reset()` voided the spin. | Box pickup → `R` inside 1.2 s → `rouletteLand` tag +1 in countdown (observed 5→6 on restart, 7→8 on quit). | Session probes; `sfx-proof.json` | `rouletteWasSpinning` stays `true` through `items.reset()`; next update sees `spinning=false` and fires the land edge — `src/core/Audio.ts:911-924`; `Items.reset()` at `src/game/Items.ts:415`. |
| D3 | LOW | **Phantom draft whoosh on restart after a real slipstream.** Fire a draft burst, press `R` → `draft` whoosh plays during the next countdown because `draftsFired` reset 3→0 counts as a "change". | Draft until `draftsFired > 0` → `R` → `draft` tag +1 with `draftsFired` back at 0. | Session probe; `sfx-proof.json` | `src/core/Audio.ts:881-884` fires `draftWhoosh()` on *any* `draftsFired !== lastDrafts` — should require an increase (and probably `phase === 'racing'`). |
| D4 | LOW | **Phantom turbo-release whoosh when a charged drift ends by spin-out while an unrelated boost is live.** Pad/item boost → drift ≥0.45 s charge → missile/slick spin-out mid-slide → `turbo:0` whoosh plays for a release the kart never paid. | Instrumented: latched drift (`chg 0.53`), set `boostTimer = 1.5`, `spinUntil = t+1` → `turbo:0` +1 (`PHANTOM_TURBO:true`). Real-world trigger: pad boost into a drift, then get tagged. | Session probe | `src/core/Audio.ts:858-876` — the release detector keys on `lastDriftDir !== 0 && kart.boostTimer > 0 && lastDriftCharge >= tier[0]`; the spin-out path (`Kart.ts:~495-497`) clears `driftDir`/`driftCharge` but preserves `boostTimer`, so a pad boost reads as a release. Needs `!kart.isSpinning` (or a release flag from the kart). |
| D5 | NIT | **Post-finish roulette spins invisibly but audibly.** After the player finishes, the kart still drives and can pick up boxes — roulette ticks and the land ding still play, but the HUD slot is gated to `phase === 'racing'`, so the player hears a roulette they can't see. | Finish a race, drive over a box on the results screen → `rouletteTick`/`rouletteLand` counters advance with no slot UI. | Counter deltas; code read | `src/core/RaceHud.ts:348` (`race.phase === 'racing'` gate on the item slot) vs `items.update` not phase-gated. |

### Observations (not counted as defects)

- **Draft cone is 2D** (`setY(0)` on the gap vector in the wake test) — an airborne follower is geometrically eligible to charge a draft. Couldn't demonstrate `draftT` accruing mid-air in-session (leader-state confounded the probe); theoretical only, harmless if it ever fires since the burst still obeys the cooldown.
- **Ambient motes render on title/attract** on all three tracks (SR embers verified ~12 live particles parked on title). Reads as intentional set dressing — flagged only because the spec didn't say.
- **Ultra tier is rare by design**: all session (4 races + soaks incl. AI) produced `charge:2` ×1 / `turbo:2` ×1 vs `charge:0` ×136 / `turbo:0` ×128. Reachable, matches "longest sweeper holds only", but expect most players to never see violet.
- **Tier-3 screenshots are counter-backed, not hero shots** — `turbo:2`/`charge:2` prove the tier fired; the captured frames show the violet-tier state but the live latch window was too short for a clean action still.

## Verified working

**Roulette (SG-11):** position-weighted `roll()` at pickup; `ROULETTE_S = 1.2` spin with fast→slow icon flips (`rouletteTick` ×287); `use()` returns null mid-spin (item truly blocked); second box stays uncollected while spinning/holding; pause freezes `rouletteT` dead (timer + ticks frozen, PAUSED overlay, resumes and lands + ding on unpause — `c20-roulette-paused.png`, `c20-roulette-midspin.png`); restart/quit clear all slot state.

**Slipstream (SG-11):** `draftT` charges only inside the leader's wake cone; burst fires at ~0.9 s → `slipstreamT = 1.3` with `draftBoostSpeed` added on top of `boostSpeed` (stack confirmed `Kart.ts:514-519`); 4 s per-pair cooldown holds then re-arms; spinning leaders excluded; AI karts draft each other (`draftsFired [0,3,7]`); wind layer rises with the burst and decays to 0 — no leak after quit (`wind 0.086 → 0`).

**Drift hop + turbo (SG-11):** entry hop is visual-only — `hopT` arc peaks `hopY ≈ 0.29–0.30` while `position.y` is untouched (`c20-race-sr.png`, `game-drift-hop.png`); hop chirp on entry; charge accrues only while genuinely sliding (`fwdSpeed > 12`, `|slipAngle| > 0.1`); tiers at 0.45/1.1/1.9 s with per-tier blips; release pays `boostTime[tier]` (0.7/1.4/2.4 s) via `Math.max` so a weak release never downgrades a live pad boost (`Kart.ts:581`); tier-pitched `turboRelease` per tier (`turbo:0/1/2` all observed).

**VFX (SG-12):** real swap → exactly two `teleportBurst` calls at both exchange endpoints (`tpCalls:2` at `[11.5,0,5.2]`); swap vs all-finished field correctly fizzles with zero bursts; `padFlash` on boost pads; `materialize` at respawn; `landingDust` on touchdowns (364 calls); `rouletteGlint` while slots spin (4 871 calls); screen-space slipstream streaks with NDC-rotated orientation (`c20-slipstream-streaks.png`); track-themed ambient motes — SR embers confirmed live on title (`c20-title-sr-ambient.png`), NN/PG title shots captured.

**SFX (SG-13):** every counter in `sfxSnapshot()` observed firing — `beep 54, go 18, lap 11, finalLap 9, fanfare 6, crowd 6, champion 1, posUp 156, posDown 222, pickup 626, rouletteTick 287, rouletteLand 23, launch:{boost 171, missile 96, slick 94, shield 101, ink 66, swap 42}, spinout 46, shieldPop 20, inkHit 92, pad 104, hop 141, charge:{0:136, 1:7, 2:1}, turbo:{0:128, 1:6, 2:1}, draft 16, bump 336, wallHit 229, land 123, respawn 3, ui{Confirm 20, Back 16, Tick 4}`. Loops: scrape tracks wall-grind speed >4 m/s and decays to 0 off-wall; rumble is gravel-only and dies on tarmac; wind follows the draft burst and dies after; all loops duck under pause (`!paused` term in every target). Position stingers seeded on GO transition so the start can't fire a phantom move (`Audio.ts:927-934`); 378 stingers over ~50 min of traffic play — no spam.

**Regression:** pause gated to countdown/racing; PAUSED overlay hides under options/results; results screen Enter/R/Q/Esc all behave; full 3-leg GP — all four racers finish every leg, standings + `champion` ×1, Enter advances legs, Enter on the final table starts a fresh cup leg 1 on PG (`c20-gp-leg1/2/3/final.png`, `c20-title-gp.png`); title re-arm clean; records persisted (`{0:19.47, 1:22.02, 2:22.41}`); blur → auto-pause holds (sim frozen on `blur`); keyboard aliases (arrows, ShiftRight, Enter/Esc) verified live, gamepad bindings present in HUD hints (`RaceHud.ts:278`).

**Smoke baselines (exact match):** PG `22.69/19.22/18.12`, SR `26.42/22.46/21.62`, NN `25.54/21.61/20.90`; stalled 0, wall hits 0. Traffic `lockedPct`: PG 8 %, SR 7.1 %, NN 6 %.

## Performance

NN mid-race, 550-frame sample: mean **14.65 ms** (68.3 fps), p50 14.6, p95 **15.3**, p99 15.6, frames >16.7 ms: **0**. Heavy-VFX sample (spark 47 / smoke 39 / star 16 / streak 23 live): mean 14.72, p95 15.3, p99 15.7, 0 over budget — 957 draw calls / 132 841 tris. Target ≥55 fps / p95 ≤16.6 ms: **met with margin**.

## Console

Zero errors, zero warnings across the entire session — persistent listener buffer empty (`__conLog: []`) through 4+ races, a full GP, pause/quit/restart cycles, and every defect probe above. Only Vite debug connection noise.

## Evidence index

`docs/gauntlet/evidence/wave20/` — fresh: `c20-title-nn.png`, `c20-title-sr-ambient.png`, `c20-title-gp.png`, `c20-roulette-paused.png`, `c20-roulette-midspin.png`, `c20-slipstream-streaks.png`, `c20-tier3-sparks.png`, `c20-tier3-release.png`, `c20-race-sr.png`, `c20-gp-leg1.png`, `c20-gp-leg2.png`, `c20-gp-leg3.png`, `c20-gp-final.png`; supporting: `sfx-proof.json`, `game-*.png`, `int-vfx-*.png`, `vfx-slipstream-streaks.png`.

## Suggested fix direction (one root cause, four symptoms)

Re-seed all transition-detector memory on race transitions rather than chasing each cue: an `Audio.onRaceReset()` (or a `phase !== 'racing'` guard) that snaps `wasGrounded = kart.grounded`, `airPeak = 0`, `rouletteWasSpinning = false`, `lastDrafts = kart.draftsFired`, `lastDriftDir/lastDriftCharge = 0` whenever `restartRace`/`buildWorld` runs — plus clear `vy`/`grounded`/`airTime` in `Kart.reset()` (`Kart.ts:442-469`) and add `!kart.isSpinning` to the turbo-release detector (`Audio.ts:861`). That closes D1–D4 together.
