// SFX-DEEP verification pass 3: gravel rumble loop — place the kart just
// inside the road edge at the zone start and drive OUTWARD onto the apron
// (trackIdx pinned so the folded hairpin can't anchor the wrong leg).
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const PORT = 9333;
const CHROME = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const PROFILE = 'C:/temp/botkart-chrome-profile';
const URL = 'http://localhost:5173';
const OUT = 'C:/github/bot-kart/docs/gauntlet/evidence/wave20/sfx-proof.json';

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--window-size=1600,900', '--mute-audio',
  '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader',
  'about:blank',
], { stdio: 'ignore' });
process.on('exit', () => { try { chrome.kill(); } catch {} });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (...a) => console.log(`[+${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

let ws = null;
for (let i = 0; i < 60; i++) {
  try {
    const page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json())
      .find((t) => t.type === 'page');
    if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
  } catch { /* retry */ }
  await wait(300);
}
await new Promise((r) => { ws.onopen = r; });
let id = 0;
const pending = new Map();
const consoleErrs = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) {
    consoleErrs.push(m.params.type);
    log('CONSOLE-' + m.params.type, (m.params.args || []).map((a) => a.value ?? '').join(' ').slice(0, 200));
  }
  if (m.method === 'Runtime.exceptionThrown') { consoleErrs.push('exception'); log('EXC', JSON.stringify(m.params.exceptionDetails).slice(0, 300)); }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id;
  pending.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
  setTimeout(() => rej(new Error('timeout ' + method)), 30000);
});
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) { log('EVAL-ERR', expr.slice(0, 90), JSON.stringify(r.result.exceptionDetails).slice(0, 160)); return undefined; }
  return r.result?.result?.value;
};
const key = async (code, up = true) => {
  const VK = { Enter: 13, KeyW: 87, KeyA: 65, KeyD: 68 };
  const kn = code.startsWith('Key') ? code.slice(3).toLowerCase() : code;
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: kn, windowsVirtualKeyCode: VK[code] ?? 0 });
  if (up) await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: kn, windowsVirtualKeyCode: VK[code] ?? 0 });
};
const up = (code) =>
  send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: code.slice(3).toLowerCase(), windowsVirtualKeyCode: 0 });

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: URL });
for (let i = 0; i < 100; i++) {
  if (await ev('!!(window.__game && window.__game.race)')) break;
  await wait(300);
}
log('game up:', await ev('window.__game.race.phase'));
const results = {};
await key('Enter');
await wait(3600);
results.afterGo = JSON.parse(await ev('JSON.stringify(window.__game.audio.sfxSnapshot())') ?? 'null');
log('go', JSON.stringify(results.afterGo?.byTag));

// Diagnose the zone geometry first: which side, how the apron lies.
log('zone check:', await ev(`(() => {
  const tr = window.__game.track;
  const i = Math.floor(tr.sampleCount * 0.62);
  const q = tr.query(tr.pointAt(i).clone().addScaledVector(tr.leftAt(i), 7.2), i);
  return JSON.stringify({ lat: +q.lateral.toFixed(1), surf: q.surface, i });
})()`));

// Place at lat +6.4 (just past the gravel line at 5.5), heading along the
// tangent, trackIdx pinned; then hold W and a light LEFT steer (KeyA) to
// press outward onto the apron through the zone.
await ev(`(() => {
  const g = window.__game, tr = g.track;
  const i = Math.floor(tr.sampleCount * 0.615);
  const p = tr.pointAt(i).clone().addScaledVector(tr.leftAt(i), 6.6);
  p.y = tr.heightAt(p, i);
  const t = tr.tangentAt(i);
  g.kart.reset(p, Math.atan2(-t.x, -t.z));
  g.kart.trackIdx = i; // pin the leg — the hairpin fold must not re-anchor
  return 'armed ' + i;
})()`);
await key('KeyW', false);
await key('KeyA', false); // gentle left steer holds the apron line
const rumbleSamples = [];
for (let i = 0; i < 14; i++) {
  await wait(220);
  const s = await ev(
    'JSON.stringify({r:+__game.audio.loopLevels().rumble.toFixed(3),spd:+__game.kart.speed.toFixed(1),g:__game.kart.onGravel,surf:__game.track.query(__game.kart.position,__game.kart.trackIdx).surface,lat:+__game.track.query(__game.kart.position,__game.kart.trackIdx).lateral.toFixed(1)})',
  );
  rumbleSamples.push(s ? JSON.parse(s) : null);
}
await up('KeyW'); await up('KeyA');
results.rumbleSamples = rumbleSamples;
log('rumble', JSON.stringify(rumbleSamples));
results.final = JSON.parse(await ev('JSON.stringify(window.__game.audio.sfxSnapshot())') ?? 'null');

const prev = JSON.parse(readFileSync(OUT, 'utf8'));
writeFileSync(OUT, JSON.stringify({ ...prev, pass3: results }, null, 2));
log('wrote', OUT, '| console issues:', consoleErrs.length);
chrome.kill();
process.exit(0);
