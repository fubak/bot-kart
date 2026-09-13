---
name: game-quality-gate
description: Verify any game change in the actual running game before accepting it. Use whenever reviewing Builder claims, accepting a quality unit, or judging visual/gameplay work.
allowed-tools:
  - exec
  - read
  - write
  - edit
  - grep
  - glob
  - mcp_call_tool
  - browser_preview
---

# Game Quality Gate

> **Visual/gameplay work is never accepted based only on the Builder's summary.**

Acceptance requires evidence captured from the real running game by *you*
(the critic/verifier), not from the Builder's report.

## Procedure

1. **Start the app**

   ```bash
   npm install        # if node_modules missing
   npm run dev        # Vite dev server (default http://localhost:5173)
   ```

2. **Open the rendered game.** Use the `browser_preview` tool for interactive
   sessions, or drive Chrome via playwright-cli / the `chrome-devtools` MCP:

   ```bash
   playwright-cli open http://localhost:5173
   playwright-cli snapshot
   ```

   MCP equivalent: `mcp__chrome-devtools__new_page` → `take_snapshot`.

3. **Check console errors** — zero tolerance for unhandled errors/warnings
   introduced by the change:

   ```bash
   playwright-cli console            # or console error
   # MCP: mcp__chrome-devtools__list_console_messages
   ```

4. **Enter gameplay.** Navigate menus to the actual race/game state the unit
   touches. If the game needs input, send real input (`press_key`, `click`,
   or `playwright-cli press ArrowRight` etc.).

5. **Control the game.** Exercise the feature under review — accelerate,
   steer, drift, trigger the item, etc. Do not judge from a static screen.

6. **Evaluate actual output.** Compare what the game *does* against the
   unit's spec in `docs/gauntlet/QUALITY_UNITS.md` — not against what the
   Builder intended.

7. **Capture evidence.** Attach artifacts to your verdict:

   ```bash
   playwright-cli screenshot --filename=evidence-<unit>.png
   playwright-cli video-start evidence-<unit>.webm   # for motion
   playwright-cli video-stop
   # MCP: mcp__chrome-devtools__take_screenshot
   ```

8. **Measure performance** when the unit touches the frame loop or rendering —
   see `performance-profiling` skill.

9. **Test neighboring systems.** A change to steering also touches grip,
   camera, and collision. Probe the neighbors.

10. **Verdict.** Record in the unit's registry entry: score, evidence paths,
    largest gap. Distinguish clearly: *Builder claimed X; observed Y.*

## Project commands (confirmed)

| Action | Command |
|---|---|
| Install | `npm install` |
| Dev server | `npm run dev` (port 5173 default) |
| Build + typecheck | `npm run build` |
| Typecheck only | `npm run typecheck` |
| Toolchain check | `npm run check:toolchain` |
| Dashboard | `http://localhost:5173/__gauntlet/` |

## Reject when

- Console shows new errors.
- Claimed behavior is not observable in-game.
- No captured evidence exists.
- The change regressed a neighboring system.
