// SFX-DEEP verification pass 2: scrape loop (shallow grind), rumble loop
// (poll while crossing the apron), turbo:1 release. Appends into the
// existing proof JSON's `pass2` key.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const PORT = 9333;
const CHROME = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
// Outside the repo: vite's watcher EBUSY-crashes on locked session files.
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
  if (m.method === 'Runtime.exceptionThrown') {
    consoleErrs.push('exception');
    log('EXC', JSON.stringify(m.params.exceptionDetails).slice(0, 300));
  }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id;
  pending.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
  setTimeout(() => rej(new Error('timeout ' + method)), 30000);
});
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) { log('EVAL-ERR', expr.slice(0, 100), JSON.stringify(r.result.exceptionDetails).slice(0, 200)); return undefined; }
  return r.result?.result?.value;
};
const key = async (code, up = true) => {
  const VK = { Enter: 13, Space: 32, Backspace: 8, KeyP: 80, KeyW: 87, KeyA: 65, KeyD: 68 };
  const kn = code.startsWith('Key') ? code.slice(3).toLowerCase() : code === 'Space' ? ' ' : code;
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: kn, windowsVirtualKeyCode: VK[code] ?? 0 });
  if (up) await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: kn, windowsVirtualKeyCode: VK[code] ?? 0 });
};
const keyUp = (code) =>
  send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: code.slice(3).toLowerCase(), windowsVirtualKeyCode: 87 });

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: URL });
for (let i = 0; i < 100; i++) {
  if (await ev('!!(window.__game && window.__game.race)')) break;
  await wait(300);
}
log('game up:', await ev('window.__game.race.phase'));
const results = { consoleIssues: consoleErrs };
const snap = async (l) => {
  const s = await ev('JSON.stringify(window.__game.audio.sfxSnapshot())');
  log('SNAP', l, s);
  return s ? JSON.parse(s) : null;
};

await key('Enter');
await wait(3600);
results.afterGo = await snap('afterGo');

// --- scrape: aim ~12° into the RIGHT wall so the kart grinds at speed ---
await ev(`(() => {
  const g = window.__game, tr = g.track;
  const i = Math.floor(tr.sampleCount * 0.08);
  const p = tr.pointAt(i).clone().addScaledVector(tr.leftAt(i), -4.6);
  p.y = tr.heightAt(p, i);
  const t = tr.tangentAt(i);
  g.kart.reset(p, Math.atan2(-t.x, -t.z) - 0.2); // shallow angle → slide
  return 'armed';
})()`);
await key('KeyW', false); // hold
const scrapeSamples = [];
for (let i = 0; i < 14; i++) {
  await wait(250);
  const s = await ev(
    'JSON.stringify({sc:+__game.audio.loopLevels().scrape.toFixed(3),spd:+__game.kart.speed.toFixed(1),w:__game.kart.onWall,lat:+__game.track.query(__game.kart.position,__game.kart.trackIdx).lateral.toFixed(1)})',
  );
  scrapeSamples.push(s ? JSON.parse(s) : null);
}
await keyUp('KeyW');
results.scrapeSamples = scrapeSamples;
log('scrape samples', JSON.stringify(scrapeSamples));

// --- rumble: poll while the kart crosses the hairpin apron (side +1) ---
await ev(`(() => {
  const g = window.__game, tr = g.track;
  const i = Math.floor(tr.sampleCount * 0.605); // just inside zone start
  const p = tr.pointAt(i).clone().addScaledVector(tr.leftAt(i), 7.2);
  p.y = tr.heightAt(p, i);
  const t = tr.tangentAt(i);
  // steer slightly outward (left) so the kart holds the apron line
  g.kart.reset(p, Math.atan2(-t.x, -t.z) + 0.12);
  return 'armed';
})()`);
await key('KeyW', false);
const rumbleSamples = [];
for (let i = 0; i < 10; i++) {
  await wait(220);
  const s = await ev(
    'JSON.stringify({r:+__game.audio.loopLevels().rumble.toFixed(3),spd:+__game.kart.speed.toFixed(1),g:__game.kart.onGravel,surf:__game.track.query(__game.kart.position,__game.kart.trackIdx).surface,lat:+__game.track.query(__game.kart.position,__game.kart.trackIdx).lateral.toFixed(1)})',
  );
  rumbleSamples.push(s ? JSON.parse(s) : null);
}
await keyUp('KeyW');
results.rumbleSamples = rumbleSamples;
log('rumble samples', JSON.stringify(rumbleSamples));

// --- turbo:1 release via paused forced diff ---
await key('KeyP');
await wait(250);
await ev('__game.kart.grounded = true; __game.kart.driftDir = 1; __game.kart.driftCharge = 1.2; "ok"');
await wait(250);
await ev('__game.kart.driftDir = 0; __game.kart.boostTimer = 1.4; "ok"');
await wait(300);
await key('KeyP');
results.final = await snap('final');

writeFileSync(
  OUT,
  JSON.stringify({ pass2: results, pass1: JSON.parse(readFileSync(OUT, 'utf8')) }, null, 2),
);
log('wrote', OUT, '| console issues:', consoleErrs.length);
chrome.kill();
process.exit(0);
