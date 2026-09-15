// Critic-13 perf probe: rAF frame-time sampling + renderer.info draws/tris.
window.__perfStart = (ms = 10000) => {
  const g = window.__game;
  const rec = [];
  let prev = performance.now(), running = true;
  const draws = [], tris = [];
  const loop = (now) => {
    if (!running) return;
    rec.push(now - prev); prev = now;
    const info = g.renderer.info.render;
    draws.push(info.calls); tris.push(info.triangles);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  setTimeout(() => { running = false; window.__perfRec = rec; window.__perfDraws = draws; window.__perfTris = tris; }, ms);
  return 'perf sampling';
};
window.__perfReport = () => {
  const rec = (window.__perfRec ?? []).filter(d => d > 0 && d < 500);
  if (!rec.length) return 'no rec';
  const s = [...rec].sort((a, b) => a - b);
  const q = p => +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(2);
  const sum = rec.reduce((a, b) => a + b, 0);
  return {
    frames: rec.length,
    avgFps: +(1000 / (sum / rec.length)).toFixed(1),
    p50: q(0.5), p95: q(0.95), p99: q(0.99),
    worst: +Math.max(...rec).toFixed(2),
    draws: [Math.min(...window.__perfDraws), Math.max(...window.__perfDraws)],
    tris: [Math.min(...window.__perfTris), Math.max(...window.__perfTris)],
    over16: rec.filter(d => d > 16.6).length,
  };
};
'perf probe installed';
