# Grok Bot Kart

An original browser-based kart racer built with Three.js + TypeScript + Vite.
Three authored circuits, Grand Prix mode, items, AI opponents, banked corners,
gamepad support, and remappable controls.

**Play:** https://fubak.github.io/bot-kart/

## Controls

| Input | Action |
|---|---|
| WASD / arrows | drive |
| Shift | drift |
| Space | use item |
| P | pause · R restart · Q quit · Backspace respawn |
| M | reduce motion · O options · T track select |

## Develop

```bash
npm install
npm run dev        # dev server (localhost:5173)
npm run build      # typecheck + production build → dist/
npm run preview    # preview the production build
```

Every push to `master` builds and deploys to GitHub Pages via
`.github/workflows/deploy-pages.yml`.

## Layout

- `src/` — game code (`core/` engine + HUD + audio, `game/` track/kart/items/AI/props)
- `assets/` — generated textures, Blender sources, exported GLBs, media + prompt provenance
- `__gauntlet/` — dev QA harness (AI smoke, profiling, console monitors)
- `docs/gauntlet/` — quality-gate records, evidence, registries
- `scripts/` — asset pipeline + dev tooling
