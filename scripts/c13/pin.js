// Critic-13 wall-pin escape probe.
// window.__pin(i, side, steerKey, holdMs): teleport nose-in at wall, hold
// W + steerKey, log heading/fs/lateral/wall at 20 Hz.
// side: +1 = left wall, -1 = right wall.
window.__pin = (i, side = 1, steerKey = 'KeyA', holdMs = 5000) => {
  const g = window.__game, k = g.kart, tr = g.track;
  const s = tr.samples[i];
  const pos = s.point.clone().addScaledVector(s.left, side * 5.45);
  k.reset(pos, Math.atan2(-s.left.x * side, -s.left.z * side));
  const press = (c, on) => window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code: c }));
  ['KeyW', 'KeyS', 'KeyA', 'KeyD'].forEach(c => press(c, false));
  if (window.__pinIv) clearInterval(window.__pinIv);
  const rec = [];
  const t0 = performance.now();
  window.__pinRec = rec;
  window.__pinIv = setInterval(() => {
    rec.push({
      t: +((performance.now() - t0) / 1000).toFixed(3),
      h: +k.heading.toFixed(4),
      fs: +k.forwardSpeed.toFixed(3),
      spd: +k.speed.toFixed(3),
      wall: k.onWall ? 1 : 0,
      lat: +tr.query(k.position, k.trackIdx).lateral.toFixed(2),
      idx: k.trackIdx,
    });
  }, 50);
  press('KeyW', true);
  press(steerKey, true);
  setTimeout(() => {
    press('KeyW', false); press(steerKey, false);
    clearInterval(window.__pinIv); window.__pinIv = null;
  }, holdMs);
  return `pin armed idx=${i} side=${side} steer=${steerKey}`;
};

// Summarize the last pin run.
window.__pinReport = () => {
  const rec = window.__pinRec ?? [];
  if (!rec.length) return 'no rec';
  const h0 = rec[0].h, h1 = rec[rec.length - 1].h;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const net = wrap(h1 - h0);
  let hmin = Infinity, hmax = -Infinity, reversals = 0, prev = 0, sign = 0;
  for (const r of rec) {
    const d = wrap(r.h - h0);
    hmin = Math.min(hmin, d); hmax = Math.max(hmax, d);
    const dh = wrap(r.h - (prev || r.h));
    if (prev !== 0) {
      const s = Math.sign(dh);
      if (s !== 0 && sign !== 0 && s !== sign) reversals++;
      if (s !== 0) sign = s;
    }
    prev = r.h;
  }
  const last = rec[rec.length - 1];
  return {
    n: rec.length, dur: last.t,
    netDh: +net.toFixed(3), range: [+hmin.toFixed(3), +hmax.toFixed(3)],
    reversals,
    endFs: last.fs, endLat: last.lat, endWall: last.wall, endIdx: last.idx,
    first10: rec.slice(0, 10).map(r => [r.t, r.h, r.fs, r.wall]),
    last10: rec.slice(-10).map(r => [r.t, r.h, r.fs, r.wall, r.lat]),
  };
};
'pin probe installed';
