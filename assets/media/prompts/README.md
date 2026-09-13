# Prompt Archive

Production generations that are kept — registered in
`docs/gauntlet/MEDIA_REGISTRY.md` — should have their prompt and context
preserved here. Do **not** log every disposable experiment; archive what
matters.

## One file per kept generation (or coherent batch)

Use descriptive filenames, e.g.:

```
assets/media/prompts/2026-09-14_racer-orbit-concept_v3.md
```

## Recommended contents

```markdown
# <Generation name>

- **Purpose:** <what this media is for — concept, texture, reference, ...>
- **Prompt:** <exact final prompt>
- **Tool/model:** image_gen | image_edit | image_to_video | reference_to_video
- **References:** <paths of seed/reference images used>
- **Aspect ratio:** <e.g. 16:9> | **Duration:** <video: 6s | 10s>
- **Output:** <path(s) to selected output file(s)>
- **Iteration:** <v1..vN — what changed between attempts>
- **Selection notes:** <why this output was kept>
```

Keep prompts reproducible: a future Devin should be able to re-derive or
extend a result from this file plus the referenced media.
