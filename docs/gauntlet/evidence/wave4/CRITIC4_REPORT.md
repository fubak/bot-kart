# CRITIC 4 REPORT — Grok Bots Kart Racing (adversarial playtest, wave 4)

## Verdict: **7.5 / 10**

A genuinely complete, well-engineered kart racer: full Grand Prix with correct
points/standings, six working items, three distinct tracks with elevation,
gravel and a day/night theme, a real key-rebind system with persistence, clean
pause/options modal behavior, healthy AI, a spotless console and comfortable
performance headroom. It is a clear step above average.

It is not yet "professional studio" polished. An adversarial pass surfaced one
**HIGH** feedback-corruption defect in the wall-contact model (the kart reports
top speed / max FOV / full engine rev while parked nose-first against a wall,
and the built-in stuck-recovery hint is defeated by it), a **MED** rebinding
footgun that is easy to trigger accidentally, and a handful of stale-hint /
robustness gaps. Nothing crashes or soft-locks, and every prior reported defect
still holds fixed — but a professional bar would not ship the wall-velocity lie
or let a player bind throttle onto the brake arrow.

---

## Verified working

- **Fresh load / title** — renders cleanly, orbit camera sweeps the scene
  (~5.5 m over a timed sample), controls hint visible, `Enter` starts.
  `critic4-title.png`
- **Options on title + in-race** — `O` opens in both contexts; in-race it
  pauses the sim and is fully modal (menu arrows adjust rows, kart does not
  drive). `critic4-options-title.png`
- **Key rebinding** — six remappable actions; bind-row capture arms on
  `→`/`Enter`; `THROTTLE` rebound `W→I` drove and started the race on `I`;
  rebound key persists across reload via `grok-kart-bindings`; `RESET`
  restores defaults and clears storage; displacing a key onto another action
  clears the old one to `—`; `Escape` cancels capture; reserved system keys
  (`P`,`O`,`Q`,`R`,`N`,`M`,`T`,`Esc`,…) are rejected.
- **Mid-race rebind takes effect immediately** — rebound `THROTTLE→KeyJ`
  while paused+options mid-race, unpaused, `J` drove (`v≈28`) and `W` was
  correctly dead (only residual coast).
- **Corrupt storage is graceful** — non-string values (`123`,`null`) in
  `grok-kart-bindings` fall back to defaults; malformed JSON throws into the
  `catch` and defaults stand.
- **All 3 tracks raced to completion** — lap counting, live positions and
  results all correct on Proving Grounds, Switchback Ridge and Neon Night;
  item boxes present and collectible on each.
- **Switchback Ridge** — real elevation variation; gravel zones on both the
  right (`~0.50–0.52`) and left (`~0.70–0.72`) inside-cuts; clean laps
  (~27.6 / 23.8 / 23.9 s). `critic4-sr-race.png`
- **Neon Night** — dark environment with visible headlamp glow, minimap and
  item HUD; folded switchback probed at fractions `0.52–0.63` and the
  continuity-aware `nearestIndexNear` held the correct leg (no foldback
  beaching). Clean laps ~22 s. `critic4-neon-race.png`
- **Grand Prix end-to-end** — `G` arms a 3-leg cup (PG→SR→NN); `N` advances
  all three legs; leg results show `+pts → running total` (10/7/5/3); final
  standings sorted by cup points with the champion marked `★`; `Q` returns to
  a fresh `GRAND PRIX — leg 1/3` (no "leg 4/3", no stale cup).
  `critic4-gp-final.png`
- **Pause** — `P`/`Esc` freeze racing *and* the countdown (countdown held at
  ~2.88 s); options only via `O`; `N` does **not** advance while paused on
  results (prior fix holds); `R` unfreezes.
- **Countdown** — cycles `3 3 3 3 2 2 2 2 1 1 1 GO!` then `racing`.
- **All six items** — boost, missile, slick, shield, ink, swap each collected
  and fired with `Space`; HUD glyph appears; a staged shield correctly
  absorbed a hit (consumed, no spin); slick spun an unshielded kart; ink set
  `inked` + overlay; swap changed position; restart cleared the held item.
- **AI** — three rivals finish every race; rubber-band keeps the pack within
  a few seconds on clean runs; no >10 s wedge deadlocks observed. On
  Switchback, BOT-C's best lap (`18.13 s`) was ~2 s faster than the field —
  consistent with it using the gravel inside-cuts. `critic4-results.png`
- **Wall grind** — lateral grinding scrubs speed (~5.5 m/s) with no infinite
  bounce; `Backspace` respawns onto the racing line (lateral offset ~0.16,
  speed 0).
- **Wrong-way** — reversing across the line pops the warning.
  `critic4-wrongway.png`
- **Restart / quit** — `R` mid-race resets positions and held items; `Q`
  returns to a clean title.
- **Console** — `0` errors, `0` warnings (only Vite HMR debug lines).
- **Performance** — well under budget on every track:
  Proving Grounds `169 calls / 34.8k tris`,
  Switchback `454 / 66.2k`, Neon `146 / 34.3k`
  (bars: `<600` draws, `<80k` tris).

---

## Defects (by severity)

### HIGH

1. **Wall-contact velocity runaway — parked kart reports top speed, defeats
   the stuck hint, and stores a free launch.**
   *Repro:* on a straight, drive nose-first into the outer wall and hold
   throttle. Position freezes at the boundary, but `kart.speed` climbs to the
   `28 m/s` cap, chase-camera FOV opens to `74°`, engine pitch revs to max and
   the wheels spin — the game insists you are flat-out while stationary.
   Worse, the `STUCK? ⌫ respawn` hint (`Game.ts:455` gates on
   `kart.speed < 1.5`) never appears precisely when a beached player needs it.
   The stored 28 m/s also releases as a slide the moment you steer parallel —
   a small charge-and-launch exploit.
   *Root cause:* `Kart.ts:437` wraps the **entire** contact response — outward
   -velocity removal *and* the sustained-grind scrub/cap — in `if (d > 1e-5)`,
   where `d = |before − constrained|`. Once the kart sits exactly on the
   clamp, `constrain` returns the same point, `d≈0`, and the whole branch is
   skipped while throttle keeps integrating hidden velocity.
   *Evidence:* `critic4-defect-nosein-velocity.png`

### MED

2. **Universal-alternate keys are capturable → dual-function or
   self-cancelling controls (and the capturable keys are the menu-nav keys).**
   `bindKey` (`Input.ts:56-62`) only de-duplicates against the six remappable
   actions, while `pollInput` (`Input.ts:110-115`) *always* ORs in
   `ArrowUp/Down/Left/Right` and `ShiftRight`. Binding any action to one of
   those codes makes it fire two things at once:
   - `BRAKE→ArrowUp`: ArrowUp is still the hardcoded throttle → holding ↑ is
     throttle **and** brake → kart crawls at ~0.4–0.6 m/s.
     `critic4-defect-arrowup-dualbind.png`
   - `THROTTLE→ArrowDown`: ArrowDown is still the hardcoded brake → holding ↓
     oscillates ~2.3–8.9 m/s (verified live).
   - `STEER RIGHT→ArrowLeft` (same trick) cancels itself to `0` net steer.
   Because the arrows are *also* the options-menu navigation keys, a player
   exploring the very menu that arms capture can produce this by accident.
   *Fix:* reject universal alternates during capture, or drop a code's
   hardcoded fallback once it is explicitly assigned elsewhere.

3. **Key hints don't follow rebinding — the HUD actively misinstructs.**
   - Item HUD is hardcoded `[space]` (`RaceHud.ts:247`): with `ITEM→KeyJ`,
     the HUD reads `✹ MISSILE [space]` but `Space` does nothing and `J` fires.
     `critic4-defect-item-hud-space.png`
   - Stuck hint hardcodes `S reverse` (`RaceHud.ts:71`).
   - Title hint is a static `WASD / arrows … SHIFT …` string
     (`RaceHud.ts:93-96`) that ignores the live bindings.

### LOW

4. **`M` is advertised on the title hint but dead there.** The title key
   block returns before the `KeyM` handler (`Game.ts:216-247` swallows it;
   handler at `270-273` is unreachable in `title`). Verified: on a clean
   title, `M` left `reducedMotion` `false→false`. In-race it toggles fine.
   Either make `M` global or drop it from the title hint.

5. **Options renders on top of the `PAUSED` overlay in-race.** Functionally
   correct modal behavior, but the translucent panel lets the big `PAUSED`
   read through behind it — visually untidy.

6. **Reserved-key rejection is silent.** With capture armed, pressing a
   reserved code (e.g. `KeyP`) does nothing and leaves capture armed with no
   "key not allowed" feedback — reads as a hang until you press a valid key.

7. **A malformed-but-string stored binding kills an action silently.**
   `{"drift":"BogusCode"}` is `typeof 'string'` so `Input.ts:49` accepts it;
   the row shows `BOGUSCODE` and drift is dead until `RESET`. Validate codes
   (or the action) on load.

8. **`Esc` doesn't close options on the title screen** — only `O` toggles it
   there (`Game.ts:233`), while in-race `Esc`/`P`/`O` all close
   (`Game.ts:253`). Minor inconsistency.

---

## Polish notes

- Corrupt localStorage, absent storage and odd value types are all handled
  without a throw — genuinely robust loading.
- GP presentation is strong: `+pts → total` per leg, sorted final standings,
  `★` champion, and a correctly re-armed `leg 1/3` after quitting — the prior
  stale-cup / "leg 4/3" fix holds.
- Bot-C's ~2 s-a-lap advantage on Switchback reads as the gravel-shortcut
  behavior working as intended.
- Night track has real atmosphere (headlamp glow, dark palette) at the lowest
  draw-call count of the three.

## Top 3 fixes

1. **Fix the wall response** (`Kart.ts:437`) — compute the contact normal from
   the constraint geometry (or the track frame's lateral axis) and always
   remove outward velocity on `c.clamped`, instead of gating on a near-zero
   position delta. Restores honest speed/FOV/audio, re-enables the stuck hint
   and removes the charge-and-launch exploit.
2. **Make binding capture collision-aware** (`Input.ts`) — reject the
   hardcoded universal alternates (arrows + `ShiftRight`) during capture, or
   drop a code's fallback once explicitly bound elsewhere.
3. **Thread live bindings into every key hint** — item glyph
   (`RaceHud.ts:247`), stuck hint (`RaceHud.ts:71`) and the title hint
   (`RaceHud.ts:93-96`) should render `keyName(bindings.*)` instead of
   hardcoded strings, and make `M` work on the title or remove it from the
   hint.
