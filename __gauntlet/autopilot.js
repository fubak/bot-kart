(() => {
  const g = window.__game;
  if (!g) return 'no game';
  if (window.__ap) clearInterval(window.__ap);
  if (window.__logIv) clearInterval(window.__logIv);
  window.__log = [];
  window.__apEvents = [];
  const TICK = 50;
  const press = (c, on) => window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code: c }));
  const releaseAll = () => { for (const c of ['KeyW','KeyS','KeyA','KeyD','ShiftLeft']) press(c, false); };
  window.__apOff = () => { clearInterval(window.__ap); window.__ap = null; releaseAll(); return 'ap off'; };
  let lastWall = -1, lastBoost = 0;
  const sAng = (a, b) => Math.atan2(a.z * b.x - a.x * b.z, a.x * b.x + a.z * b.z);
  window.__ap = setInterval(() => {
    const k = g.kart, tr = g.track;
    if (!g.race.allowsDrive) { releaseAll(); return; }
    if (g.race.player.finished) { releaseAll(); return; }
    const fwd = k.velocity.dot(k.forward());
    const q = tr.query(k.position);
    const lateral = q.lateral, tanNow = q.tangent;
    let look = Math.min(7 + 0.55 * Math.max(0, fwd), 26);
    if (Math.abs(lateral) > 3.5) look *= 0.5;
    const p = tr.lookaheadPoint(k.position, look);
    const toT = p.clone().sub(k.position).setY(0);
    let steer = 0;
    if (toT.lengthSq() > 1e-6) {
      toT.normalize();
      const desired = Math.atan2(-toT.x, -toT.z);
      let err = desired - k.heading;
      err = Math.atan2(Math.sin(err), Math.cos(err));
      steer = Math.max(-1, Math.min(1, -err * 2.4));
    }
    const horizon = Math.max(look * 1.4, Math.max(0, fwd) * 1.1);
    let minR = Infinity;
    for (const f of [0.35, 0.7, 1.0]) {
      const d = Math.max(horizon * f, 1);
      const pp = tr.lookaheadPoint(k.position, d);
      const tan = tr.tangentAt(tr.nearestIndex(pp));
      const ang = Math.abs(sAng(tanNow, tan));
      if (ang > 1e-4) minR = Math.min(minR, d / ang);
    }
    let target = 28;
    if (minR < Infinity) target = Math.min(target, Math.max(Math.sqrt(26 * minR), 8));
    const nearD = Math.max(look * 0.6, 6);
    const np = tr.lookaheadPoint(k.position, nearD);
    const tanN = tr.tangentAt(tr.nearestIndex(np));
    const turnN = sAng(tanNow, tanN);
    const rNow = Math.abs(turnN) > 1e-4 ? nearD / Math.abs(turnN) : Infinity;
    const drifting = k.driftDir !== 0;
    let drift;
    if (drifting) {
      drift = rNow < 30 && fwd > 9;
    } else {
      drift = rNow < 17 && fwd > 13 && steer !== 0;
    }
    press('KeyW', fwd <= target);
    press('KeyS', fwd > target * 1.08);
    const sKey = steer < 0 ? 'KeyA' : 'KeyD';
    const sMag = Math.min(1, Math.abs(steer));
    if (sMag < 0.06) { press('KeyA', false); press('KeyD', false); }
    else {
      press(sKey === 'KeyA' ? 'KeyD' : 'KeyA', false);
      press(sKey, true);
      if (sMag < 0.98) setTimeout(() => press(sKey, false), sMag * TICK);
    }
    press('ShiftLeft', drift);
    if (k.lastWallHit !== lastWall) { lastWall = k.lastWallHit; window.__apEvents.push({ t: +g.sim.time.toFixed(1), ev: 'wallHit', sev: +k.lastWallImpact.toFixed(2), spd: +fwd.toFixed(1) }); }
    if (k.boostTimer > 0 && lastBoost <= 0) window.__apEvents.push({ t: +g.sim.time.toFixed(1), ev: 'boost', spd: +fwd.toFixed(1) });
    lastBoost = k.boostTimer;
  }, TICK);
  window.__logIv = setInterval(() => {
    const k = g.kart;
    window.__log.push({
      t: +g.sim.time.toFixed(2),
      ph: g.race.phase[0],
      lap: g.race.player.lap,
      pos: g.race.positionOf(0),
      spd: +k.forwardSpeed.toFixed(1),
      st: k.state[0],
      chg: +k.driftCharge.toFixed(2),
      bst: +k.boostTimer.toFixed(1),
      slp: +k.slipAngle.toFixed(2),
      ww: g.race.player.wrongWay ? 1 : 0,
      lat: +g.track.query(k.position).lateral.toFixed(1),
      fin: g.race.player.finished ? 1 : 0,
      ai: g.aiKarts.map((a, i) => [
        g.race.racers[i + 1].lap,
        +a.forwardSpeed.toFixed(1),
        a.state[0],
        +g.track.query(a.position).lateral.toFixed(1),
        g.race.racers[i + 1].finished ? 1 : 0,
        g.race.racers[i + 1].wrongWay ? 1 : 0,
        g.race.positionOf(i + 1),
      ]),
    });
  }, 200);
  return 'ap+log installed';
})()
