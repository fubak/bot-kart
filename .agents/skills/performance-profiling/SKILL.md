---
name: performance-profiling
description: Measure FPS, frame time, traces, memory, and load performance of the running game using Chrome DevTools MCP and playwright-cli. Use for any performance claim or regression check.
allowed-tools:
  - exec
  - read
  - write
  - grep
  - glob
  - mcp_call_tool
---

# Performance Profiling

Every performance claim requires captured evidence. Budgets live in
`docs/gauntlet/PERFORMANCE_BUDGET.md` (`TBD AFTER BASELINE PROFILING`).

## Chrome DevTools MCP (primary)

Server: **`chrome-devtools`** (launches/drives real Chrome).

| Task | Tools |
|---|---|
| Open/navigate | `new_page`, `navigate_page`, `list_pages`, `select_page` |
| Console | `list_console_messages`, `get_console_message` |
| Network/load | `list_network_requests`, `get_network_request` |
| **Perf trace** | `performance_start_trace` → drive gameplay → `performance_stop_trace` → `performance_analyze_insight` |
| Memory | `take_heapsnapshot` |
| Screenshots | `take_screenshot`, `take_snapshot` (a11y tree) |
| Input | `click`, `press_key`, `type_text`, `wait_for` |
| Low-end sim | `emulate` — `cpuThrottlingRate` 1–20x, network throttling, viewport/mobile |
| In-page JS | `evaluate_script` — read `performance.now()`, renderer info, custom counters |
| Audit | `lighthouse_audit` |

## playwright-cli (complementary)

```bash
playwright-cli console                      # errors/warnings
playwright-cli requests                     # asset transfer sizes/timing
playwright-cli eval "JSON.stringify(performance.getEntriesByType('navigation'))"
playwright-cli tracing-start / tracing-stop # Playwright trace for replay
```

## What to measure

- **FPS and frame time** — report avg *and* 1% lows; stable frame time beats
  peak complexity. An in-game overlay should land early (Performance domain
  unit); until then use `evaluate_script` sampling loops.
- **Load** — `list_network_requests` for asset sizes/count; navigation timing
  via `evaluate_script`.
- **Runtime** — `performance_start_trace` around actual gameplay (driving,
  items, multiple racers — not idle scenes).
- **Memory** — `take_heapsnapshot` before/after races; watch JS heap growth
  and per-frame allocation churn (GC spikes).
- **GPU-side signals** — draw calls/triangles once the app exposes
  `renderer.info` (a worthwhile debug hook: `window.__game.renderer.info`).

## Regression protocol

1. Capture a **before** baseline (trace + FPS sample + screenshot of metrics).
2. Apply the change.
3. Capture **after** under the same scenario/route/inputs.
4. Compare frame time distributions, not single numbers.
5. Attach both artifacts to the unit/registry entry.

## Notes

- `emulate cpuThrottlingRate` approximates low-end machines — use it before
  claiming "smooth on typical hardware".
- Record which Chrome/channel the numbers came from; results are
  machine-relative.
