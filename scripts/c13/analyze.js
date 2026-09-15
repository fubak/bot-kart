// Critic-13 log analyzer: stall% per bot over the autopilot __log.
// ai entry: [lap, fs, state, lat, fin, ww, pos]. Also records kart idx
// via __logIdx if present. Window filters on sim-time range and/or idx.
window.__analyze = (opts = {}) => {
  const L = window.__log ?? [];
  const t0 = opts.t0 ?? -Infinity, t1 = opts.t1 ?? Infinity;
  const rows = L.filter(r => r.t >= t0 && r.t <= t1);
  const out = { n: rows.length, span: rows.length ? +(rows[rows.length - 1].t - rows[0].t).toFixed(1) : 0 };
  for (let b = 0; b < 3; b++) {
    const fss = rows.map(r => r.ai[b][1]);
    const n = fss.length || 1;
    out['ai' + b] = {
      n,
      stoppedPct: +(100 * fss.filter(v => v < 0.5).length / n).toFixed(1),
      slowPct: +(100 * fss.filter(v => v < 4).length / n).toFixed(1),
      revPct: +(100 * fss.filter(v => v < -0.3).length / n).toFixed(1),
      minFs: Math.min(...fss),
      medFs: +fss.sort((a, b2) => a - b2)[Math.floor(n / 2)].toFixed(1),
    };
  }
  return out;
};
// Rich per-bot timeline: per-sample {t, idx, fs, wall} for deep dives.
window.__aiTimeline = (bi) => (window.__log ?? []).map(r => ({
  t: r.t, idx: r.ai[bi][7] ?? null, fs: r.ai[bi][1], st: r.ai[bi][2],
  lat: r.ai[bi][3], lap: r.ai[bi][0], fin: r.ai[bi][4], ww: r.ai[bi][5],
}));
'analyze installed';
