#!/usr/bin/env node
// Toolchain availability check for the Grok Bots Kart Racing gauntlet.
// Prints PASS / WARN / FAIL per tool and exits non-zero only if a
// REQUIRED tool is missing. Safe: no writes, no destructive actions.
//
// MCP servers (blender, chrome-devtools, context7, ...) are NOT checked here —
// they are agent-side services, not CLIs. See docs/gauntlet/TOOLCHAIN.md and
// `devin mcp list` for those.

import { execFileSync } from 'node:child_process';

const IS_WIN = process.platform === 'win32';
const BLENDER_EXE = 'C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe';

// [name, argv, required, note]
const TOOLS = [
  ['node',          ['node', '--version'],                                   true,  'runtime'],
  ['npm',           [IS_WIN ? 'npm.cmd' : 'npm', '--version'],               true,  'package manager'],
  ['git',           ['git', '--version'],                                    true,  'version control'],
  ['gh',            ['gh', '--version'],                                     false, 'GitHub CLI (auth: gh auth status)'],
  ['ffmpeg',        ['ffmpeg', '-version'],                                  true,  'media processing'],
  ['ffprobe',       ['ffprobe', '-version'],                                 true,  'media inspection'],
  ['gltf-transform',['gltf-transform', '--version'],                          true,  'glTF optimization'],
  ['gltfpack',      ['gltfpack'],                                            true,  'meshopt (prints usage, no --version flag; presence = pass)'],
  ['toktx',         ['toktx', '--version'],                                  false, 'KTX2 / Basis encoding'],
  ['ktx',           ['ktx', '--version'],                                    false, 'KTX tools'],
  ['playwright-cli',['playwright-cli', '--version'],                          true,  'browser automation'],
  ['grok',          ['grok', '--version'],                                   false, 'Grok agent + Imagine pipeline'],
  ['blender',       [BLENDER_EXE, '--version'],                              true,  '3D DCC (full path; not on PATH)'],
  ['python',        ['python', '--version'],                                 false, 'scripting'],
  ['uv',            ['uv', '--version'],                                     false, 'python tool runner (blender-mcp)'],
];

function firstLineOf(text) {
  return String(text).split('\n').map((l) => l.trim()).filter(Boolean)[0] ?? '';
}

function run(argv, viaShell) {
  const opts = {
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
    windowsHide: true,
    encoding: 'utf-8',
  };
  if (!viaShell) return execFileSync(argv[0], argv.slice(1), opts);
  // npm-installed CLIs are .cmd/.ps1 shims that need shell/PATHEXT resolution.
  const cmd = argv.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ');
  const [shell, flag] = IS_WIN ? ['cmd.exe', ['/d', '/s', '/c']] : ['/bin/sh', ['-c']];
  return execFileSync(shell, [...flag, `${cmd} 2>&1`], opts);
}

function probe(argv) {
  // Try direct spawn first (real executables), then via shell for shimmed
  // commands that fail with ENOENT/EINVAL on Windows.
  for (const viaShell of [false, true]) {
    try {
      const out = run(argv, viaShell);
      return { ok: true, firstLine: firstLineOf(out) };
    } catch (err) {
      const out = String(err.stdout ?? '') + String(err.stderr ?? '');
      // Non-zero exit but real output => binary exists and ran — unless the
      // shell itself reported the command as missing.
      const missing = /not recognized|command not found|No such file/i.test(out)
        || /ENOENT|EINVAL/.test(err.message);
      if (out.trim().length > 0 && !missing) {
        return { ok: true, firstLine: firstLineOf(out) };
      }
      if (!viaShell) continue; // retry through the shell
      return { ok: false, firstLine: err.message };
    }
  }
  return { ok: false, firstLine: 'unreachable' };
}

let requiredFailures = 0;
let warned = 0;

console.log('Toolchain check — Grok Bots Kart Racing\n');

for (const [name, argv, required, note] of TOOLS) {
  const r = probe(argv);
  if (r.ok) {
    console.log(`PASS  ${name.padEnd(15)} ${r.firstLine}`);
  } else if (required) {
    requiredFailures += 1;
    console.log(`FAIL  ${name.padEnd(15)} REQUIRED — ${note} (${r.firstLine})`);
  } else {
    warned += 1;
    console.log(`WARN  ${name.padEnd(15)} missing (optional) — ${note}`);
  }
}

console.log('\nMCP servers are verified agent-side (devin mcp list), not here.');
console.log(`\nSummary: ${TOOLS.length - requiredFailures - warned} pass, ${warned} warn, ${requiredFailures} fail`);
process.exit(requiredFailures > 0 ? 1 : 0);
