// Critic-14 steering dyno: holds the kart at a fixed speed (position
// pinned, velocity clamped each rAF) with W+A held, and measures the
// resulting yaw rate. Sweeps 0 → 7 m/s. Because fwdSpeed is held at each
// target, every band gets a clean steady-state reading — no accel-ramp
// sampling noise. Contamination (kart contact / spin) is flagged.
window.__dyno = (idx, holdPerStepMs = 450) => {
  const g = window.__game, k = g.kart, tr = g.track;
  const s = tr.samples[idx];
  k.reset(s.point.clone(), Math.atan2(-s.tangent.x, -s.tangent.z));
  const press = (c, on) => window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code: c }));
  ['KeyW', 'KeyS', 'KeyA', 'KeyD'].forEach(c => press(c, false));
  press('KeyW', true); press('KeyA', true);
  const anchor = s.point.clone();
  const targets = [];
  for (let v = 0; v <= 7.001; v += 0.25) targets.push(+v.toFixed(2));
  const rec = [];
  window.__dynoRec = rec;
  let step = -1, stepStart = 0, prevH = k.heading, prevT = performance.now();
  const t0 = prevT;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  if (window.__dynoRaf) cancelAnimationFrame(window.__dynoRaf);
  const tick = (now) => {
    const target = targets[step] ?? 7.25;
    // Pin position (no wall/translation), clamp speed along current heading.
    k.position.copy(anchor);
    const fwd = k.forward();
    const fs = k.velocity.dot(fwd);
    if (Math.abs(fs - target) > 0.05) {
      k.velocity.copy(fwd.clone().multiplyScalar(target));
    }
    const dh = wrap(k.heading - prevH);
    const dt = (now - prevT) / 1000;
    if (step >= 0 && now - stepStart > 120) { // skip first 120ms of each step
      rec.push({
        v: target, t: +((now - t0) / 1000).toFixed(2),
        fs: +k.forwardSpeed.toFixed(3),
        yawRate: +(dh / Math.max(dt, 1e-4)).toFixed(4),
        spin: k.isSpinning ? 1 : 0, wall: k.onWall ? 1 : 0,
      });
    }
    prevH = k.heading; prevT = now;
    if (step === -1 || now - stepStart >= holdPerStepMs) {
      step++; stepStart = now;
      if (step >= targets.length) {
        press('KeyW', false); press('KeyA', false);
        window.__dynoRaf = null;
        return;
      }
    }
    window.__dynoRaf = requestAnimationFrame(tick);
  };
  window.__dynoRaf = requestAnimationFrame(tick);
  return `dyno armed idx=${idx} steps=${targets.length}`;
};
window.__dynoReport = () => {
  const rec = window.__dynoRec ?? [];
  const byV = {};
  for (const r of rec) {
    if (r.spin || r.wall) continue;
    (byV[r.v] = byV[r.v] ?? []).push(r.yawRate);
  }
  return Object.keys(byV).sort((a, b) => a - b).map(v => {
    const ys = byV[v].sort((a, b) => a - b);
    return { v: +v, n: ys.length, mean: +(ys.reduce((a, b) => a + b, 0) / ys.length).toFixed(3), min: +ys[0].toFixed(3), max: +ys[ys.length - 1].toFixed(3) };
  });
};
'dyno installed';
