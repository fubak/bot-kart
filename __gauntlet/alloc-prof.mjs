// Allocation profiler: HeapProfiler.startSampling over real racing.
// Real GPU (no swiftshader) so the profile matches live play.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const PORT = 9333;
const CHROME = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const PROFILE = 'C:/temp/botkart-alloc-profile';
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--window-size=1889,1381', '--mute-audio', '--autoplay-policy=no-user-gesture-required',
  'about:blank',
], { stdio: 'ignore' });
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
  setTimeout(() => rej(new Error('timeout ' + method)), 60000);
});
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) console.log('EVALERR', JSON.stringify(r.result.exceptionDetails).slice(0, 250));
  return r.result?.result?.value;
};
const key = async (code, up = true) => {
  const VK = { Enter: 13, KeyW: 87, KeyA: 65, KeyD: 68, KeyT: 84 };
  const kn = code.startsWith('Key') ? code.slice(3).toLowerCase() : code;
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: kn, windowsVirtualKeyCode: VK[code] ?? 0 });
  if (up) await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: kn, windowsVirtualKeyCode: VK[code] ?? 0 });
};
await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: 'http://localhost:5173' });
for (let i = 0; i < 100; i++) { if (await ev('!!(window.__game && window.__game.race)')) break; await wait(300); }
console.log('phase:', await ev('window.__game.race.phase'));
// GPU check — want real GPU, not swiftshader
console.log('gpu:', await ev(`(() => { const gl = window.__game.renderer.getContext(); const d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : '?'; })()`));
// Enter → race on PG; hold W so the player drives organically
await key('Enter');
await wait(3800);
await key('KeyW', false);
// Start heap sampling — fine granularity to catch the small per-frame churn
await send('HeapProfiler.enable');
await send('HeapProfiler.startSampling', { samplingInterval: 512 });
await wait(12000); // 12 s of racing
await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87 });
const stopRes = await send('HeapProfiler.stopSampling');
const profile = stopRes.result?.profile ?? stopRes.profile;
// Aggregate bytes per callsite (self size), keep top 40
const agg = new Map();
const walk = (node) => {
  const cf = node.callFrame;
  const key = `${cf.functionName || '(anon)'} ${cf.url.split('/').pop()}:${cf.lineNumber}`;
  let self = 0;
  for (const s of node.selfSize ? [node.selfSize] : []) self += s;
  agg.set(key, (agg.get(key) || 0) + self);
  for (const c of node.children || []) walk(c);
};
walk(profile.head);
const top = [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
const total = top.reduce((a, [, b]) => a + b, 0);
console.log('=== TOP ALLOCATORS (20s racing, bytes sampled) ===');
for (const [k, v] of top) console.log(`${(v / 1024).toFixed(0).padStart(7)} KB  ${k}`);
writeFileSync('C:/github/bot-kart/__gauntlet/alloc-profile.json', JSON.stringify(profile));
chrome.kill();
process.exit(0);
