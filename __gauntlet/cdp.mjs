// CDP driver for gauntlet verification — connects to the already-running
// headless Chrome on :9333 (see launch-chrome.ps1) and runs ONE command:
//   node cdp.mjs nav <url>
//   node cdp.mjs key <Code>        trusted keyDown+keyUp
//   node cdp.mjs hold <Code>       keyDown only
//   node cdp.mjs shot <absPath>    PNG screenshot
//   node cdp.mjs eval <js>         Runtime.evaluate (awaitPromise, returnByValue)
//   node cdp.mjs wait <ms> <js>    poll eval until truthy (timeout 60s)
//   node cdp.mjs console           drain recent console/exceptions
// Console API calls + exceptions seen while this script runs are printed.
import { writeFileSync } from 'node:fs';

const PORT = 9333;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = targets.find((t) => t.type === 'page');
if (!page) { console.log('FATAL no page target'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });

let id = 0;
const pending = new Map();
const events = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled') {
    const txt = (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
    events.push(`console.${m.params.type}: ${txt}`.slice(0, 300));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    events.push('exception: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 400));
  }
  if (m.method === 'Page.screencastFrame') {
    // Must ACK or Chrome stops producing frames.
    ws.send(JSON.stringify({ id: ++id, method: 'Page.screencastFrameAck', params: { sessionId: m.params.sessionId } }));
  }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id;
  pending.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
  setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error('timeout ' + method)); } }, 60000);
});

await send('Runtime.enable');
await send('Page.enable');

const VK = { Enter: 13, Escape: 27, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Space: 32, Backspace: 8, ShiftLeft: 16 };
const keyName = (code) => (code.startsWith('Key') ? code.slice(3).toLowerCase() : code === 'Space' ? ' ' : code);
// Letter keys need a real VK (uppercase ASCII) or Chrome drops the event.
const vkFor = (code) => VK[code] ?? (code.startsWith('Key') ? code.charCodeAt(3) : code.startsWith('Digit') ? code.charCodeAt(5) : 0);

const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) return { __err: r.result.exceptionDetails };
  return r.result?.result?.value;
};

const [cmd, ...rest] = process.argv.slice(2);
let out;
if (cmd === 'winpos') {
  // Browser-level session: normalize + move the window (un-occludes an
  // off-screen window so headed rAF stays at full rate).
  const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
  const bws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r) => { bws.onopen = r; });
  let bid = 0;
  const bsend = (method, params = {}) => new Promise((res) => {
    const i = ++bid;
    const p2 = new Map();
    bws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && p2.has(m.id)) { p2.get(m.id)(m); p2.delete(m.id); } };
    p2.set(i, res);
    bws.send(JSON.stringify({ id: i, method, params }));
  });
  const win = (await bsend('Browser.getWindowForTarget', { targetId: page.id })).result;
  await bsend('Browser.setWindowBounds', { windowId: win.windowId, bounds: { windowState: 'normal' } });
  await bsend('Browser.setWindowBounds', { windowId: win.windowId, bounds: { left: +rest[0], top: +rest[1], width: +(rest[2] ?? 1100), height: +(rest[3] ?? 620) } });
  console.log('window moved to ' + rest[0] + ',' + rest[1]);
  bws.close();
  process.exit(0);
}
if (cmd === 'nav') out = (await send('Page.navigate', { url: rest[0] })).result;
else if (cmd === 'navx') {
  // Navigate with the rAF→setTimeout shim injected before any page script —
  // the game loop then runs at real cadence even when the host is locked /
  // headless can't produce compositor frames.
  await send('Page.addScriptToEvaluateOnNewDocument', {
    // MessageChannel pump — NOT timer-throttled on hidden/locked hosts, so
    // the loop runs as fast as a frame takes (≈real-time). Each callback
    // gets the real clock → game frameDt stays honest.
    source: 'window.__rafQ=[];const __ch=new MessageChannel();let __rafP=0;__ch.port2.onmessage=()=>{const q=window.__rafQ;window.__rafQ=[];__rafP=0;const t=performance.now();for(const c of q){try{c(t);}catch(e){window.__rafErr=String(e.stack||e);}}};window.requestAnimationFrame=(cb)=>{window.__rafQ.push(cb);if(!__rafP){__rafP=1;__ch.port1.postMessage(0);}return window.__rafQ.length;};window.cancelAnimationFrame=()=>{};window.__errs=[];window.addEventListener("error",e=>window.__errs.push(String(e.error?.stack||e.message).slice(0,400)));window.addEventListener("unhandledrejection",e=>window.__errs.push("rej:"+String(e.reason).slice(0,300)));',
  });
  out = (await send('Page.navigate', { url: rest[0] })).result;
}
else if (cmd === 'key') {
  const code = rest[0];
  for (const type of ['keyDown', 'keyUp']) {
    await send('Input.dispatchKeyEvent', { type, code, key: keyName(code), windowsVirtualKeyCode: vkFor(code) });
  }
  out = 'key ' + code;
} else if (cmd === 'hold') {
  const code = rest[0];
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: keyName(code), windowsVirtualKeyCode: vkFor(code) });
  out = 'hold ' + code;
} else if (cmd === 'shot') {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(rest[0], Buffer.from(r.result.data, 'base64'));
  out = 'shot ' + rest[0];
} else if (cmd === 'wait') {
  const ms = +rest[0];
  const expr = rest.slice(1).join(' ');
  const t0 = Date.now();
  out = null;
  while (Date.now() - t0 < (ms || 60000)) {
    out = await evalJs(expr);
    if (out) break;
    await wait(500);
  }
  out = { waited: Date.now() - t0, value: out };
} else if (cmd === 'screencast') {
  // Forces compositor frames in headless (unthrottles rAF to real-time).
  // The session must STAY OPEN or screencast ends — run as a daemon:
  //   node cdp.mjs screencast   (background, holds frames alive)
  await send('Page.startScreencast', { format: 'jpeg', quality: 30, everyNthFrame: 2 });
  console.log('screencast on — holding session open');
  await new Promise(() => {}); // daemon — acks happen in onmessage
} else if (cmd === 'pump') {
  // beginFrame pump — deterministic frame production in headless with
  // --enable-begin-frame-control. interval=16.6ms of virtual frame time
  // per call; loop runs until killed. Run as a background daemon.
  // Optional args: <gapMs> sleep between frames, <intervalMs> virtual frame
  // time each frame advances (must stay < 100 — the game's maxFrameDt clamp).
  // pump 0 50 → ~1.5-2.5× real-time depending on render cost.
  const gap = +(rest[0] ?? 0);
  const ivl = +(rest[1] ?? 16.6);
  let n = 0;
  const t0 = Date.now();
  for (;;) {
    try {
      await send('HeadlessExperimental.beginFrame', { interval: ivl });
    } catch (e) {
      console.log('beginFrame failed: ' + e.message);
      break;
    }
    if (++n % 60 === 0) console.log(`pump ${n} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    if (gap) await wait(gap);
  }
  await new Promise(() => {});
} else if (cmd === 'keepalive') {
  // Constant evaluate traffic keeps the renderer main thread scheduled —
  // run as a background daemon. Prints simT each tick so stalls are visible.
  for (;;) {
    const v = await evalJs('window.__game ? window.__game.sim.time : -1');
    console.log('keepalive simT=' + (typeof v === 'number' ? v.toFixed(1) : JSON.stringify(v)));
    await wait(1500);
  }
} else if (cmd === 'active') {
  // Tell the page it's lifecycle-active — defeats headless freezing.
  await send('Page.setWebLifecycleState', { state: 'active' });
  out = 'lifecycle active';
} else if (cmd === 'vtime') {
  // Virtual time: rAF + timers advance on a virtual clock as fast as the
  // renderer can produce them — the canonical headless fast-forward.
  // Keeps running while any session holds the policy; run as a daemon and
  // it re-arms automatically when a budget lapses.
  const budget = +(rest[0] ?? 300000);
  const arm = () => send('Emulation.setVirtualTimePolicy', {
    policy: 'pauseIfNetworkFetchesPending',
    budget,
    maxVirtualTimeTaskStarvationCount: 1000000,
  }).catch(() => {});
  await arm();
  console.log('virtual time armed, budget ' + budget + 'ms');
  setInterval(arm, 2000); // re-arm before budget exhaustion
  await new Promise(() => {});
} else if (cmd === 'console') {
  out = events;
} else {
  out = await evalJs(process.argv.slice(2).join(' '));
}
await wait(120); // let late console events land
if (events.length) console.log('EVENTS ' + JSON.stringify(events));
console.log(JSON.stringify(out));
ws.close();
process.exit(0);
