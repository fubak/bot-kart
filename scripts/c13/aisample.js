// Critic-13 AI sampler: 10 Hz per-bot {t, idx, fs, spd, wall, lat, lap, st}.
window.__aiStart = () => {
  const g = window.__game;
  if (window.__aiIv) clearInterval(window.__aiIv);
  window.__aiLog = [];
  const t0 = g.sim.time;
  window.__aiIv = setInterval(() => {
    const tr = g.track;
    window.__aiLog.push(g.aiKarts.map(k => ({
      t: +(g.sim.time - t0).toFixed(2),
      idx: k.trackIdx,
      fs: +k.forwardSpeed.toFixed(2),
      spd: +k.speed.toFixed(2),
      wall: k.onWall ? 1 : 0,
      lat: +tr.query(k.position, k.trackIdx).lateral.toFixed(2),
      st: k.state[0],
    })));
  }, 100);
  return 'ai sampler on';
};
window.__aiStop = () => { clearInterval(window.__aiIv); window.__aiIv = null; return 'off'; };
window.__aiStats = (idxLo, idxHi) => {
  const L = window.__aiLog ?? [];
  const out = { n: L.length, span: L.length ? +(L[L.length - 1][0].t - L[0][0].t).toFixed(1) : 0 };
  for (let b = 0; b < 3; b++) {
    let rows = L.map(r => r[b]);
    if (idxLo !== undefined) rows = rows.filter(r => r.idx >= idxLo && r.idx <= idxHi);
    const n = rows.length || 1;
    out['ai' + b] = {
      n,
      stoppedPct: +(100 * rows.filter(r => r.fs < 0.5).length / n).toFixed(1),
      slowPct: +(100 * rows.filter(r => r.fs < 4).length / n).toFixed(1),
      revPct: +(100 * rows.filter(r => r.fs < -0.3).length / n).toFixed(1),
      wallPct: +(100 * rows.filter(r => r.wall).length / n).toFixed(1),
      minFs: rows.length ? Math.min(...rows.map(r => r.fs)) : null,
      medFs: rows.length ? +rows.map(r => r.fs).sort((a, c) => a - c)[Math.floor(n / 2)].toFixed(1) : null,
    };
  }
  return out;
};
// Stall episodes: contiguous runs of fs<0.5 per bot, for cycle analysis.
window.__aiStalls = (bi, thr = 0.5) => {
  const L = window.__aiLog ?? [];
  const eps = []; let cur = null;
  for (const r of L) {
    const s = r[bi];
    if (s.fs < thr) {
      if (!cur) cur = { t0: s.t, idx0: s.idx, n: 0 };
      cur.n++; cur.t1 = s.t; cur.idx1 = s.idx;
    } else if (cur) { eps.push(cur); cur = null; }
  }
  if (cur) eps.push(cur);
  return eps.map(e => ({ ...e, dur: +(e.t1 - e.t0).toFixed(1) }));
};
'ai sampler installed';
