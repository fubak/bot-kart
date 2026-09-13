---
name: runtime-asset-optimization
description: Optimize and validate GLB runtime assets for browser delivery — gltf-transform, gltfpack/meshopt, KTX2 via toktx. Use before any asset is marked Integrated.
allowed-tools:
  - exec
  - read
  - write
  - grep
  - glob
---

# Runtime Asset Optimization

All tools verified installed (see `docs/gauntlet/TOOLCHAIN.md`). Only the
commands below are confirmed — do not invent flags.

## Pipeline position

```
assets/blender/<cat>/<name>.blend   (editable source — never skip)
        │  Blender export (GLB)
        ▼
assets/exported/<cat>/<name>.glb    (runtime file the game loads)
        │  optimization passes below
        ▼
   load in-game → screenshot → registry
```

## 1. Inspect / validate

```bash
gltf-transform inspect assets/exported/<cat>/<name>.glb
gltf-transform validate assets/exported/<cat>/<name>.glb
gltfpack -i <in.glb> -o <out.glb> -cc -kn    # keep names, check structure
```

Record triangles, materials, texture sizes, animation clips in
`docs/gauntlet/ASSET_REGISTRY.md`.

## 2. gltf-transform (4.5.0)

```bash
gltf-transform optimize in.glb out.glb      # prune/dedup/weld/resize+compress
gltf-transform webp in.glb out.glb          # WebP textures (sharp, no extras)
gltf-transform etc1s in.glb out.glb         # KTX2 ETC1S — needs toktx (installed)
gltf-transform uastc in.glb out.glb         # KTX2 UASTC — needs toktx
gltf-transform draco in.glb out.glb         # geometry: Draco
gltf-transform meshopt in.glb out.glb       # geometry: meshopt
```

## 3. gltfpack / meshoptimizer (1.2.0)

```bash
gltfpack -i in.glb -o out.glb -cc           # meshopt compression
gltfpack -i in.glb -o out.glb -cc -tc       # + built-in KTX2 textures
gltfpack -i in.glb -o out.glb -si 0.5       # simplify to 50%
gltfpack -i in.glb -o out.glb -cc -ac       # animation resample/compress
```

## 4. KTX-Software 4.4.2 (Basis Universal encoding inside `toktx`)

```bash
toktx --bcmp out.ktx2 in.png                # ETC1S KTX2 (smaller, lower quality)
toktx --uastc 4 out.ktx2 in.png             # UASTC KTX2 (higher quality)
ktx info file.ktx2                          # inspect
ktx2check file.ktx2                         # validate
```

## 5. Runtime verification (required)

- The loader must match the compression: `GLTFLoader` + `DRACOLoader` /
  `MeshoptDecoder` / `KTX2Loader` as applicable.
- `KTX2Loader` needs the Basis transcoder files copied from
  `node_modules/three/examples/jsm/libs/basis/` to a served dir
  (Coordinator wires this when KTX2 is adopted).
- After optimizing, **load the asset in the running game and screenshot it** —
  a valid GLB can still look wrong (flipped normals, lost vertex colors,
  broken tangents).

## LOD

- Use `gltfpack -si` steps or authored LOD meshes; swap by distance in-game.
- LOD strategy per-asset is recorded in the registry (`LOD:` field).

## Currently unavailable / optional

- Standalone `basisu` binary — not installed; `toktx` covers ETC1S/UASTC.
- Draco **encoding** via `gltfpack -d` also works; prefer whichever pipeline
  the Coordinator standardizes on (`DECISIONS.md`).
