// Minimal CDP shell for gauntlet verification: spawns headless Chrome,
// attaches to the first page target, and reads commands from stdin —
//   nav <url>            → Page.navigate
//   key <Code>           → Input.dispatchKeyEvent keyDown+keyUp (trusted)
//   hold <Code>          → keyDown only (keeps drive keys held)
//   shot <absPath.png>   → Page.captureScreenshot
//   <anything else>      → Runtime.evaluate (awaitPromise, returnByValue)
// Prints JSON results; console API messages are forwarded as CONSOLE: lines.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import * as readline from 'node:readline';

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
    const page = targets.find((t) => t.type === 'page');
    if (page) {
      ws = new WebSocket(page.webSocketDebuggerUrl);
      break;
    }
  } catch { /* retry */ }
  await wait(300);
}
if (!ws) { console.log('FATAL no page target'); process.exit(1); }
await new Promise((r) => { ws.onopen = r; });

let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled') {
    const txt = (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
    console.log('CONSOLE:' + m.params.type + ': ' + txt.slice(0, 400));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    console.log('CONSOLE:exception: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 500));
  }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id;
  pending.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
  setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error('timeout ' + method)); } }, 30000);
});

await send('Runtime.enable');
await send('Page.enable');

const VK = { Enter: 13, Escape: 27, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Space: 32, Backspace: 8, ShiftLeft: 16 };
const keyName = (code) => {
  if (code.startsWith('Key')) return code.slice(3).toLowerCase();
  if (code === 'Space') return ' ';
  return code;
};

const rl = readline.createInterface({ input: process.stdin });
console.log('READY');
rl.on('line', async (line) => {
  line = line.trim();
  if (!line) return;
  try {
    if (line.startsWith('nav ')) {
      const r = await send('Page.navigate', { url: line.slice(4) });
      console.log('NAV ' + JSON.stringify(r.result ?? r.error));
    } else if (line.startsWith('key ')) {
      const code = line.slice(4);
      for (const type of ['keyDown', 'keyUp']) {
        await send('Input.dispatchKeyEvent', { type, code, key: keyName(code), windowsVirtualKeyCode: VK[code] ?? code.charCodeAt(4) ?? 0 });
      }
      console.log('KEY ' + code);
    } else if (line.startsWith('hold ')) {
      const code = line.slice(5);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: keyName(code), windowsVirtualKeyCode: VK[code] ?? 0 });
      console.log('HOLD ' + code);
    } else if (line.startsWith('shot ')) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(line.slice(5), Buffer.from(r.result.data, 'base64'));
      console.log('SHOT ' + line.slice(5));
    } else {
      const r = await send('Runtime.evaluate', { expression: line, awaitPromise: true, returnByValue: true });
      if (r.result?.exceptionDetails) console.log('ERR ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300));
      else console.log('EVAL ' + JSON.stringify(r.result?.result?.value));
    }
  } catch (err) {
    console.log('FAIL ' + err.message);
  }
});
