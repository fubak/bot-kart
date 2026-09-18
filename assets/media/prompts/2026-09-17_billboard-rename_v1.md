# Billboard rename edit — 2026-09-17

One `image_edit` call via `grok -p` (headless, plain output). Goal: rebrand the
wave-6 GROK KART poster to the new game title GROK BOT KART without regenerating
the artwork. Original IP.

| Input | Output | Prompt summary | Aspect |
|---|---|---|---|
| assets/textures/billboard_grokkart.png | assets/media/textures/billboard_grokbotkart.png | change only the bottom logo text to "GROK BOT KART", same retro typeface/colors/outline; keep bot head, karts, checkers, tire marks, tagline | 16:9 (1280×720) |

Post-processing: LANCZOS resize to 1024×576 → `assets/textures/billboard_grokbotkart.png`
(replaces `billboard_grokkart.png`; import updated in `src/core/Textures.ts`).
