// Critic-16 persistent CDP shell — attaches to the ALREADY-RUNNING Chrome
// on :9333 (does NOT spawn a browser). Commands on stdin:
//   key <Code>      trusted keyDown+keyUp
//   hold <Code>     keyDown only
//   shot <path>     PNG screenshot
//   wait <ms> <js>  poll eval until truthy (default timeout = ms)
//   <else>          Runtime.evaluate (awaitPromise, returnByValue)
// Prints one JSON line per command. Console/exceptions forwarded as CONSOLE:.
const PORT = 9333;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = targets.find((t) => t.type === 'page');
if (!page) { console.log('FATAL no page'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });

let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled') {
    const txt = (m.params.args || []).map((a) => a.value ?? a.description ?? a.type ?? '').join(' ');
    console.log('CONSOLE:' + m.params.type + ': ' + txt.slice(0, 400));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    console.log('CONSOLE:exception: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 600));
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
const keyName = (code) => (code.startsWith('Key') ? code.slice(3).toLowerCase() : code === 'Space' ? ' ' : code);
const vkFor = (code) => VK[code] ?? (code.startsWith('Key') ? code.charCodeAt(3) : code.startsWith('Digit') ? code.charCodeAt(5) : 0);
const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) return { __err: (r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text ?? '').slice(0, 500) };
  return r.result?.result?.value;
};

import * as readline from 'node:readline';
import { writeFileSync } from 'node:fs';
const rl = readline.createInterface({ input: process.stdin });
console.log('READY');
rl.on('line', async (line) => {
  line = line.trim();
  if (!line) return;
  const [cmd, ...rest] = line.split(' ');
  try {
    if (cmd === 'key') {
      for (const type of ['keyDown', 'keyUp']) {
        await send('Input.dispatchKeyEvent', { type, code: rest[0], key: keyName(rest[0]), windowsVirtualKeyCode: vkFor(rest[0]) });
      }
      console.log(JSON.stringify('key ' + rest[0]));
    } else if (cmd === 'hold') {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', code: rest[0], key: keyName(rest[0]), windowsVirtualKeyCode: vkFor(rest[0]) });
      console.log(JSON.stringify('hold ' + rest[0]));
    } else if (cmd === 'up') {
      await send('Input.dispatchKeyEvent', { type: 'keyUp', code: rest[0], key: keyName(rest[0]), windowsVirtualKeyCode: vkFor(rest[0]) });
      console.log(JSON.stringify('up ' + rest[0]));
    } else if (cmd === 'shot') {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(rest[0], Buffer.from(r.result.data, 'base64'));
      console.log(JSON.stringify('shot ' + rest[0]));
    } else if (cmd === 'wait') {
      const ms = +rest[0];
      const expr = rest.slice(1).join(' ');
      const t0 = Date.now();
      let out = null;
      while (Date.now() - t0 < ms) {
        out = await evalJs(expr);
        if (out) break;
        await wait(400);
      }
      console.log(JSON.stringify({ waited: Date.now() - t0, value: out }));
    } else {
      const out = await evalJs(line);
      console.log(JSON.stringify(out));
    }
  } catch (e) {
    console.log(JSON.stringify({ __err: String(e).slice(0, 300) }));
  }
});
