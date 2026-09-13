# Toolchain — Confirmed Environment

Everything in this file was validated on **2026-09-13** during repository
initialization. Do not assume capabilities beyond what is recorded here;
re-verify with `npm run check:toolchain` (CLI tools) or `devin mcp list`
(MCP servers) when in doubt.

Paths below use the machine's layout. Portable tools live under
`C:\Users\bradm\.local\` and are on the user PATH (new processes only —
restart your shell/Devin session if a tool is not found).

---

## Devin

**Status:** Available
**Version:** Devin Desktop (bundled CLI; internal to the Devin app)
**Invocation:** This agent. Standalone CLI binary is not on PATH.
**Authentication:** Configured (Devin Desktop session)
**Purpose:** Primary execution agent for all gauntlet roles.

### Confirmed Capabilities

- Project skills: `.agents/skills/<name>/SKILL.md`, `.devin/skills/<name>/SKILL.md`
- User-scope skills: `%APPDATA%\devin\skills\<name>\SKILL.md` (e.g. `playwright-cli` skill installed there)
- MCP config files: user scope `%APPDATA%\devin\mcp_config.json`; project scope `.devin/mcp_config.json`; local overrides `.devin/mcp_config.local.json` (gitignored, for secrets)
- MCP management: `devin mcp add/list/remove/login` (requires standalone CLI session)
- MCP tools are namespaced `mcp__<server>__<tool>` and can be permission-gated

---

## Managed Devins

**Status:** Available (platform capability)
**Invocation:** Launched by the Coordinator Devin via the Devin platform.
**Purpose:** Long-running autonomous Builder/Critic/etc. sessions.
**Notes:** Coordinator owns session lifecycle. No local command validates this;
it is a property of the owner's Devin provision.

---

## Git

**Status:** Available
**Version:** 2.47.1.windows.1
**Invocation:** `git`
**Authentication:** via GitHub CLI credential manager (https)
**Purpose:** Version control. Repository was initialized during setup.

---

## GitHub

**Status:** Available
**Version:** gh 2.97.0
**Invocation:** `gh <command>`
**Authentication:** Configured — account `fubak` on github.com (keyring),
scopes `gist`, `read:org`, `repo`, `workflow`. Protocol: https.
**Purpose:** PRs, issues, repo management, Actions.

### Confirmed Commands

```bash
gh auth status
gh repo create / gh pr create / gh issue list
```

### Notes

- A `GitKraken` MCP server is also configured in user scope (git operations via MCP).

---

## Node

**Status:** Available (portable, user-local)
**Version:** v24.20.0 (LTS line)
**Invocation:** `node`
**Location:** `C:\Users\bradm\.local\node-v24.20.0-win-x64\`
**Authentication:** Not required
**Purpose:** Runtime for the app, build tools, MCP stdio servers, scripts.

---

## Package manager (npm)

**Status:** Available
**Version:** 11.19.0
**Invocation:** `npm` / `npx`
**Global prefix:** `C:\Users\bradm\.local\npm-global` (on PATH)
**Purpose:** Project dependencies and global CLIs.

### Globally installed CLIs

- `playwright-cli` 0.1.19 (`@playwright/cli`)
- `gltf-transform` 4.5.0 (`@gltf-transform/cli`)
- `gltfpack` 1.2.0

No pnpm/yarn installed — npm is the project package manager.

---

## Three.js

**Status:** Available (project dependency)
**Version:** 0.185.1 (pinned in `package.json`)
**Invocation:** `import * as THREE from 'three'`
**Purpose:** Game runtime renderer.

### Notes

- Ships its own TypeScript declarations; no `@types/three` needed.
- Loaders (`GLTFLoader`, `DRACOLoader`, `KTX2Loader`, `MeshoptDecoder`) live in `three/examples/jsm/` (or `three/addons/`).
- `KTX2Loader` requires Basis transcoder `.wasm`/`.js` files copied from `node_modules/three/examples/jsm/libs/basis/` into a served directory — the Coordinator must wire this when KTX2 textures are adopted.

---

## Blender

**Status:** Available
**Version:** 5.2.1 LTS
**Invocation:** `"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"`
**Authentication:** Not required
**Purpose:** DCC for all 3D source assets (`.blend` files under `assets/blender/`).

### Confirmed Commands

```bash
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --version
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python script.py
```

### Notes

- Headless scripting via `--background --python <file>.py` works without the MCP.
- Blender is not on PATH; use the full path above or the MCP server.

---

## Blender MCP

**Status:** Available (verified — tools enumerated live)
**Server name:** `blender`
**Invocation:** `uvx blender-mcp` (configured in `%APPDATA%\devin\mcp_config.json`;
server auto-launches a Blender instance if none is running — Studio-style
external scripting bridged automatically)
**Authentication:** Not required
**Purpose:** Interactive scene building, inspection, export, and render from
any Devin session.

### Confirmed Tools

- `execute_blender_code` — arbitrary `bpy` Python: create scenes/objects/materials, mesh edits, save `.blend`, export GLB/glTF, render preview images (anything Blender can do)
- `get_scene_info`, `get_object_info` — scene/object inspection
- `get_viewport_screenshot` — visual verification of the live viewport
- `get_addon_status`, `disable_telemetry`
- Asset sources: `search_polyhaven_assets` / `download_polyhaven_asset` / `get_polyhaven_categories` / `set_texture` (PolyHaven, free CC0); Sketchfab and Polypizza search/download equivalents; Hyper3D/Rodin and Hunyuan3D generation tools (availability of those backends unverified — treat as optional)
- `record_trajectory_feedback`

### Notes

- A second `blender` MCP is also configured inside Grok CLI (`uvx --from git+...blender_mcp.git blender-mcp`), for Grok-side sessions.
- Verify viewport results with `get_viewport_screenshot`; do not approve assets on code success alone.
- **Repaired 2026-09-13:** stock Blender extension `bl_ext.lab_blender_org.mcp`
  was enabled and holding port 9876 with an incompatible protocol, causing
  "Incomplete JSON response received" on every call. Fix script:
  `scripts/assets/fix_blender_mcp_addon.py` (disables the extension, enables
  the `blender_mcp` addon, saves userpref). If MCP calls fail with that error
  again, re-run it and restart Blender.
- The MCP does **not** reliably auto-launch Blender — start
  `blender.exe` first, wait for it to finish loading, then call MCP tools.
  The `blender_mcp` addon auto-starts its v5 socket server on port 9876
  once Blender is up.

---

## Grok CLI

**Status:** Available
**Version:** grok 1.0.30 stable (`04b7ffed98c6`)
**Invocation:** `grok` — located at `C:\Users\bradm\.grok\bin\grok.exe` (on PATH)
**Authentication:** Configured (`~/.grok/auth.json` present; `permission_mode = "always-approve"` in `~/.grok/config.toml`)
**Purpose:** Secondary agent + Grok Imagine media pipeline.

### Confirmed Commands

```bash
grok --version
grok -p "<single-turn prompt>" --output-format plain   # headless single turn
grok agent                                            # headless agent mode
grok -p "..." --output-format json                    # structured output
grok --prompt-file <path>                             # prompt from file
grok mcp list                                         # shows its blender MCP
grok sessions list                                    # session management
grok usage                                            # token/cost usage
```

### Bundled skills (visible inside Grok sessions)

`imagine`, `game-asset-core`, `game-character-consistency`,
`game-animation-frames`, `game-tilesets`, `game-ui-icons`, plus general skills.

---

## Grok Imagine (via Grok CLI)

**Status:** Available — exposed as built-in tool calls inside the Grok agent,
NOT a standalone CLI subcommand.
**Invocation:** ask the Grok agent in a headless run, e.g.
`grok -p "Use the image_gen tool to ... save to <path>" --output-format plain`
**Authentication:** via Grok CLI sign-in (configured)
**Purpose:** Concept art, textures, decals, sprites, VFX reference, UI art,
motion/video reference, promotional art.

### Confirmed Tools (from Grok's bundled `imagine` skill)

| Tool | Inputs | Notes |
|---|---|---|
| `image_gen` | `prompt` (req), `aspect_ratio` | Ratios: `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `auto` |
| `image_edit` | `prompt` (req), `image` (req: file path(s) or `data:` URL), `aspect_ratio` | Single-image edits preserve input ratio; multi-image edits may set it |
| `image_to_video` | source image + prompt | Video starts from an image — no text-to-video. Duration 6s or 10s |
| `reference_to_video` | reference image(s) + prompt | Prefer multi-image `image_edit` + `image_to_video` unless multi-ref is truly needed |

### Notes

- No `n`/`count` parameter — issue multiple calls for variations.
- Consistency is manufactured per call: generate one canonical reference, then derive reappearances via `image_edit` seeded from it.
- Generated media is never auto-shipped; it goes through critique and registry (`MEDIA_REGISTRY.md`, prompts under `assets/media/prompts/`).
- Do not reproduce protected Nintendo (or any third-party) assets.

---

## Chrome

**Status:** Available
**Invocation:** installed system Chrome (detected by `playwright-cli` during setup — "Found chrome, will use it as the default browser")
**Purpose:** Game runtime browser, DevTools MCP target, Playwright browser.

---

## Chrome DevTools MCP

**Status:** Available (verified — tools enumerated live)
**Server name:** `chrome-devtools`
**Invocation:** `cmd /c C:\Users\bradm\.local\node-v24.20.0-win-x64\npx.cmd -y chrome-devtools-mcp@1.8.0` (in `%APPDATA%\devin\mcp_config.json`)
**Authentication:** Not required
**Purpose:** Browser control + inspection of the running game: console, network,
performance traces, screenshots, heap snapshots, Lighthouse.

### Confirmed Tools

`navigate_page`, `new_page`, `list_pages`, `select_page`, `close_page`,
`resize_page`, `click`, `dblclick`/`drag`, `fill`, `fill_form`, `hover`,
`press_key`, `type_text`, `upload_file`, `handle_dialog`, `wait_for`,
`take_snapshot`, `take_screenshot`, `evaluate_script`,
`list_console_messages`, `get_console_message`,
`list_network_requests`, `get_network_request`,
`performance_start_trace`, `performance_stop_trace`, `performance_analyze_insight`,
`take_heapsnapshot`, `lighthouse_audit`,
`emulate` (network throttling, CPU throttling 1–20x, viewport/mobile, UA, geolocation, color scheme)

### Notes

- Launches/drives real Chrome (stable channel by default; `--channel`, `--headless`, `--isolated`, `--browserUrl` for attaching to a running instance are supported server flags).

---

## Playwright

**Status:** Available — `playwright-cli` (Microsoft's agent-oriented CLI), NOT the test-runner package
**Version:** 0.1.19
**Invocation:** `playwright-cli <command>` (global). Fallback: `npx playwright cli` if a project-local playwright exists.
**Authentication:** Not required
**Browser:** Uses installed Chrome by default; `--browser=firefox|webkit|msedge` supported.
**Purpose:** Deterministic browser automation for QA: navigation, interaction,
screenshots, video, console/network capture.

### Confirmed Commands

```bash
playwright-cli open https://localhost:5173
playwright-cli goto / click e5 / fill e3 "text" / press Enter
playwright-cli snapshot [--depth=4] [--filename=out.yml]
playwright-cli screenshot [--hires] [--filename=page.png]
playwright-cli console / requests                # console + network capture
playwright-cli tracing-start / tracing-stop      # trace capture
playwright-cli video-start out.webm / video-stop # video recording
playwright-cli eval "<js>" / --raw / --json      # scripting + machine output
playwright-cli state-save / state-load           # auth/storage reuse
playwright-cli -s=name open ...                  # named sessions
playwright-cli install --skills                  # installs agent skill files
```

### Notes

- A `playwright-cli` skill is installed at user scope: `%APPDATA%\devin\skills\playwright-cli\SKILL.md` (full command reference + 9 topic guides under `references/`).
- Sessions write artifacts to `.playwright-cli/` in the working directory (gitignored).
- Playwright automation does not replace visual inspection of the WebGL game.

---

## Context7 MCP

**Status:** Available (verified — tools enumerated live; HTTP 200 on endpoint)
**Server name:** `context7`
**Invocation:** remote Streamable HTTP `https://mcp.context7.com/mcp` (no key; free tier)
**Authentication:** Not required
**Purpose:** Current third-party library documentation (Three.js, Vite, etc.).

### Confirmed Tools

- `resolve-library-id` — map a library name to a Context7 ID (`/org/project`)
- `query-docs` — fetch versioned docs/examples for a resolved library ID

### Usage

Call `resolve-library-id` once per library (e.g. "Three.js" → `/mrdoob/three.js`),
then `query-docs` with a focused single-topic query. Do not send secrets in queries.

---

## FFmpeg

**Status:** Available
**Version:** 9.0.1-essentials_build (gyan.dev)
**Invocation:** `ffmpeg` / `ffprobe` (on PATH)
**Authentication:** Not required
**Purpose:** Video/audio transcode, frame extraction (e.g. last-frame continuity
for `image_to_video` shots), gameplay clip assembly, media conversion.

### Confirmed Commands

```bash
ffmpeg -version
ffprobe -version
ffmpeg -f concat -safe 0 -i list.txt -c copy out.mp4   # lossless shot assembly
```

---

## gltfpack / meshoptimizer

**Status:** Available
**Version:** gltfpack 1.2.0 (npm `gltfpack` package — bundles the meshoptimizer binary)
**Invocation:** `gltfpack -i <in.glb> -o <out.glb> [options]`
**Purpose:** glTF geometry optimization: quantization, meshopt compression (`-cc`),
simplification (`-si`), KTX2 embed (`-tc` uses its own encoder), animation resampling.

### Confirmed Commands

```bash
gltfpack -i in.glb -o out.glb -cc          # meshopt compression
gltfpack -i in.glb -o out.glb -cc -tc      # + KTX2 textures (built-in encoder)
gltfpack -i in.glb -o out.glb -si 0.5      # simplify to 50%
```

---

## glTF Transform

**Status:** Available
**Version:** 4.5.0 (`@gltf-transform/cli`)
**Invocation:** `gltf-transform <command> <in> <out>`
**Purpose:** Inspect/optimize/validate GLB: prune, dedup, weld, resize,
texture transcode (webp/avif/ktx2), draco/meshopt compress, scene ops.

### Confirmed Commands

```bash
gltf-transform inspect in.glb
gltf-transform optimize in.glb out.glb
gltf-transform webp in.glb out.glb         # sharp-based, no extra tools needed
gltf-transform etc1s in.glb out.glb        # KTX2 ETC1S — uses toktx
gltf-transform uastc in.glb out.glb        # KTX2 UASTC — uses toktx
gltf-transform validate in.glb
```

---

## KTX-Software (KTX2 / Basis Universal)

**Status:** Available
**Version:** 4.4.2
**Invocation:** `toktx`, `ktx`, `ktx2check`, `ktx2ktx2`, `ktxinfo`, `ktxsc`
(on PATH; installed per-user at `C:\Users\bradm\.local\KTX-Software\bin`)
**Purpose:** KTX2 texture creation/validation; **Basis Universal** encoding is
built into `toktx` (`--bcmp` for ETC1S, `--uastc` for UASTC). No standalone
`basisu` binary is installed — toktx covers the project's Basis needs.

### Confirmed Commands

```bash
toktx --version            # v4.4.2
toktx --bcmp out.ktx2 in.png            # ETC1S KTX2
toktx --uastc 4 out.ktx2 in.png         # UASTC KTX2 (quality 0-4)
ktx info in.ktx2 ; ktx2check in.ktx2    # inspect / validate
```

---

## Audio tooling

**Status:** Partially available
**Available:** `ffmpeg`/`ffprobe` (decode, convert, mix, loudness, waveform extract),
Python 3.12.8 (scriptable audio processing, e.g. `pip install soundfile`).
**Not installed:** Audacity, LMMS (checked `Program Files` / `Program Files (x86)`).
**Purpose:** SFX/music authoring pipeline is TBD — Coordinator decision.
Free candidates if needed later: LMMS, Audacity, BeepBox/Furnace (trackers),
`sfxr`/`jsfxr`-style procedural SFX, or Grok-assisted audio via code.

---

## Other configured tools

| Tool | Status | Notes |
|---|---|---|
| Python | Available | 3.12.8 at `%LOCALAPPDATA%\Programs\Python\Python312` |
| uv / uvx | Available | 0.12.10 — runs Python tools (`blender-mcp` uses `uvx`) |
| DaVinci Resolve MCP | Configured | `davinci-resolve` server in user scope — video editing/trailer cutting; launches Resolve via scripting API (free edition supported via in-app bridge) |
| GitKraken MCP | Configured | `GitKraken` server — git operations via MCP |
| Unity MCP | Configured | `unityMCP` server — Unity editor control; not core to this Three.js project |
| Cursor | Installed | `C:\Users\bradm\AppData\Local\Programs\cursor` |
| VS Code | Installed | on PATH (`code`) |

---

## Verification

```bash
npm run check:toolchain    # scripts/dev/check-toolchain.mjs — CLI availability
devin mcp list             # MCP servers (standalone CLI sessions)
```
