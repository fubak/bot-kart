// SFX-DEEP verification: drives bot-kart headless through a scripted race,
// fires organic + forced gameplay events, and dumps __game.audio counters.
// Output: docs/gauntlet/evidence/wave20/sfx-proof.json
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const PORT = 9333;
const CHROME = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
// Outside the repo: vite's watcher EBUSY-crashes on locked session files.
const PROFILE = 'C:/temp/botkart-chrome-profile';
const URL = 'http://localhost:5173';
const OUT = 'C:/github/bot-kart/docs/gauntlet/evidence/wave20/sfx-proof.json';

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
const t0 = Date.now();
const log = (...a) => console.log(`[+${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

let ws = null;
for (let i = 0; i < 60; i++) {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const page = (await res.json()).find((t) => t.type === 'page');
    if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
  } catch { /* retry */ }
  await wait(300);
}
if (!ws) { console.log('FATAL no page target'); process.exit(1); }
await new Promise((r) => { ws.onopen = r; });

let id = 0;
const pending = new Map();
const consoleErrs = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled') {
    const txt = (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
    if (m.params.type === 'error' || m.params.type === 'warning') {
      consoleErrs.push(`${m.params.type}: ${txt.slice(0, 300)}`);
      log('CONSOLE-' + m.params.type, txt.slice(0, 200));
    }
  }
  if (m.method === 'Runtime.exceptionThrown') {
    consoleErrs.push('exception: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 300));
    log('EXCEPTION', JSON.stringify(m.params.exceptionDetails).slice(0, 300));
  }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id;
  pending.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
  setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error('timeout ' + method)); } }, 30000);
});
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) {
    log('EVAL-ERR', JSON.stringify(r.result.exceptionDetails).slice(0, 300), '<<', expr.slice(0, 120));
    return undefined;
  }
  return r.result?.result?.value;
};
const key = async (code, holdOnly = false) => {
  const VK = { Enter: 13, Escape: 27, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Space: 32, Backspace: 8, ShiftLeft: 16, KeyP: 80, KeyW: 87, KeyA: 65, KeyD: 68, KeyS: 83 };
  const keyName = code.startsWith('Key') ? code.slice(3).toLowerCase() : code === 'Space' ? ' ' : code;
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: keyName, windowsVirtualKeyCode: VK[code] ?? 0 });
  if (!holdOnly) await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: keyName, windowsVirtualKeyCode: VK[code] ?? 0 });
};
const keyUp = async (code) => {
  const VK = { ShiftLeft: 16, KeyW: 87, KeyA: 65, KeyD: 68, KeyS: 83 };
  const keyName = code.startsWith('Key') ? code.slice(3).toLowerCase() : code;
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: keyName, windowsVirtualKeyCode: VK[code] ?? 0 });
};

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: URL });
log('navigated');

// Wait for the game object.
for (let i = 0; i < 100; i++) {
  if (await ev('!!(window.__game && window.__game.race)')) break;
  await wait(300);
}
log('game up:', await ev('window.__game.race.phase'));

const snap = async (label) => {
  const s = await ev('JSON.stringify(window.__game.audio.sfxSnapshot())');
  const o = s ? JSON.parse(s) : null;
  log('SNAP', label, JSON.stringify(o));
  return o;
};
const results = { notes: [], snaps: {}, probes: {}, consoleIssues: consoleErrs };

// --- 1) unlock + countdown → GO ---
await key('Enter');
await wait(3800); // 3 s countdown + margin
results.snaps.afterGo = await snap('afterGo');
results.notes.push('expect beep>=1 (3 ideal), go=1, uiConfirm=1');

// --- 2) autopilot organic driving ---
const ap = readFileSync('C:/github/bot-kart/__gauntlet/autopilot.js', 'utf8');
await ev(ap);
log('autopilot installed');
await wait(20000);
results.snaps.organic20s = await snap('organic20s');
results.probes.organicState = await ev(
  'JSON.stringify({phase:__game.race.phase,lap:__game.race.lap,pos:__game.race.positionOf(0),spd:+__game.kart.speed.toFixed(1),onWall:__game.kart.onWall,onGravel:__game.kart.onGravel,held:__game.items.held[0],rouT:+(__game.items.rouletteT[0]||0).toFixed(2)})',
);
log('state', JSON.stringify(results.probes.organicState));

// --- 3) forced probes, still racing/unpaused ---
// draft whoosh + wind layer
await ev('__game.kart.draftsFired++; __game.kart.slipstreamT = 1.3; "ok"');
await wait(400);
results.probes.windLevel = await ev('__game.audio.loopLevels().wind');
results.snaps.afterDraft = await snap('afterDraft');

// kart-kart bump: drop a rival overlapping the player, moving into it
await ev(`(() => {
  const g = window.__game, k = g.kart, a = g.aiKarts[0];
  a.position.copy(k.position); a.position.x += 0.9;
  a.velocity.copy(k.velocity); a.velocity.x -= 4;
  return 'bump-probe';
})()`);
await wait(500);
results.snaps.afterBump = await snap('afterBump');

// position stinger: bump an AI's progress ahead of the player, then back
await ev('__game.race.racers[1].progressIdx += 400; "pos+400"');
await wait(400);
results.snaps.afterPosDown = await snap('afterPosDown');
await ev('__game.race.racers[1].progressIdx -= 400; "pos-400"');
await wait(400);
results.snaps.afterPosUp = await snap('afterPosUp');

// forced roulette (deterministic — real Items.update drives the flips)
await ev(`(() => {
  const g = window.__game, it = g.items;
  it.rouletteItem[0] = 'missile';
  it.rouletteT[0] = 1.2;
  it.rouletteTick[0] = 1;
  it.rouletteNextFlip[0] = g.sim.time;
  return 'roulette armed';
})()`);
await wait(1800);
results.snaps.afterRoulette = await snap('afterRoulette');

// --- 4) wall-grind scrape: park the kart heading into the wall ---
await ev('window.__apOff && window.__apOff()');
await ev(`(() => {
  const g = window.__game, tr = g.track;
  const i = Math.floor(tr.sampleCount * 0.08); // straight leg
  const p = tr.pointAt(i).clone().addScaledVector(tr.leftAt(i), -4.5);
  p.y = tr.heightAt(p, i);
  const t = tr.tangentAt(i);
  // aim ~35° right of the tangent → the kart slides along the right wall
  const h = Math.atan2(-t.x, -t.z) - 0.6;
  g.kart.reset(p, h);
  return 'wallprobe armed';
})()`);
await key('KeyW', true);
await wait(1600);
results.probes.scrape = await ev(
  'JSON.stringify({lv:__game.audio.loopLevels(),spd:+__game.kart.speed.toFixed(1),onWall:__game.kart.onWall})',
);
await keyUp('KeyW');
results.snaps.afterScrape = await snap('afterScrape');

// --- 5) gravel rumble: teleport onto the hairpin apron, drive it ---
await ev(`(() => {
  const g = window.__game, tr = g.track;
  const i = Math.floor(tr.sampleCount * 0.63); // PG gravel zone, side +1
  const p = tr.pointAt(i).clone().addScaledVector(tr.leftAt(i), 7.0);
  p.y = tr.heightAt(p, i);
  const t = tr.tangentAt(i);
  g.kart.reset(p, Math.atan2(-t.x, -t.z));
  return 'gravel armed';
})()`);
await key('KeyW', true);
await wait(1400);
results.probes.rumble = await ev(
  'JSON.stringify({lv:__game.audio.loopLevels(),spd:+__game.kart.speed.toFixed(1),onGravel:__game.kart.onGravel,surface:__game.track.query(__game.kart.position,__game.kart.trackIdx).surface})',
);
await keyUp('KeyW');
results.snaps.afterRumble = await snap('afterRumble');

// --- 6) paused probes: audio.update still runs, kart state is frozen ---
await key('KeyP'); // pause
await wait(300);
await ev('__game.kart.grounded = true; __game.kart.driftDir = 0; "ok"');
await wait(150);
await ev('__game.kart.driftDir = 1; __game.kart.driftCharge = 0.5; "ok"'); // hop + charge:0
await wait(250);
await ev('__game.kart.driftCharge = 1.15; "ok"'); // charge:1
await wait(250);
await ev('__game.kart.driftCharge = 1.95; "ok"'); // charge:2
await wait(250);
await ev('__game.kart.driftDir = 0; __game.kart.boostTimer = 0.7; "ok"'); // turbo:2 release
await wait(300);
// landing: go airborne then touch down (paused sim keeps airTime fixed)
await ev('__game.kart.grounded = false; __game.kart.airTime = 0.6; "ok"');
await wait(250);
await ev('__game.kart.grounded = true; "ok"');
await wait(250);
// lap blip then final-lap flourish
await ev('__game.race.racers[0].lap = 2; "ok"');
await wait(250);
await ev('__game.race.racers[0].lap = 3; "ok"');
await wait(300);
results.snaps.afterPausedProbes = await snap('afterPausedProbes');
await key('KeyP'); // unpause
await wait(300);

// --- 7) respawn shimmer (real Backspace path) ---
await key('Backspace');
await wait(400);
results.snaps.afterRespawn = await snap('afterRespawn');

// --- 8) finish → fanfare + crowd swell ---
await ev(`(() => {
  const g = window.__game;
  g.race.racers[0].finished = true;
  g.race.racers[0].finishTime = g.sim.time;
  return 'finish forced';
})()`);
await wait(800);
results.snaps.afterFinish = await snap('afterFinish');
results.probes.finalPhase = await ev('__game.race.phase');

writeFileSync(OUT, JSON.stringify(results, null, 2));
log('wrote', OUT);
log('console issues:', consoleErrs.length);
chrome.kill();
process.exit(0);
