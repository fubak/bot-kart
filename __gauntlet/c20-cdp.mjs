// Critic-20 CDP driver: attaches to the already-running headless Chrome
// (port 9333) and executes ONE command per invocation, so the page state
// persists across calls. Usage:
//   node c20-cdp.mjs eval '<expression>'   → Runtime.evaluate (await, byValue)
//   node c20-cdp.mjs key  <Code>           → trusted keyDown+keyUp
//   node c20-cdp.mjs hold <Code>           → trusted keyDown only
//   node c20-cdp.mjs rel  <Code>           → trusted keyUp only
//   node c20-cdp.mjs shot <absPath.png>    → screenshot
//   node c20-cdp.mjs nav  <url>            → navigate
// Console events while attached are printed as CONSOLE: lines (in-page
// __conLog hook is the durable log across calls).
import { writeFileSync } from 'node:fs';

const PORT = 9333;
const [, , cmd, ...rest] = process.argv;
const arg = rest.join(' ');

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = targets.find((t) => t.type === 'page');
if (!page) { console.log('FATAL no page'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

let id = 0;
const pending = new Map();
const conlines = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled') {
    const txt = (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
    conlines.push('CONSOLE:' + m.params.type + ': ' + txt.slice(0, 300));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    conlines.push('CONSOLE:exception: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 400));
  }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id;
  pending.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
  setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error('timeout ' + method)); } }, 25000);
});

await send('Runtime.enable');
if (cmd === 'shot' || cmd === 'nav') await send('Page.enable');

const VK = { Enter: 13, Escape: 27, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Space: 32, Backspace: 8, ShiftLeft: 16, ShiftRight: 16 };
const keyName = (code) => code.startsWith('Key') ? code.slice(3).toLowerCase() : code === 'Space' ? ' ' : code;
const dispatch = async (type, code) =>
  send('Input.dispatchKeyEvent', { type, code, key: keyName(code), windowsVirtualKeyCode: VK[code] ?? 0 });

try {
  if (cmd === 'nav') {
    const r = await send('Page.navigate', { url: arg });
    console.log('NAV ' + JSON.stringify(r.result ?? r.error));
    await new Promise((r) => setTimeout(r, 800));
  } else if (cmd === 'key') {
    await dispatch('keyDown', arg); await dispatch('keyUp', arg);
    console.log('KEY ' + arg);
  } else if (cmd === 'hold') {
    await dispatch('keyDown', arg); console.log('HOLD ' + arg);
  } else if (cmd === 'rel') {
    await dispatch('keyUp', arg); console.log('REL ' + arg);
  } else if (cmd === 'shot') {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(arg, Buffer.from(r.result.data, 'base64'));
    console.log('SHOT ' + arg);
  } else if (cmd === 'eval') {
    const r = await send('Runtime.evaluate', { expression: arg, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) console.log('ERR ' + JSON.stringify(r.result.exceptionDetails).slice(0, 500));
    else console.log('EVAL ' + JSON.stringify(r.result?.result?.value));
  } else if (cmd === 'sleep') {
    await new Promise((r) => setTimeout(r, parseInt(arg) || 1000));
    console.log('SLEPT ' + arg);
  }
} catch (err) {
  console.log('FAIL ' + err.message);
}
for (const l of conlines) console.log(l);
ws.close();
process.exit(0);
