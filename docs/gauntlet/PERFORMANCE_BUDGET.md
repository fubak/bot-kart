# Performance Budget

Goals first — hard numbers follow baseline profiling of the real game.
Exact numerical budgets are **`TBD AFTER BASELINE PROFILING`**.

## Goals

- Smooth desktop browser experience on typical hardware.
- **Stable frame time matters more than maximum visual complexity.**
- Measure FPS *and* frame time (ms), including 1% lows — averages hide spikes.
- Test actual gameplay — racing, items, multiple AI karts — not only static scenes.

## Budgets (set after baseline profiling)

| Metric | Budget |
|---|---|
| Target FPS | TBD AFTER BASELINE PROFILING |
| Frame time (avg / p99) | TBD AFTER BASELINE PROFILING |
| Triangles per view | TBD AFTER BASELINE PROFILING |
| Draw calls per view | TBD AFTER BASELINE PROFILING |
| Texture memory | TBD AFTER BASELINE PROFILING |
| GLB per-asset size | TBD AFTER BASELINE PROFILING |
| Load time to first interactive frame | TBD AFTER BASELINE PROFILING |
| JS heap / GC pauses | TBD AFTER BASELINE PROFILING |

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
