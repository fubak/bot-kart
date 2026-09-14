import * as THREE from 'three';

import grassUrl from '../../assets/textures/grass_tile.png?url';
import asphaltUrl from '../../assets/textures/asphalt_tile.png?url';
import gravelUrl from '../../assets/textures/gravel_tile.png?url';
import cloudUrl from '../../assets/textures/cloud_sprite.png?url';
import smokeUrl from '../../assets/textures/smoke_puff.png?url';
import crowdUrl from '../../assets/textures/crowd.png?url';
import bbAUrl from '../../assets/textures/billboard_grokkart.png?url';
import bbBUrl from '../../assets/textures/billboard_turbo.png?url';
import bbCUrl from '../../assets/textures/billboard_botpower.png?url';

// Central texture registry — generated art lives in assets/textures/
// (pipeline: grok image_gen → assets/media/textures raw → power-of-2
// processed copies here). Procedural canvas textures cover the patterns
// that don't need a generator (checker, glow dot, chevron).

const loader = new THREE.TextureLoader();

function load(url: string, repeat?: number): THREE.Texture {
  const t = loader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat !== undefined) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
  }
  t.anisotropy = 8; // sharper oblique views — softens distant tiling moiré
  return t;
}

export const TEX = {
  grass: () => load(grassUrl, 1),
  asphalt: () => load(asphaltUrl, 1),
  gravel: () => load(gravelUrl, 1),
  cloud: () => load(cloudUrl),
  smoke: () => load(smokeUrl),
  crowd: () => load(crowdUrl),
  billboards: [bbAUrl, bbBUrl, bbCUrl].map((u) => () => load(u)),
};

/** Checkered start-line flag — crisp procedural checker, waved by
 *  mapping onto the stripe plane with a slight UV shear built in. */
export function checkerTexture(cells = 12): THREE.CanvasTexture {
  const s = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d')!;
  const c = s / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      g.fillStyle = (x + y) % 2 ? '#111318' : '#f4f6f8';
      g.fillRect(x * c, y * c, c, c);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8; // sharper oblique views — softens distant tiling moiré
  return t;
}

/** Soft radial glow — generic spark/glow sprite for additive particles. */
export function glowTexture(): THREE.CanvasTexture {
  const s = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(cv);
}

/** Four-point star sprite — spin-out stars, pickup sparkle. */
export function starTexture(): THREE.CanvasTexture {
  const s = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d')!;
  g.translate(s / 2, s / 2);
  g.fillStyle = '#ffffff';
  g.beginPath();
  const R = s * 0.46;
  const r = s * 0.13;
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    g[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rad, Math.sin(a) * rad);
  }
  g.closePath();
  g.fill();
  // soft halo
  const grad = g.createRadialGradient(0, 0, r, 0, 0, R * 1.3);
  grad.addColorStop(0, 'rgba(255,255,255,0.25)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(-s / 2, -s / 2, s, s);
  return new THREE.CanvasTexture(cv);
}

/** Boost-pad chevron arrows — three forward arrows on transparent bg. */
export function chevronTexture(color = '#b8ffe0'): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 192;
  const g = cv.getContext('2d')!;
  g.strokeStyle = color;
  g.lineWidth = 16;
  g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const y = 52 + i * 52;
    g.beginPath();
    g.moveTo(26, y + 26);
    g.lineTo(64, y);
    g.lineTo(102, y + 26);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
