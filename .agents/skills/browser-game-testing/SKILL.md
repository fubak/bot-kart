---
name: browser-game-testing
description: Drive the running game deterministically with playwright-cli for QA — navigation, input, screenshots, video, console/network capture. Use for automated browser verification.
allowed-tools:
  - exec
  - read
  - write
  - edit
  - grep
  - glob
---

# Browser Game Testing

`playwright-cli` 0.1.19 is installed globally and uses the system **Chrome**
by default (`--browser=firefox|webkit|msedge` also supported). A full
reference skill lives at `%APPDATA%\devin\skills\playwright-cli\` with
per-topic guides under `references/`.

> **Playwright automation does not replace actual visual inspection of the
> WebGL game.** It drives and captures; a critic still has to look.

## Launch the game

```bash
npm run dev                              # http://localhost:5173
playwright-cli open http://localhost:5173
```

## Deterministic navigation

```bash
playwright-cli snapshot                  # element refs (e5, e12, ...)
playwright-cli find "Start Race"         # search snapshot for text/regex
playwright-cli click e5                  # act on a ref
playwright-cli fill e3 "player name" --submit
playwright-cli press Enter / ArrowRight
playwright-cli keydown Shift             # held-key input for driving tests
playwright-cli keyup Shift
```

Named sessions keep state across commands; close with `playwright-cli close`
or `close-all`/`kill-all` to reset.

## Capture evidence

```bash
playwright-cli screenshot --filename=shot.png [--hires]
playwright-cli video-start race.webm
playwright-cli video-stop
playwright-cli snapshot --filename=state.yml
```

Artifacts land in `.playwright-cli/` (gitignored).

## Console + network monitoring

```bash
playwright-cli console                   # all messages; 'console error' filters
playwright-cli requests                  # network log
playwright-cli request 5                 # single request detail
```

## Scripting + machine output

```bash
playwright-cli eval "document.title"
playwright-cli --raw eval "JSON.stringify(performance.timing)"
playwright-cli eval "el => el.textContent" e5
playwright-cli --json <command>
```

## Resolution / device testing

```bash
playwright-cli resize 1920 1080
playwright-cli open --mobile
playwright-cli open --device="iPhone 15"
```

## Determinism

- If a seeded RNG exists (future architecture decision), drive scenarios via
  `eval` to set the seed before each run.
- Prefer `run-code`/`eval` hooks over pixel-timing assumptions.

## Limits

- Snapshot refs describe the DOM/accessibility tree — a WebGL canvas is one
  opaque element. Inside-canvas state needs `eval`/`run-code` against the
  game's own debug hooks (expose a `window.__game` handle early — see
  `docs/gauntlet/DECISIONS.md`).
- For deeper inspection (perf traces, heap, network detail) use the
  `chrome-devtools` MCP — see `performance-profiling` skill.
