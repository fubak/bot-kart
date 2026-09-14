# Wave-6 visual-production texture batch — 2026-09-14

Nine `image_gen` calls via `grok -p` (headless, plain output). Goal: kart-racer
production textures — tileable surfaces, sprite sheets on black (luminance =
alpha), poster billboards, grandstand crowd. All original IP.

| Output | Prompt summary | Aspect |
|---|---|---|
| grass_tile.png | seamless tileable cartoon grass, vibrant green, painterly, flat lighting | 1:1 |
| asphalt_tile.png | seamless dark slate-blue asphalt, fine speckle, clean stylized | 1:1 |
| gravel_tile.png | seamless warm sandy-tan gravel, scattered pebbles | 1:1 |
| cloud_sprite.png | puffy cumulus silhouette, white on black, generous margin | 1:1 |
| smoke_puff.png | soft wispy smoke ball, white on black, fading edges | 1:1 |
| crowd.png | dense rows of tiny colorful blob robot spectators on navy | 16:9 |
| billboard_grokkart.png | GROK KART poster — white bot head, coral/cream, retro racing | 16:9 |
| billboard_turbo.png | TURBO ZONE poster — cyan rocket flame + bolt, neon on navy | 16:9 |
| billboard_botpower.png | BOT POWER poster — kart wheel + speed lines + star, yellow/purple | 16:9 |

Runtime processing (ffmpeg): tiles/sprites → 512² PNG; crowd → center-band
crop 1024×288; billboards → 1024×576. Shipped from `assets/textures/`.
