// Critic-17 one-shot CDP client — attaches to Chrome on :9333, runs ONE
// command, prints JSON result, exits. Usage:
//   node c17-eval.mjs eval "<js>"          Runtime.evaluate (awaitPromise, returnByValue)
//   node c17-eval.mjs key <Code>           trusted keyDown+keyUp
//   node c17-eval.mjs hold <Code>          keyDown only
//   node c17-eval.mjs up <Code>            keyUp only
//   node c17-eval.mjs shot <path>          PNG screenshot
//   node c17-eval.mjs conmon               dump collected console buffer
// A persistent listener process (c17-conmon.mjs) collects console lines
// separately — this client intentionally does NOT drain events.
const PORT = 9333;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const [, , cmd, ...rest] = process.argv;
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = targets.find((t) => t.type === 'page' && t.url.includes('localhost:5173'));
if (!page) { console.log('FATAL no page'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
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
  setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error('timeout ' + method)); } }, 30000);
});
await send('Runtime.enable');
await send('Page.enable');

const VK = { Enter: 13, Escape: 27, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Space: 32, Backspace: 8, ShiftLeft: 16, Tab: 9 };
const keyName = (code) => (code.startsWith('Key') ? code.slice(3).toLowerCase() : code === 'Space' ? ' ' : code === 'Tab' ? 'Tab' : code);
const vkFor = (code) => VK[code] ?? (code.startsWith('Key') ? code.charCodeAt(3) : code.startsWith('Digit') ? code.charCodeAt(5) : 0);
const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) return { __err: (r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text ?? '').slice(0, 700) };
  return r.result?.result?.value;
};

try {
  if (cmd === 'eval') {
    console.log(JSON.stringify(await evalJs(rest.join(' '))));
  } else if (cmd === 'key') {
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
    const { writeFileSync } = await import('node:fs');
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
  }
} catch (e) {
  console.log(JSON.stringify({ __err: String(e).slice(0, 300) }));
}
ws.close();
process.exit(0);
