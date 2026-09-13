// Inspect a GLB: node transforms, tris, world-space bbox, materials.
const fs = require('fs');
const path = process.argv[2];
const b = fs.readFileSync(path);
const jl = b.readUInt32LE(12);
const j = JSON.parse(b.slice(20, 20 + jl).toString());

console.log('file:', path);
console.log('nodes:', j.nodes.length, '| meshes:', j.meshes.length,
  '| materials:', (j.materials || []).map(m => m.name).join(', '));

// --- matrix helpers (column-major mat4) ---
function matFromTRS(n) {
  const t = n.translation || [0, 0, 0];
  const q = n.rotation || [0, 0, 0, 1];
  const s = n.scale || [1, 1, 1];
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}
function mul(a, b) { // a*b
  const r = new Array(16);
  for (let c = 0; c < 4; c++) for (let r0 = 0; r0 < 4; r0++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r0] * b[c * 4 + k];
    r[c * 4 + r0] = s;
  }
  return r;
}
function xform(m, v) {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
  ];
}

// world matrix per node
const world = new Array(j.nodes.length).fill(null);
function solve(i, parentM) {
  if (world[i]) return;
  const n = j.nodes[i];
  const local = n.matrix ? n.matrix.slice() : matFromTRS(n);
  world[i] = parentM ? mul(parentM, local) : local;
  (n.children || []).forEach(c => solve(c, world[i]));
}
(j.scenes[0].nodes).forEach(i => solve(i, null));

// --- tris + world bbox using accessor min/max corners ---
let tris = 0;
const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
j.nodes.forEach((n, i) => {
  if (n.mesh === undefined) return;
  j.meshes[n.mesh].primitives.forEach(p => {
    if (p.indices !== undefined) tris += j.accessors[p.indices].count / 3;
    const a = j.accessors[p.attributes.POSITION];
    for (let c = 0; c < 8; c++) {
      const corner = [
        (c & 1 ? a.max : a.min)[0],
        (c & 2 ? a.max : a.min)[1],
        (c & 4 ? a.max : a.min)[2],
      ];
      const w = xform(world[i], corner);
      w.forEach((v, k) => { mn[k] = Math.min(mn[k], v); mx[k] = Math.max(mx[k], v); });
    }
  });
});
console.log('tris:', tris);
console.log('world bbox min:', mn.map(v => +v.toFixed(3)), 'max:', mx.map(v => +v.toFixed(3)));
console.log('size (x,y,z):', mx.map((v, k) => +(v - mn[k]).toFixed(3)));

// named part spot-check (translations in glTF space: +Y up, -Z forward)
['grokbot_a', 'head', 'visor', 'eye_l', 'smile', 'antenna_ball',
 'foot_l', 'hand_r', 'chest_panel'].forEach(nm => {
  const i = j.nodes.findIndex(n => n.name === nm);
  if (i < 0) { console.log(nm, 'MISSING'); return; }
  const m = world[i];
  console.log(nm.padEnd(14), 'world pos:', [m[12], m[13], m[14]].map(v => +v.toFixed(3)));
});
