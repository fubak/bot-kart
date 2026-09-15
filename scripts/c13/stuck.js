// Critic-13 STUCK-hint probe: watches the hint element's display while
// keys are held. window.__stuckRec accumulates {t, hint, h, fs, lat}.
window.__stuckEl = () =>
  [...document.querySelectorAll('div')].find(d => d.textContent.includes('STUCK?'));
window.__stuckWatch = (ms = 6000) => {
  const k = window.__game.kart, tr = window.__game.track;
  if (window.__stIv) clearInterval(window.__stIv);
  const rec = []; const t0 = performance.now();
  window.__stuckRec = rec;
  window.__stIv = setInterval(() => {
    const el = window.__stuckEl();
    rec.push({
      t: +((performance.now() - t0) / 1000).toFixed(2),
      hint: el && el.style.display === 'block' ? 1 : 0,
      h: +k.heading.toFixed(3), fs: +k.forwardSpeed.toFixed(2),
      lat: +tr.query(k.position, k.trackIdx).lateral.toFixed(2),
      wall: k.onWall ? 1 : 0,
    });
  }, 100);
  setTimeout(() => { clearInterval(window.__stIv); window.__stIv = null; }, ms);
  return 'watching';
};
window.__stuckReport = () => {
  const rec = window.__stuckRec ?? [];
  const first = rec.find(r => r.hint);
  return {
    n: rec.length,
    hintFiredAt: first ? first.t : null,
    hintSamples: rec.filter(r => r.hint).length,
    dh: rec.length ? +(rec[rec.length - 1].h - rec[0].h).toFixed(3) : 0,
    endFs: rec.length ? rec[rec.length - 1].fs : 0,
    tail: rec.slice(-6),
  };
};
const press = (c, on) => window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code: c }));
window.__keys = (...codes) => { for (const c of ['KeyW','KeyS','KeyA','KeyD','ShiftLeft']) press(c, codes.includes(c)); };
'stuck probe installed';
