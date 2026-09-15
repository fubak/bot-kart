// C21 probe library — fetched+eval'd into the game page.
// Each returns a Promise resolving a plain-object result.
window.__c21 = {
  // Start a fresh race from title and wait for 'racing'.
  startRace() {
    const g = window.__game;
    return new Promise((res) => {
      if (g.race.phase === 'title') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
      const iv = setInterval(() => {
        if (g.race.phase === 'racing') { clearInterval(iv); res(true); }
      }, 40);
    });
  },
  // Teleport kart onto the first ACTIVE item box; resolves when the
  // player's roulette is spinning, with a snapshot.
  grabBox() {
    const g = window.__game;
    return new Promise((res) => {
      const b = g.items.boxes.find((x) => x.mesh.visible);
      if (!b) return res({ noBox: true });
      g.items.held[0] = null;
      const ni = g.track.nearestIndex(b.pos);
      g.kart.position.set(b.pos.x, b.pos.y + 0.2, b.pos.z);
      g.kart.trackIdx = ni;
      g.kart.velocity.set(0, 0, 0);
      g.race.racers[0].resync(g.kart.position, ni);
      const iv = setInterval(() => {
        if (g.items.rouletteT[0] > 0) {
          clearInterval(iv);
          res({ roul: +g.items.rouletteT[0].toFixed(2), icon: g.items.rouletteIcon[0] });
        }
      }, 15);
      setTimeout(() => res({ spinTimeout: true }), 4000);
    });
  },
  sfx() { return window.__game.audio.sfxSnapshot(); },
  tag(t) { return this.sfx().byTag[t] || 0; },
  key(c) { window.dispatchEvent(new KeyboardEvent('keydown', { code: c })); },
  keyUp(c) { window.dispatchEvent(new KeyboardEvent('keyup', { code: c })); },
  wait(ms) { return new Promise((r) => setTimeout(r, ms)); },
};
'c21 probes ready';
