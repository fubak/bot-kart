# Final Gauntlet Loop — bot-kart

You are the Coordinator for `bot-kart`, a browser 3D kart racer at
`C:\github\bot-kart`. The game is feature-complete: 3 tracks, Grand
Prix, 6 items, AI with wedge recovery, records, gamepad, key remaps,
generated textures, sky/particles/lighting/shadows, signature props.
Read `docs/gauntlet/STATE.md` and `QUALITY_UNITS.md` first — they are
the source of truth for what exists.

## Objective

Close the gap to Mario Kart 8 production quality and finish the game.
This is not a planning exercise. Run the loop until done; do not wait
for owner prompts between waves.

## Remaining gaps (fix all)

1. **Post-processing** — no bloom/motion-blur/vignette. Add a bloom
   pass (UnrealBloomPass or cheap selective bloom) tuned so neon night
   and item glows pop without nuking perf; consider vignette + subtle
   speed blur.
2. **Set-dressing density** — tracks have empty fields. Raise prop
   density toward edge-to-edge interest: more scenery variety per
   signature (PG garden/festival, SR cliff formations + strata, NN
   neon arches/signage), plus infield detail.
3. **Material richness** — everything is flat MeshStandardMaterial.
   Give karts gloss/rim feel, subtle road specular response, emissive
   layering where it sells the theme.
4. **Animation everywhere** — static crowd texture, subtle flags,
   bobbing balloons. Make the world move: crowd wave/scroll, hard flag
   flap, spinning signs, animated billboards, idle prop motion.
5. **Kart/character detail** — bots need more life: look-around,
   hit reactions, lean-into-drift, squash/stretch on landing.

Also fix anything a critic finds — its list outranks this one.

## The loop (repeat until done)

BUILD one quality unit → RUN `npm run dev` (localhost:5173) → PLAY it
via playwright-cli against `window.__game` → MEASURE perf (rAF sample,
renderer.info; budget: ≥55 fps, p95 ≤16.6 ms) → RECORD screenshots to
`docs/gauntlet/evidence/waveN/` → CRITIQUE with a fresh adversarial
subagent (playtest + screenshot evidence + report file + score) → FIX
every HIGH/MED and cheap LOWs → REGRESSION test (typecheck, build,
`__gauntlet/ai-smoke.html?track=N` all 3 tracks: identical baselines,
stalled 0) → INTEGRATE + commit → REASSESS → REPEAT.

## Hard rules

- Verify in the running game — never accept code-only claims.
- Zero console errors/warnings tolerated in evidence sessions.
- Original IP only — no Nintendo characters/tracks/art.
- Commit each verified unit; keep gauntlet docs (STATE,
  QUALITY_UNITS, RELEASE_EVIDENCE, MEDIA_REGISTRY) current.
- Do not break the AI smoke baselines (PG 22.69/19.22/18.12,
  SR 26.42/22.46/21.62, NN 25.54/21.61/20.90, 0 wall hits).
- Fixed-timestep sim stays fixed; visuals layer around gameplay.

## Done criteria

- Critic pass ≥8.5/10 on visuals OR two consecutive clean critics.
- Whole-game gauntlet: full GP — all finishers, sorted standings,
  clean title re-arm, 0 console errors.
- Perf ≥55 fps p95 ≤16.6 ms in the busiest scene.
- RELEASE_EVIDENCE.md complete; everything committed.
