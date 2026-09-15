async (page) => {
  // Hide the PAUSED overlay (visibility persists; HUD rewrites display only)
  await page.evaluate(() => {
    const ov = [...document.querySelectorAll('div')].find(
      (d) => d.firstChild && d.firstChild.nodeType === 3 && d.textContent.startsWith('PAUSED'),
    );
    if (ov) ov.style.visibility = 'hidden';
  });
  // Sim is paused: manual steps emit tier-3 violet sparks, shot fires
  // immediately so the 0.3-0.5 s particles are still dense on screen.
  await page.evaluate(() => {
    const g = window.__game;
    const track = g.track, kart = g.kart;
    const dt = 1 / 120;
    let idx = kart.trackIdx >= 0 ? kart.trackIdx : 20;
    let t = g.sim.time;
    kart.driftDir = kart.driftDir || 1;
    for (let s = 0; s < 10; s++) {
      t += dt;
      idx += (20 * dt) / track.sampleSpacing;
      const tan = track.tangentAt(Math.floor(idx));
      const kp = track.pointAt(Math.floor(idx));
      kart.position.copy(kp);
      kart.position.y = track.heightAt(kp, Math.floor(idx));
      kart.heading = Math.atan2(-tan.x, -tan.z);
      const vh = kart.heading - 0.44 * kart.driftDir;
      kart.velocity.set(-Math.sin(vh), 0, -Math.cos(vh)).multiplyScalar(20);
      kart.driftCharge = Math.max(kart.driftCharge, 2.0);
      kart.update(dt, { throttle: 1, brake: 0, steer: 0.7, drift: true }, track, t);
    }
  });
  await page.screenshot({ path: 'C:/github/bot-kart/docs/gauntlet/evidence/wave20/game-tier3-sparks.png' });
  const state = await page.evaluate(() => ({
    drift: window.__game.kart.driftDir,
    charge: +window.__game.kart.driftCharge.toFixed(2),
  }));
  console.log('STATE ' + JSON.stringify(state));
}
