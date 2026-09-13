---
name: grok-imagine-pipeline
description: Generate and refine concept art, textures, sprites, and video reference via Grok Imagine through the Grok CLI. Use for any image/video generation task.
allowed-tools:
  - exec
  - read
  - write
  - edit
  - grep
  - glob
---

# Grok Imagine Pipeline

Grok Imagine is a **first-class creative pipeline** for this project. It is
accessed through the Grok CLI's built-in agent tools — there is no standalone
`grok imagine` command.

## Invocation (confirmed)

```bash
grok -p "<instruction>" --output-format plain        # headless single turn
grok -p "<instruction>" --output-format json         # structured output
grok --prompt-file prompt.md --output-format plain   # long prompts from file
```

The Grok agent (`grok` 1.0.30, authenticated, `always-approve` permission
mode) executes its built-in media tools:

| Tool | Inputs | Use |
|---|---|---|
| `image_gen` | `prompt` (req), `aspect_ratio` | New image from text. Ratios: `1:1` `16:9` `9:16` `4:3` `3:4` `auto` |
| `image_edit` | `prompt` (req), `image` (req: file path(s) or `data:` URL), `aspect_ratio` | Restyle/recolor/add/remove; preserves input ratio for single image |
| `image_to_video` | source image + prompt | Animate from frame 1. Duration **6s or 10s only** |
| `reference_to_video` | reference image(s) + prompt | Multi-reference video; prefer multi-image `image_edit` → `image_to_video` |

No `n`/`count` parameter — issue multiple calls for variations.

Example headless generation:

```bash
grok -p "Use image_gen to create a concept: <description>. aspect_ratio 16:9. \
Save the result to C:\github\bot-kart\assets\media\concepts\<area>\<name>.png \
and print the saved path." --output-format plain
```

## Uses

- Concept art: characters, karts, tracks, environments
- Textures, decals, sprites, VFX source frames
- UI art and backgrounds
- Reference imagery for Blender modeling
- Motion studies and video references (`image_to_video`)
- Promotional art

## Rules

1. **Consistency is manufactured** — Grok has no character memory. Generate
   one canonical reference per character/kart/look, then derive every
   reappearance with `image_edit` seeded from it. Never fresh-`image_gen` a
   recurring subject. (Grok's own `game-character-consistency` bundled skill
   covers the same discipline.)
2. **Archive important prompts** under `assets/media/prompts/` (see its
   README for the required fields).
3. **Never auto-ship generated output.** Critique → refine → register in
   `docs/gauntlet/MEDIA_REGISTRY.md` → integrate only after in-game acceptance.
4. **Concepts feed Blender** — a Grok concept is a modeling target, not an
   asset.
5. **Generated textures need runtime processing** — power-of-two resize,
   channel packing, KTX2 via `toktx`/`gltf-transform` before shipping.
6. **Generated video is motion reference** — extract frames with ffmpeg;
   it is not shipped footage unless explicitly designated promotional.
7. **Acceptance happens in the actual game** — registry + in-engine review.
8. **Original IP only** — never prompt for or reproduce protected Nintendo
   (or other third-party) characters, tracks, items, or artwork.
9. On moderation blocks: stop, tell the user, pick a different direction —
   do not paraphrase around the filter.

## Continuity tricks

- Same subject, new angle → `image_edit` from the canonical reference.
- Shot N+1 → extract shot N's last frame with `ffmpeg -i clip.mp4 -vf "select=eq(n\,last)"` … or simply `ffmpeg -sseof -0.1 -i clip.mp4 -frames:v 1 last.png`, then animate that.
- Keep all shots of one sequence at the same resolution + frame rate; assemble
  with `ffmpeg -f concat -c copy` (no re-encode).
