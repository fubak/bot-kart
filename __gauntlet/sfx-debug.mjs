// Quick probe: what does the headless page actually show?
import { spawn } from 'node:child_process';

const PORT = 9333;
const CHROME = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const PROFILE = 'C:/github/bot-kart/__gauntlet/.chrome-profile';

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--window-size=1600,900',
  '--mute-audio',
  '--autoplay-policy=no-user-gesture-required',
  '--use-angle=swiftshader',
  'about:blank',
], { stdio: 'ignore' });
process.on('exit', () => { try { chrome.kill(); } catch {} });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let ws = null;
for (let i = 0; i < 60; i++) {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const targets = await res.json();
    console.log('targets:', targets.map((t) => `${t.type}:${t.url}`).join(' | '));
    const page = targets.find((t) => t.type === 'page');
    if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
  } catch { /* retry */ }
  await wait(300);
}
await new Promise((r) => { ws.onopen = r; });
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled') {
    const txt = (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
    console.log('CONSOLE:' + m.params.type + ': ' + txt.slice(0, 300));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    console.log('EXC: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 500));
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
  return r.result?.exceptionDetails ? 'ERR ' + JSON.stringify(r.result.exceptionDetails).slice(0, 200) : r.result?.result?.value;
};

await send('Runtime.enable');
await send('Page.enable');
const nav = await send('Page.navigate', { url: 'http://localhost:5173' });
console.log('nav:', JSON.stringify(nav.result ?? nav.error));
await wait(6000);
console.log('href:', await ev('location.href'));
console.log('title:', await ev('document.title'));
console.log('readyState:', await ev('document.readyState'));
console.log('canvas:', await ev('document.querySelectorAll("canvas").length'));
console.log('__game:', await ev('typeof window.__game'));
console.log('body text:', await ev('document.body && document.body.innerText.slice(0,200)'));
console.log('scripts:', await ev('Array.from(document.scripts).map(s=>s.src||s.type).join(",")'));
chrome.kill();
process.exit(0);
