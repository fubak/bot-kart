// Persistent console monitor — attaches to the page on :9333 and appends
// every console API call + uncaught exception to __gauntlet/console.log.
// Run detached: node conmon.mjs  (kill to stop; tail the log for audits)
import { appendFileSync, writeFileSync } from 'node:fs';

const LOG = new URL('./console.log', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
writeFileSync(LOG, `--- conmon start ${new Date().toISOString()} ---\n`);

const targets = await (await fetch('http://127.0.0.1:9333/json/list')).json();
const page = targets.find((t) => t.type === 'page');
if (!page) { console.log('FATAL no page'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 0;
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.consoleAPICalled') {
    const txt = (m.params.args || []).map((a) => a.value ?? a.description ?? a.type ?? '').join(' ');
    appendFileSync(LOG, `${m.params.type}: ${txt.slice(0, 500)}\n`);
  }
  if (m.method === 'Runtime.exceptionThrown') {
    appendFileSync(LOG, `EXCEPTION: ${JSON.stringify(m.params.exceptionDetails).slice(0, 800)}\n`);
  }
};
ws.send(JSON.stringify({ id: ++id, method: 'Runtime.enable' }));
console.log('conmon attached → ' + LOG);
await new Promise(() => {});
