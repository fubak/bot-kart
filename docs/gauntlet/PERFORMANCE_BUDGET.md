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
