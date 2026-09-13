---
name: blender-asset-pipeline
description: Author and export 3D game assets through Blender (MCP or headless CLI) into GLB runtime files. Use for any asset creation, mesh/material/animation work, or GLB export.
allowed-tools:
  - exec
  - read
  - write
  - edit
  - grep
  - glob
  - mcp_call_tool
---

# Blender Asset Pipeline

## Layout

- **Editable source:** `assets/blender/<category>/<name>.blend` — always preserved.
- **Runtime output:** `assets/exported/<category>/<name>.glb` — what the game loads.
- Categories: `characters`, `karts`, `environments`, `track-props`, `items`,
  `effects`, `shared`.
- Runtime format: **GLB** (binary glTF) unless the architecture ADR says otherwise.

## Blender MCP (preferred interface)

Server name: **`blender`** (user scope; auto-launches Blender if none runs).
Verified tools:

- `mcp__blender__execute_blender_code` — run `bpy` Python: create scenes,
  objects, materials, edit meshes, save `.blend`, export GLB, render previews.
- `mcp__blender__get_scene_info` / `get_object_info` — inspect state.
- `mcp__blender__get_viewport_screenshot` — see what Blender actually shows.
- `mcp__blender__search_polyhaven_assets` / `download_polyhaven_asset` /
  `get_polyhaven_categories` / `set_texture` — free CC0 HDRIs/textures/models.
- Sketchfab/Polypizza search+download tools (availability of remote backends
  may vary — treat as optional).

Headless alternative (no MCP needed):

```bash
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python my_script.py
```

### Troubleshooting

- **"Incomplete JSON response received"** — Blender's stock
  `bl_ext.lab_blender_org.mcp` extension is holding port 9876 with an
  incompatible protocol. Run
  `blender.exe --background --python scripts/assets/fix_blender_mcp_addon.py`
  then restart Blender.
- **"Not connected to Blender"** — the MCP does not reliably auto-launch
  Blender. Start `blender.exe` manually, wait ~20s for the addon's socket
  server (port 9876) to come up, then retry.

## Export to GLB (via `execute_blender_code`)

```python
import bpy
bpy.ops.export_scene.gltf(
    filepath=r"C:\github\bot-kart\assets\exported\<category>\<name>.glb",
    export_format='GLB',
    export_apply=True,          # apply modifiers
    export_animations=True,
    export_yup=True,            # glTF is +Y up
)
bpy.ops.wm.save_as_mainfile(
    filepath=r"C:\github\bot-kart\assets\blender\<category>\<name>.blend")
```

## Rules

1. **Establish scale/coordinate conventions before mass production** — the
   Coordinator sets these in `docs/gauntlet/DECISIONS.md`; follow them exactly.
2. **Proper pivots/origins** — wheels pivot at their axle, karts at ground
   center, characters at feet. Apply transforms before export.
3. **Validate** normals, material assignment, hierarchy, and animation clips —
   in the export, not just the source.
4. **Optimize for browser** — run `runtime-asset-optimization` skill steps
   (gltf-transform / gltfpack / toktx) before marking Production.
5. **Test the final GLB inside Three.js** — load it in the running game and
   screenshot it. **The Blender viewport alone cannot approve an asset**;
   critics judge in-game presentation.
6. **Preserve editable source** — never hand-edit the exported GLB as the
   source of truth; fix the `.blend` and re-export.
7. Use Blender automation (`execute_blender_code` / headless scripts under
   `scripts/assets/`) wherever it removes toil.
8. Register every kept asset in `docs/gauntlet/ASSET_REGISTRY.md`.

## Verification checklist

- [ ] `.blend` saved under `assets/blender/<category>/`
- [ ] GLB exported under `assets/exported/<category>/`
- [ ] `gltf-transform inspect <file>.glb` run — counts recorded in registry
- [ ] Loaded in the running game; screenshot captured
- [ ] Registry entry updated
