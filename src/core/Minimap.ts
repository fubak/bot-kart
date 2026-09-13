import * as THREE from 'three';
import type { Kart } from '../game/Kart';
import type { Track } from '../game/Track';

// Minimap — classic kart-racer HUD element. Track outline rendered once to
// an offscreen path, racer dots drawn each frame. Canvas 2D overlay: cheap,
// crisp, and readable at speed.

const SIZE = 168;
const PAD = 14;

export class Minimap {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly pts: { x: number; y: number }[] = [];
  private readonly dotColors = ['#ffffff', '#ff9040', '#c070ff', '#ffd454'];

  constructor(private readonly track: Track) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.canvas.style.cssText =
      'position:fixed;left:16px;bottom:16px;z-index:11;background:rgba(8,14,24,.55);' +
      'border-radius:10px;border:1px solid rgba(140,190,255,.25)';
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;

    // Sample the centerline, fit world XZ → canvas with aspect preserved.
    const n = 160;
    const world: THREE.Vector3[] = [];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < n; i++) {
      const p = track.pointAt(Math.floor((i / n) * track.sampleCount));
      world.push(p);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }
    const span = Math.max(maxX - minX, maxZ - minZ);
    const scale = (SIZE - PAD * 2) / span;
    for (const p of world) {
      this.pts.push({
        x: PAD + (p.x - minX) * scale + (SIZE - PAD * 2 - (maxX - minX) * scale) / 2,
        y: PAD + (p.z - minZ) * scale + (SIZE - PAD * 2 - (maxZ - minZ) * scale) / 2,
      });
    }
    this.scale = scale;
    this.minX = minX;
    this.minZ = minZ;
    this.offX = (SIZE - PAD * 2 - (maxX - minX) * scale) / 2;
    this.offY = (SIZE - PAD * 2 - (maxZ - minZ) * scale) / 2;
  }

  private readonly scale: number;
  private readonly minX: number;
  private readonly minZ: number;
  private readonly offX: number;
  private readonly offY: number;

  update(karts: Kart[], show: boolean): void {
    this.canvas.style.display = show ? 'block' : 'none';
    if (!show) return;
    const c = this.ctx;
    c.clearRect(0, 0, SIZE, SIZE);
    // Track outline
    c.strokeStyle = 'rgba(200,225,255,.85)';
    c.lineWidth = 3;
    c.lineJoin = 'round';
    c.beginPath();
    this.pts.forEach((p, i) => (i === 0 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y)));
    c.closePath();
    c.stroke();
    // Start marker at index 0
    const s = this.pts[0];
    c.fillStyle = '#7be8ff';
    c.fillRect(s.x - 3, s.y - 3, 6, 6);
    // Racer dots — player is index 0 (white, ringed)
    for (let i = karts.length - 1; i >= 0; i--) {
      const p = karts[i].position;
      const x = PAD + (p.x - this.minX) * this.scale + this.offX;
      const y = PAD + (p.z - this.minZ) * this.scale + this.offY;
      c.beginPath();
      c.arc(x, y, i === 0 ? 4.2 : 3.2, 0, Math.PI * 2);
      c.fillStyle = this.dotColors[i] ?? '#ff6080';
      c.fill();
      if (i === 0) {
        c.strokeStyle = 'rgba(255,255,255,.9)';
        c.lineWidth = 1.4;
        c.stroke();
      }
    }
  }
}
