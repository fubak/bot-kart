// Critic-13 pivot-fade probe v2: flags spin-outs & kart contact so
// contaminated samples can be excluded.
window.__fadeRun = (idx, holdMs = 6000) => {
  const g = window.__game, k = g.kart, tr = g.track;
  const s = tr.samples[idx];
  k.reset(s.point.clone(), Math.atan2(-s.tangent.x, -s.tangent.z));
  const press = (c, on) => window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code: c }));
  ['KeyW', 'KeyS', 'KeyA', 'KeyD'].forEach(c => press(c, false));
  if (window.__fadeIv) clearInterval(window.__fadeIv);
  const rec = []; const t0 = performance.now();
  window.__fadeRec = rec;
  let prevH = k.heading, prevT = t0;
  window.__fadeIv = setInterval(() => {
    const now = performance.now();
    const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
    const dh = wrap(k.heading - prevH);
    const dt = (now - prevT) / 1000;
    // Kart contact: a bot bumping us shows as sudden position change not
    // explained by our own speed.
    rec.push({
      t: +((now - t0) / 1000).toFixed(3),
      fs: +k.forwardSpeed.toFixed(3),
      spd: +k.speed.toFixed(3),
      yawRate: +(dh / Math.max(dt, 1e-4)).toFixed(3),
      h: +k.heading.toFixed(4),
      spin: k.isSpinning ? 1 : 0,
      wall: k.onWall ? 1 : 0,
      lat: +tr.query(k.position, k.trackIdx).lateral.toFixed(2),
    });
    prevH = k.heading; prevT = now;
  }, 50);
  press('KeyW', true); press('KeyA', true);
  setTimeout(() => { press('KeyW', false); press('KeyA', false); clearInterval(window.__fadeIv); window.__fadeIv = null; }, holdMs);
  return 'fade armed';
};
window.__fadeReport = () => {
  const rec = (window.__fadeRec ?? []).filter(r => !r.spin);
  const bands = [[0, 0.4], [0.4, 0.8], [0.8, 1.2], [1.2, 1.6], [1.6, 2.0], [2.0, 2.4], [2.4, 3.0], [3.0, 4.0], [4.0, 6.0]];
  const out = bands.map(([lo, hi]) => {
    const rs = rec.filter(r => r.fs >= lo && r.fs < hi);
    if (!rs.length) return { band: `${lo}-${hi}`, n: 0 };
    const yaw = rs.reduce((a, r) => a + r.yawRate, 0) / rs.length;
    return { band: `${lo}-${hi} m/s`, n: rs.length, avgYawRate: +yaw.toFixed(3), min: +Math.min(...rs.map(r => r.yawRate)).toFixed(3), max: +Math.max(...rs.map(r => r.yawRate)).toFixed(3) };
  });
  const spins = (window.__fadeRec ?? []).filter(r => r.spin).length;
  return { bands: out, n: rec.length, spinSamples: spins };
};
'fade probe v2 installed';
