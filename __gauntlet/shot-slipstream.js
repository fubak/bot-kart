async (page) => {
  await page.evaluate(() => {
    const g = window.__game;
    const kart = g.kart, leader = g.aiKarts[0];
    kart.draftCdUntil = -1; kart.draftLeader = null;
    window.__pin = setInterval(() => {
      const f = leader.forward();
      kart.position.copy(leader.position).addScaledVector(f, -5.5);
      kart.position.y = leader.position.y;
      kart.heading = leader.heading;
      if (kart.slipstreamT <= 0) kart.velocity.copy(leader.velocity);
      if (kart.slipstreamT > 0) clearInterval(window.__pin);
    }, 20);
  });
  await page.waitForFunction(() => window.__game.kart.slipstreamT > 0.7, { timeout: 15000 });
  await page.screenshot({ path: 'C:/github/bot-kart/docs/gauntlet/evidence/wave20/game-slipstream-burst.png' });
  const state = await page.evaluate(() => ({
    slip: +window.__game.kart.slipstreamT.toFixed(2),
    v: +window.__game.kart.forwardSpeed.toFixed(1),
    leaderV: +window.__game.aiKarts[0].forwardSpeed.toFixed(1),
    fired: window.__game.kart.draftsFired,
  }));
  console.log('STATE ' + JSON.stringify(state));
}
