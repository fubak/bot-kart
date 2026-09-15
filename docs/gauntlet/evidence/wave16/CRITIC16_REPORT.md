# CRITIC-16 — Wave 16 Verification Report

**Commit under test:** `8ebe5c0` — "FIX-006: critic-15 batch — resync score rebase, results pause trap"
**Build:** live `http://localhost:5173` (Vite dev), Three.js 0.185.1
**Method:** CDP-driven live testing (port 9333), `window.__game` introspection, autopilot, instrumented `resync()`, screenshots `c16-*`
**Verdict:** **7.9 / 10** — NOT a clean pass (1 MEDIUM). The resync rebase is mathematically airtight for every reachable case and the rest of the batch verified, but the results pause trap survives through the primary key path — and the fix's own acceptance criterion ("P on results still shows PAUSED") is false in the build.

---

## Defect table

| # | Severity | Defect | Reproduction | Evidence | Source |
|---|----------|--------|--------------|----------|--------|
| D1 | **MEDIUM** | **Invisible pause on results via P/Esc → dead N.** The fix releases the pause only when *options* closes on `finished` (Game.ts:381). But `KeyP`/`Escape` still toggle `paused` in ANY non-title phase (Game.ts:396-399) while the PAUSED overlay is deliberately suppressed on `finished` (RaceHud.ts:294). Result: P or Esc on the results screen sets a real pause (simTime frozen, item/respawn/N gates closed) with zero visual feedback — the advertised `[N] next race` goes dead. The wave's verify note claims "P on results still shows PAUSED (real pause)" — it does not; no PAUSED state ever renders on results. c15 rated this trap LOW assuming "any P/Esc press clears it" — those presses now *create* it. | GP leg-2 results → `P` → simTime frozen 1.5 s (`invisiblePause:true`), PAUSED el `display:none` → `N` → phase stays `finished` (leg 3 never loads). `P` again → `N` → NN loads. Esc identical (single-race verified). | `c16-leg2-results-P.png` vs `c16-leg2-results.png` (pixel-identical, no overlay), live simTime freeze probe | `src/core/Game.ts:396-399` (ungated toggle), `:428` (`!paused` N-gate), `src/core/RaceHud.ts:294` (overlay hidden on finished) |
| D2 | LOW | **No `preventDefault` on any game-surface key — Tab steals browser focus mid-race.** `initInput` + the Game keydown handler never call `preventDefault` outside binding-capture. `Tab` → focus leaves the page (`document.hasFocus() === false`), `blur` clears held keys → kart coasts dead until the player clicks back. F5/F11/F12 likewise leak to browser chrome (F5 = full reload mid-race). | Mid-race `Tab` → `hasFocus` false. | live probe | `src/core/Input.ts:120-126`, `src/core/Game.ts:300-462` (no preventDefault on handled keys) |
| D3 | LOW | **Residual −1024 score drop survives in the pre-free-crossing window.** `lapBase = nextCross[line] − n` is correct once a back-grid kart's denied crossing is behind it — but during countdown + the first ~0.5 s after GO (`nextCross[line]` still `n`), resyncing a back-grid kart to idx <20 rebases `progressIdx = i` → score ~22 vs honest ~1046; the deficit persists all race (rankings, rubber-banding, item weights all skewed). Unreachable via gameplay — the earliest item pickup (~idx 64) lands ~3 s in, after every back-grid kart has crossed — debug-only, but it's the same ledger the c15 fix was meant to close. | `R` → during countdown `racers[2].resync(pointAt(15), 15)` → `prog:15, score:22` (honest 1039/1046 post-crossing). | live probe | `src/game/Race.ts:150-151` |
| D4 | NIT | **GP points tie → champion decided by racer index**, not results (final standings P1/P2 both 22 pts — BOT-B crowned on array order; MK uses wins/finishes). | Final standings after 3 legs. | `c16-final-standings.png`, results HTML | `src/core/RaceHud.ts:365` (points sort only) |
| D5 | NIT | **Same-tick finish tie**: `positionOf` correctly returns the same position for both (P1, P1, P3 ordering) but the table renders sequential `P{row+1}` — the tied-lower kart displays a position the points award doesn't honor. | Forced identical `finishTime` on racers 1,2 → positions `[4,1,1,3]`, rows would read P1/P2. | live probe | `src/core/RaceHud.ts:378`, `src/game/Race.ts:224` |
| D6 | NIT | **⌫ respawn clears ink for free** (also clears an active boost — the cost side). `Kart.reset()` zeroes `inkedUntil`/`inked`/`boostTimer`/`spinUntil`: a 4 s ink debuff can be cleansed for ~1–2 s of acceleration. Spin-clear was the intended c14 fix; ink-clear rides along. | `inkedUntil=+6 s` → Backspace → `inked:false, inkUntil:0`. | live probe | `src/game/Kart.ts:438-441` |
| D7 | NIT | **Cross-lap swap can move the user backward on track.** Swap exchanges raw position but preserves lap: trailing kart swapping with a lap-ahead leader at a lower raw index teleports *backward* within its own lap (~50/50 by raw index — the item backfires). Rare — needs a lapped field — but the "catch up" intent inverts. | Player (lap 1, raw 40) ↔ finished AI (lap 3, raw 566): moved forward — direction is raw-index luck; reverse case moves the user back. | live swap probe | `src/game/Items.ts:264-292` |

---

## Critic-15 fix verification

| Fix | Result |
|-----|--------|
| resync rebase `progressIdx = nextCross[line]−n+i` | **VERIFIED for every reachable case.** In-place resync preserves score **exactly** on all 4 grid slots incl. back-grid (racer2: 1221→1221, racer3: 1260→1260 — c15's 1065→41 is dead). Swap lap counting works both directions (player→finished-kart forward: single lap at line; AI↔AI backward: symmetric ±49 score exchange). Resync at idx<20 post-free-crossing: `prog = lapBase+15`, kart drives a full lap — no farm. No double-count: `progressIdx < nextCross[line]` always holds post-resync → single fire. Gates re-fire naturally next tick (verified live: mask filled after resync-forward). **Only** the unreachable pre-free-crossing window still under-bases (D3). |
| Results pause release (O→Esc→N) | **PARTIAL.** Options-close on results unpauses — O→Esc→N advanced leg 1→2 live. But the identical trap persists via P/Esc → **D1**. |
| Shadow map 1536² | **VERIFIED.** `sun.shadow.mapSize = [1536,1536]`, PCF active, ±70 m follow box → ~9 cm texels, kart ~30 texels wide — no visible blockiness expected at chase distance; race shots on all 3 tracks captured. |
| Yaw floor (pivot fade → 6 m/s) | **VERIFIED.** Dyno sweep: mean floor **0.566 rad/s @ 3.0, 0.507 @ 3.25** (spec ~0.59), recovers 0.71 @ 4.0 → 1.79 @ 7.0 — smooth 0→8 taper, mean never dips below ~0.5. The c15 0.415 valley is shallower and shifted up-speed. |
| Results rows nowrap | **VERIFIED.** `white-space:nowrap` on every row — `+10 → 22 pts` can't split (confirmed in final-standings DOM). |

## Swap / resync matrix

| Case | Result |
|------|--------|
| In-place resync, all 4 slots, lap 1 | **PASS** — Δscore = 0 exactly |
| Player forward-swap → finished kart (raw 566) | **PASS** — lap kept, single lap counted at line, honest lap time recorded |
| AI↔AI swap (racer3↔racer1, same lap) | **PASS** — symmetric ±49 exchange, mask/lap preserved |
| Back-grid resync @ idx 15 post-free-crossing | **PASS** — `prog=1039`, full lap driven, no farm |
| Back-grid resync @ idx 1010 → line crossing | **PASS** — exactly one lap (`lt 32.51`), mask rebuilt correctly |
| Back-grid resync @ idx 15 **pre**-free-crossing | **EDGE (D3)** — `prog=15`, −1024 score, permanent; unreachable via items |
| resync clears wrongWay/backwardAccum | **PASS** — `ww:false, ba:0` |

## GP end-to-end (3 legs, live)

- Leg 1 PG: player P4 (+3); Leg 2 SR: P2 (+7); Leg 3 NN: P4 (+3) → **YOU 13 pts**.
- **Final standings:** P1 ★ BOT-B 22 · P2 BOT-A2 22 · P3 BOT-C 18 · P4 YOU 13 — points sum 75 = 3×25 exact; champion crown + `FINAL STANDINGS` render; footer `[R]/[Q]`.
- O→Esc→N advances legs; world rebuild + countdown per leg; minimap stays live through transitions; results re-render updates provisional `…` rows → `P4 BOT-A2 3:30.89` observed live.
- `R` on standings → fresh countdown; `Q` mid-cup → title, cup disarmed; `Q`/`R` during countdown clean.

## Item economy

All six fire during **spin / ink / boost** states (no state gate — matches MK): boost during spin sets `boostTimer=1.4` (ticks down dead — honest); ink while inked, missile while boosting, slick mid-spin all work. AI↔AI swap exercised live. Swap with a **finished** kart works (position steal, finish locked).

## Race rules spot-checks

- **Wrong-way:** clean reversal → `wrongWay:true` (ba=37), progress **frozen** (no loss, no farm), lap unchanged. HUD shows WRONG WAY.
- **Respawn:** no progress gain/loss (tracks own index — the ±19 observed was 1 s of driving); can't skip checkpoints — the kart can't leave its corridor; clears ink/spin/boost (D6).
- **Backwards-driving scoring:** monotonic — `progressIdx` never decreases.
- **Lap records:** persist per-track across rebuilds/quit; only improve. (Cleared a critic-polluted 2.53 s PG record my debug teleports created — environment left clean.)
- **Provisional results:** `…` rows → real values on bot finish (2 Hz re-render verified live).

## Performance (Neon Night mid-race, ~10 s, single clean session)

frames 683 | **fps 68.3** | p50 14.6 ms | **p95 15.4 ms** | p99 15.6 ms | worst 15.9 ms | >16.6 ms: **0** | draws 659–1075 | tris 112k–147k

vs c15's 17.3 p95 — the 1536² trim + closed stacked sessions give real margin. **PASS.**

## Console audit

conmon persistent listener across the full session (GP legs, restarts, track rebuilds, items, pauses): **0 errors, 0 warnings, 0 exceptions** — only vite connect noise.

## What holds up

- Resync rebase is now correct for every gameplay-reachable case — the ledger math (`lapBase = nextCross[line]−n`) is sound, `nextCross`/mask preserved so behind-gates re-fire and ahead-gates must be earned.
- GP loop is airtight: leg advance, points, provisional→final rows, cup disarm, fresh-cup restart.
- Perf has genuine headroom on the heaviest scene (0 frames over budget).
- All three tracks render clean titles + race; NN night theme reads well.
- Wrong-way/lakitu/respawn recovery rules are coherent; item system robust across states.

## Environment notes

- Killed 3 stale playwright-chromium sessions (prior critics) before perf — session on :9333 kept; dev server briefly killed with it and **restarted** (`npm run dev`, back at :5173, page reloaded to title).
- Left open: the :9333 headed CDP Chrome (the shared gauntlet browser, as found), vite dev server running. localStorage records cleared (had critic-polluted fake laps).

## Score

**7.9 / 10.** The batch is real: resync is now correct everywhere it can be reached, perf improved, yaw floor raised, rows fixed, and the GP ran exact end-to-end with zero console noise. But the wave's other headline fix fails its own acceptance check — P/Esc on results still plants an invisible pause that dead-ends the cup's primary advance key, and "PAUSED" never actually shows on results as the verify note assumed (D1, MEDIUM — same trap class as c15-D2 through the front door, not the side door). Supporting LOWs: Tab/focus theft, the unreachable pre-crossing resync edge, and a handful of polish nits. Streak does not advance — wave 17 needs the pause state on results either shown or disallowed outright.
