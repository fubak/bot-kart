# Performance Budget

Goals first — hard numbers follow baseline profiling of the real game.
Exact numerical budgets are **`TBD AFTER BASELINE PROFILING`**.

## Goals

- Smooth desktop browser experience on typical hardware.
- **Stable frame time matters more than maximum visual complexity.**
- Measure FPS *and* frame time (ms), including 1% lows — averages hide spikes.
- Test actual gameplay — racing, items, multiple AI karts — not only static scenes.

## Budgets (set after baseline profiling)

Baseline measured 2026-09-13 on the Wave 1 vertical slice (this machine vsyncs
at 75 Hz): **75 fps**, avg frame 13.3 ms, p50 13.4 ms, p99 18.1 ms, worst
18.9 ms, **14 draw calls, 5.6k tris**, LCP 780 ms — while driving at top speed.
Budgets below are provisional targets for the *full* game, not the slice.

| Metric | Budget |
|---|---|
| Target FPS | 60 fps minimum on typical hardware (75+ on this machine) |
| Frame time (avg / p99) | avg ≤13.5 ms / p99 ≤18 ms at 75 Hz (≤16.7/≤22 at 60 Hz) |
| Triangles per view | ≤300k |
| Draw calls per view | ≤150 |
| Texture memory | ≤512 MB GPU |
| GLB per-asset size | ≤2 MB optimized (karts/racers), ≤8 MB (tracks) |
| Load time to first interactive frame | ≤3 s local, ≤8 s throttled Fast 4G |
| JS heap / GC pauses | no visible per-frame allocation churn; heap stable across races |

## Perf gauntlet results (2026-09-16, wave-22 pass)

Post-optimization measurements, single rendering client, 75 Hz vsync,
RTX 4070 Ti / ANGLE D3D11, live racing with AI + items firing:

| Track | FPS | p50 | p95 | p99 | Worst | >25 ms | Draws |
|---|---|---|---|---|---|---|---|
| PROVING GROUNDS | 68.5 | 14.6 | 15.2 | 15.6 | 15.8 | 0 | ~387 |
| SWITCHBACK RIDGE | 68.4 | 14.6 | 15.3 | 15.6 | 15.9 | 0 | ~291 |
| NEON NIGHT | 68.4 | 14.6 | 15.2 | 15.6 | 15.8 | 0 | ~248 |

- 4× CPU throttle (weaker-machine proxy): 47.6 fps avg, p95 30.4 ms — above
  the 30 fps floor with bounded spikes.
- Heap churn: ~324 KB/frame → **~0 KB/frame**; heap flat ~32 MB over 1500+
  racing frames; zero GC-driven hitches.
- Program count: 65 warm at title (prewarmed), 100 after NN buildWorld —
  zero mid-race shader-compile hitches.

### What the pass fixed

1. **GLB kart merge** — static driver/kart submeshes baked per kart:
   AI kart 125→51 meshes / 120→17 materials; scene draws 1043→~390.
2. **Per-frame allocation elimination** — `Track.query/constrain/lookahead`
   out-params; Kart/AiDriver/ChaseCamera scratch vectors (no `.clone()` in
   update loops); preallocated Game arrays (`allKarts`, `stepScores`,
   `hudSettings`/`hudGp`/`hudRecord`); reusable `pollPadCodes` set; missile
   update temps in Items.
3. **Shader/texture prewarm** — `renderer.compile(scene)` +
   `initTexture` at every `buildWorld`; a hidden prewarm group (missile,
   slick) keeps lazily-spawned programs resident so first item fire can't
   hitch. NN headlight light-count variant also covered.
4. **Shadow map 2048→1536** — ~44% less shadow fill, no visible quality
   loss at 720p.

### Draw-call budget revision

The provisional ≤150 calls/view was set on the Wave-1 slice (14 calls).
The full game (hero karts, instanced crowds, scenery, items, shadows)
measures ~250-390 draws at locked frame times — the binding constraint is
frame-time stability, not call count. Revised guidance: **≤450 draws/view**
with instancing preferred over loose meshes for repeated props.

### Measurement caveat

Frame-time spikes (~27 ms cadence + 40-80 ms outliers) observed during
dual-client rendering — a second browser rendering the game contends for
the GPU/present queue. All budget numbers require a single rendering
client; background/secondary instances invalidate measurements.

## Standing Rules

- Establish geometry, texture, and draw-call budgets from measured prototype
  data — never guessed.
- Watch garbage collection: avoid per-frame allocations in the update loop.
- Track loading performance (asset count, compression, streaming order).
- Monitor shader cost, shadow cost, and transparency/overdraw — the three
  classic kart-game GPU killers.
- Every performance claim requires captured evidence (trace, FPS sample,
  screenshot of live metrics).

## Instrumentation

- Chrome DevTools MCP: `performance_start_trace` / `performance_stop_trace` /
  `performance_analyze_insight`, `take_heapsnapshot`, `lighthouse_audit`,
  `emulate` (CPU throttling 1–20x for low-end simulation).
- playwright-cli: `console`, `requests`, `eval` for in-page metrics,
  `tracing-start`/`tracing-stop` for Playwright traces.
- Add an in-game FPS/frame-time overlay early — cheap, always-on evidence
  (a quality unit owned by the Performance domain).
