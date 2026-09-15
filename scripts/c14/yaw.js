// Critic-14 pivot→speedFactor handoff probe — fine-grained.
// Teleport to a straight, hold W+A, sample yaw rate vs forwardSpeed at
// 100 Hz, then bin into 0.5 m/s bands across 0→6+ m/s. Critic-13's LOW #1
// was a sag to ~0.15 rad/s at 2.0–2.4 m/s; the fade now ends at 5 m/s.
window.__yawRun = (idx, holdMs = 6000) => {
  const g = window.__game, k = g.kart, tr = g.track;
  const s = tr.samples[idx];
  k.reset(s.point.clone(), Math.atan2(-s.tangent.x, -s.tangent.z));
  const press = (c, on) => window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code: c }));
  ['KeyW', 'KeyS', 'KeyA', 'KeyD'].forEach(c => press(c, false));
  if (window.__yawIv) clearInterval(window.__yawIv);
  const rec = []; const t0 = performance.now();
  window.__yawRec = rec;
  let prevH = k.heading, prevT = t0;
  window.__yawIv = setInterval(() => {
    const now = performance.now();
    const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
    const dh = wrap(k.heading - prevH);
    const dt = (now - prevT) / 1000;
    rec.push({
      t: +((now - t0) / 1000).toFixed(3),
      fs: +k.forwardSpeed.toFixed(3),
      yawRate: +(dh / Math.max(dt, 1e-4)).toFixed(4),
      spin: k.isSpinning ? 1 : 0,
      wall: k.onWall ? 1 : 0,
    });
    prevH = k.heading; prevT = now;
  }, 10);
  press('KeyW', true); press('KeyA', true);
  setTimeout(() => {
    press('KeyW', false); press('KeyA', false);
    clearInterval(window.__yawIv); window.__yawIv = null;
  }, holdMs);
  return 'yaw armed idx=' + idx;
};
window.__yawReport = () => {
  const rec = (window.__yawRec ?? []).filter(r => !r.spin && !r.wall && r.fs >= 0);
  const bands = [];
  for (let lo = 0; lo < 7; lo += 0.5) bands.push([lo, lo + 0.5]);
  const out = bands.map(([lo, hi]) => {
    const rs = rec.filter(r => r.fs >= lo && r.fs < hi);
    if (!rs.length) return { band: `${lo}-${hi}`, n: 0 };
    const ys = rs.map(r => r.yawRate).sort((a, b) => a - b);
    return {
      band: `${lo}-${hi} m/s`, n: rs.length,
      mean: +(ys.reduce((a, b) => a + b, 0) / ys.length).toFixed(3),
      p10: +ys[Math.floor(ys.length * 0.1)].toFixed(3),
      min: +ys[0].toFixed(3),
    };
  });
  return { bands: out, n: rec.length, wallSamp: (window.__yawRec ?? []).filter(r => r.wall).length };
};
'yaw probe installed';
