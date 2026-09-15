// Diagnostic 2: NN zones are 0.53-0.565 and 0.7-0.8 (side +1) — scan them.
import { spawn } from 'node:child_process';
const PORT = 9333;
const CHROME = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const PROFILE = 'C:/temp/botkart-chrome-profile';
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--window-size=1600,900', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => { try { chrome.kill(); } catch {} });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let ws = null;
for (let i = 0; i < 60; i++) {
  try {
    const page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page');
    if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
  } catch {}
  await wait(300);
}
await new Promise((r) => { ws.onopen = r; });
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id;
  pending.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
  setTimeout(() => rej(new Error('timeout')), 30000);
});
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  return r.result?.exceptionDetails ? 'ERR ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300) : r.result?.result?.value;
};
const key = async (code, up = true) => {
  const VK = { Enter: 13, KeyW: 87, KeyA: 65, KeyD: 68 };
  const kn = code.startsWith('Key') ? code.slice(3).toLowerCase() : code;
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: kn, windowsVirtualKeyCode: VK[code] ?? 0 });
  if (up) await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: kn, windowsVirtualKeyCode: VK[code] ?? 0 });
};
const up = (code) => send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: code.slice(3).toLowerCase(), windowsVirtualKeyCode: 0 });
await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: 'http://localhost:5173' });
for (let i = 0; i < 100; i++) { if (await ev('!!(window.__game && window.__game.race)')) break; await wait(300); }
console.log('game:', await ev('window.__game.race.phase'), '| track:', await ev('__game.track.name'));
// Scan NN zone 2 (0.7-0.8, wider) for the gravel band
console.log('scan:', await ev(`(() => {
  const tr = window.__game.track, out = [];
  for (const frac of [0.72, 0.74, 0.76, 0.78]) {
    const i = Math.floor(tr.sampleCount * frac);
    for (const lat of [5.5, 6, 7, 8, 8.4]) {
      const p = tr.pointAt(i).clone().addScaledVector(tr.leftAt(i), lat);
      const q = tr.query(p, i);
      out.push([frac, lat, q.index, +q.lateral.toFixed(1), q.surface]);
    }
  }
  return JSON.stringify(out);
})()`));
// Start the race and drive on the apron
const { send: s2 } = { send };
await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Enter', key: 'Enter', windowsVirtualKeyCode: 13 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Enter', key: 'Enter', windowsVirtualKeyCode: 13 });
await wait(3600);
await ev(`(() => {
  const g = window.__game, tr = g.track;
  const i = Math.floor(tr.sampleCount * 0.73);
  const p = tr.pointAt(i).clone().addScaledVector(tr.leftAt(i), 6.8);
  p.y = tr.heightAt(p, i);
  const t = tr.tangentAt(i);
  g.kart.reset(p, Math.atan2(-t.x, -t.z));
  g.kart.trackIdx = i;
  return 'armed ' + i;
})()`);
await key('KeyW', false);
await key('KeyA', false);
const samples = [];
for (let i = 0; i < 14; i++) {
  await wait(220);
  const s = await ev('JSON.stringify({r:+__game.audio.loopLevels().rumble.toFixed(3),spd:+__game.kart.speed.toFixed(1),g:__game.kart.onGravel,surf:__game.track.query(__game.kart.position,__game.kart.trackIdx).surface,lat:+__game.track.query(__game.kart.position,__game.kart.trackIdx).lateral.toFixed(1)})');
  samples.push(s ? JSON.parse(s) : null);
}
await up('KeyW'); await up('KeyA');
console.log('drive:', JSON.stringify(samples));
console.log('snapshot:', await ev('JSON.stringify(__game.audio.sfxSnapshot())'));
chrome.kill();
process.exit(0);
