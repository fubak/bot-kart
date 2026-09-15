# CRITIC REPORT — WAVE 17

**Commit under test:** `39873a2` — FIX-007: critic-16 batch (results pause gate, focus theft, ties)
**Date:** 2026-03-16 · **Build:** dev server :5173, Chrome 152.0.7977.83, three.js 0.185.1
**Verdict:** ❌ **NOT CLEAN** — one MEDIUM race-integrity defect found (repeatable, player-exploitable, corrupts persistent lap records).

## Score: 7.7 / 10

The FIX-007 changes all verified, and the broad regression sweep held up well — but swap-item resync grants free laps and writes unbeatable records, a defect class equal-or-worse than last wave's MED.

---

## Defects

| Sev | Defect | Repro | Evidence |
|---|---|---|---|
| **MED** | **Swap-item teleport + `resync()` grants ~a free lap and writes unbeatable lap records.** `RacerProgress.resync()` (`src/game/Race.ts:142-154`) rebases `progressIdx = lapBase + i` and auto-marks every gate below it — the kart never crossed those gates. When a swap (`src/game/Items.ts:261-295`) lands a kart near the line, the next crossing counts a lap that was ~95% teleported. Saw it **twice organically**: NN leg-3 lap of **6.33s** (written as the track record, `★REC` on results row) and SR leg-2 lap of **2.33s**. Deterministic repro: enter lap 2, `racers[0].resync(pos, ~1000)` → `progressIdx 1235→2024`, gates auto-filled → crossing at raw idx ~10 incremented lap. Player-exploitable: fire/await swap while a rival is just short of the line. Records pollute `grok-kart-records` localStorage permanently (an unbeatable 0:02.33). | GP race → let AI swap fire near its line; or deterministic resync above | `c17-leg3-results.png` (YOU `best 0:06.33 ★REC`), `c17-final-standings.png`, probe log `progressIdx 1235→2024, lap 2→3` |
| LOW | **`R` on GP leg-results replays the same leg** — not advertised in the footer (`[N] next race · [Q] abandon cup`). Restarting leg 2 keeps leg-1 points but re-rolls leg 2 — lets a player farm a bad leg. Consistent behavior, just unadvertised and mildly exploitable. | Finish GP leg 2 → press `R` on results | `c17-leg2-results.png`; verified: `gpLeg` stayed 1, leg-1 points kept, fresh countdown on same track |
| NIT | **Disarming GP mode resets `trackIdx` to 0 silently** — `cycleTrack(0)` at `src/core/Game.ts:436` when `gpMode=false`. T→Neon, G on, G off → back at PROVING GROUNDS. | Title: T×2, G, G | DOM `c17-title-gp.png` vs post-disarm `grok_track=PROVING GROUNDS` |
| NIT | **gpFinal double-tie falls back to racer index** — if both points AND final-leg `positionOf` tie (requires a same-tick finish on leg 3), champion picks whoever is earlier in the racer array. Rare + no better signal exists, but array order is arbitrary. | Engineered 20/20 + same-tick P1 | `src/core/RaceHud.ts:362` sort comparator |

---

## FIX-007 verification — all hold

| Change | Result |
|---|---|
| `P`/`Esc` gate now `racing‖countdown` only | ✅ `P` on results: phase stayed `finished`, `paused=false`, sim advancing, `N` still worked → next leg countdown. `Esc` on results: no quit. |
| Mid-race pause | ✅ `P` toggles overlay, sim frozen, resume clean. Countdown pause freezes at `cd=2.33`. |
| `O`→`Esc` on results | ✅ Options closes, `display:none`, sim advances, `N` advances. Pause overlay correctly suppressed on `finished`. |
| `preventDefault` Tab/Space/arrows | ✅ Bubble-phase probe (after game handler): `defaultPrevented:true` for Tab/Space/all 4 arrows. `document.hasFocus()` stayed true; `activeElement` stayed BODY; held keys not dropped mid-race. |
| Same-tick tie → shared `positionOf` for display AND award | ✅ Forced two AI to identical `finishTime=316.50`: both rendered `P2`, both awarded `+7→7` (not +10/+7 split). `c17-leg1-tie.png` shows `P2 BOT-C` + `P2 BOT-A2`. |
| GP champion tiebreak = final-leg position | ✅ Verified twice. Engineered 22/22: `BOT-C` champion over `BOT-B` via leg-3 P1 (array order would have picked B). Natural 20/20: B over YOU via leg-3 P1. `c17-final-standings.png`, `c17-final2.png` — ★ crown marks champion. |
| Shadow map `1536²` | ✅ `castShadow:true`, `shadow.mapSize.width=1536` |
| Yaw floor ~0.5 rad/s @ 3 m/s | ✅ Valley min **0.507 rad/s** in 3.5–4 m/s band (tick-aligned sampling, autopilot off, straight section). |
| Results rows nowrap | ✅ `white-space:nowrap` inline on every row; tables render clean. |

---

## Fresh edge-case hunt

| Probe | Result |
|---|---|
| GP abandon → single-race bleed | ✅ Clean: `gpMode=false`, gp rows gone, footer `[R] restart · [Q] title`. `c17-postabandon-results.png` |
| Cup restart during leg-2 results (`R`) | ⚠️ Works but unadvertised → LOW above. Replays leg 2 with leg-1 points intact. |
| Title `T` during GP results | ✅ No-op (title-only branch), `gpLeg` unchanged |
| Gamepad menu nav | ✅ Mocked standard pad: A starts race, d-pad navigates options (row focus moves), B closes, Start pauses/resumes mid-race, 🎮 hints appear |
| Options sliders at bounds | ✅ masterVol/musicVol clamp at 0.0 (mute confirmed `masterVol=0`) and 1.0; difficulty clamps Easy↔Hard; key-rebind works, reserved-key capture denied |
| Music theme on cup transitions | ✅ `themeIdx` 0(PG)→1(SR)→2(NN) across legs; ambience beds rebuild per track |
| Item use exactly at finish line | ✅ Space just before crossing fires (BOOST activated, carried into finish); Space on `finished` is gated (held item kept, no fire) |
| Lap-record overwrite rules | ✅ Only writes on improvement (`records[track].best > t`). ⚠️ But records accept teleport-inflated laps → see MED |
| Champion celebration | ✅ ★ crown on champion row + `gpChampion()` fanfare fired (audio ctx running, `lastSfx:"champion"`), confetti bursts on finishers |
| Reduced-motion on bloom/CA | ✅ `uAberration→0` at speed with reducedMotion on; normal mode ramps. Bloom persists (correct — static glow, not a motion vector). Chase camera state follows setting |
| Minimap | ✅ Renders, `M`-toggle hides/shows canvas |
| Wrong-way + respawn | ✅ Warning appears on sustained reverse, clears after forward driving; respawn preserves score/progress, heading→tangent (dot=1) |
| `N` double-press / dead keys on results | ✅ Second `N` in countdown no-ops; `G`,`T` dead off-title; `Q` quits cleanly |
| Provisional `…` rows | ✅ Live rows show `…` for unfinished racers, re-render at 2Hz fills positions |

---

## Performance / console / GP stats

- **Perf (NN, ~10s racing):** 897 frames, **68.1 FPS**, p50 **14.7 ms**, p95 **15.6 ms** ✅ (budget ≥55fps, p95≤16.6). Caveat: 9 frames >16.6 ms, p99 16.9, worst **23.5 ms** hitch — passes p95 but a one-frame spike exists.
- **Console:** **0 game errors / 0 warnings** across all sessions. Log contains **1 exception that is my own instrumentation artifact** — an unbound `gpChampion` wrapper I injected (`<anonymous>:1:96` frame in stack) — not a game defect. Vite `[vite] connecting…` debug lines are HMR noise.
- **GP totals:** 3-leg/4-racer cup sums to **75 pts** every cup (10+7+5+3 ×3). Completed 3 full GPs end-to-end incl. champion ceremony.

## Environment state

- Dev server left running `:5173`; CDP Chrome left open `:9333` (single tab on the game). No stale browser sessions were closed this wave — only one game tab was ever open.
- Test env restored post-run: mock gamepad removed, `grok-kart-bindings` cleared (rebind test), **`grok-kart-records` cleared** (the polluted 6.33/2.33 records removed), settings reset to defaults, page reloaded → clean title, `rec=null`.
- Evidence: `docs/gauntlet/evidence/wave17/c17-*.png` (15 screenshots). Probes via `scripts/c17/c17-eval.mjs` + `scripts/c17/c17-conmon.mjs`.

## Notes (not defects)

- Player kart keeps driving during results (`allowsDrive` includes `finished`) — matches MK behavior.
- `★REC` badge inline on results rows is a nice touch; a record set on the final lap briefly flashes the toast over results — transient, arguably intentional.
- BOT-A2's `best 0:49.80` (leg-3) is an AI bad-lap, plausible, AI laps never write records.
- `F5`/dev-tool keys intentionally un-prevented (per commit).

## Bottom line

Everything in FIX-007 is solid and the game passed a wide adversarial sweep. The one remaining MED — swap-resync free laps + permanent record corruption — is a real fairness/integrity bug seen twice in normal play, deterministically reproducible, and exploitable. Fix `resync()` so gates/lap credit can't be granted for undriven progress (e.g. clamp `progressIdx` below the next unsatisfied gate, or validate the teleport distance), and add a sanity floor on record-eligible lap times.
