// Critic-17 persistent console monitor — attaches to :9333 page and
// appends every console/exception line to the output file until killed.
// Usage: node c18-conmon.mjs <outfile>
const PORT = 9333;
const out = process.argv[2] ?? 'C:/github/bot-kart/scripts/c19/console19.log';
const { appendFileSync } = await import('node:fs');
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = targets.find((t) => t.type === 'page' && t.url.includes('localhost:5173'));
if (!page) { console.log('FATAL no page'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 0;
const send = (method, params = {}) => ws.send(JSON.stringify({ id: ++id, method, params }));
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.consoleAPICalled') {
    const txt = (m.params.args || []).map((a) => a.value ?? a.description ?? a.type ?? '').join(' ');
    const line = m.params.type + ': ' + txt.slice(0, 500);
    appendFileSync(out, line + '\n');
    console.log(line);
  }
  if (m.method === 'Runtime.exceptionThrown') {
    const line = 'exception: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 800);
    appendFileSync(out, line + '\n');
    console.log(line);
  }
  if (m.method === 'Log.entryAdded') {
    const en = m.params.entry;
    const line = 'log-' + en.level + ': ' + String(en.text).slice(0, 400);
    appendFileSync(out, line + '\n');
    console.log(line);
  }
};
send('Runtime.enable');
send('Log.enable');
console.log('conmon19 attached → ' + out);
